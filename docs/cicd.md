# Client CI/CD

## 실행 흐름

- `main` 대상 PR: 의존성 설치, 포맷 검사, Vite 빌드, 배포 스크립트 테스트, Docker 빌드와 Nginx 검증.
- `main` push / Client Deploy 수동 실행: 같은 CI 통과 후 GHCR에 커밋 SHA 태그로 업로드하고, 업로드된 digest를 다시 받아 컨테이너 검증.
- 저장소 변수 `DEPLOY_ENABLED=true`: 검증한 digest를 서버에 배포. 설정 전에는 이미지 업로드까지 실행하고 서버 배포는 건너뛴다.
- Client Rollback 수동 실행: 서버에 기록된 직전 성공 이미지로 복원. `main`에서 실행한다.

현재 이미지는 `linux/amd64`용이다. ARM 서버는 빌드 플랫폼과 실행 검증 구성을 먼저 변경해야 한다.
PR 검증은 GitHub 호스팅 러너에서 실행하며 배포용 비밀값을 사용하지 않는다.

## GitHub 설정

저장소 Settings → Actions에서 GitHub/Docker의 공식 Action 실행을 허용한다.
GHCR 업로드 작업에만 `packages: write`를 부여하며, `GITHUB_TOKEN`은 GitHub가 자동 제공한다.
기존 GHCR 패키지를 재사용한다면 이 저장소의 Actions가 해당 패키지에 접근하도록 연결해야 한다.

저장소 변수에 다음 값을 등록한다.

| 변수             | 값                                          |
| ---------------- | ------------------------------------------- |
| `DEPLOY_ENABLED` | 서버 준비와 최초 수동 검증 후 `true`로 설정 |

`production` Environment를 만들고 배포 브랜치를 `main`으로 제한한다.
다음 변수와 비밀값은 해당 Environment에 등록한다.

| 구분     | 이름                 | 값                                                                                   |
| -------- | -------------------- | ------------------------------------------------------------------------------------ |
| Variable | `DEPLOY_HOST`        | SSH로 접근 가능한 서버 주소                                                          |
| Variable | `DEPLOY_USER`        | Docker와 배포 디렉터리 사용 권한이 있는 계정                                         |
| Variable | `DEPLOY_PORT`        | SSH 포트, 생략하면 `22`                                                              |
| Variable | `DEPLOY_CONFIG`      | 서버 설정 파일 절대 경로, 생략하면 `/opt/chagok/client-deploy.conf`                  |
| Secret   | `DEPLOY_SSH_KEY`     | 배포 전용 SSH 개인 키 전체                                                           |
| Secret   | `DEPLOY_KNOWN_HOSTS` | 신뢰할 수 있는 경로로 확인한 서버 공개 호스트 키. 비표준 포트는 `[호스트]:포트` 형식 |

`main` 보호 규칙에 Client CI의 `check`, `container` 검사를 필수로 설정한다.
배포와 수동 롤백은 같은 concurrency 그룹을 사용하며 진행 중인 작업을 취소하지 않는다.
서버의 `flock`으로 Actions 밖에서 실행한 작업과의 중복도 막는다.

## 서버 최초 준비

1. x86_64 Linux에 Docker Engine, Docker Compose 2.24.4 이상, Bash, curl, Python 3, `flock`을 준비한다.
2. 통합 Compose, 참조하는 하위 Compose 파일과 서버 `.env`를 운영 경로에 배치한다. 현재 상위 `compose.yaml`은 client 저장소에 없으므로 별도 배포 설정 저장소에서 관리한다.
3. 통합 스택을 최초 한 번 기동한다. 이 스크립트는 이미 실행 중인 `frontend` 한 개를 갱신하며 백엔드·DB를 최초 생성하지 않는다.
4. `deploy/client-deploy.conf.example`을 서버 `/opt/chagok/client-deploy.conf`로 복사하고 경로·프로젝트 이름·확인 주소를 수정한다. 설정 파일은 신뢰하는 관리자만 수정할 수 있게 한다.
5. private GHCR 이미지는 배포 계정으로 `docker login ghcr.io`를 실행해 `read:packages` 권한의 PAT classic을 등록한다. 이 서버 인증은 Actions의 `GITHUB_TOKEN`과 별개다. 조직 SSO를 사용하면 토큰에도 승인한다.
6. 기존 공개 포트·Compose 네트워크를 유지하고, 외부 HTTPS 프록시에서 세션 쿠키·전달 헤더와 SSE 동작을 확인한다. `PUBLIC_BASE_URL`을 지정하면 배포 때 공개 HTTPS 경로도 검사한다.

설정 파일의 `COMPOSE_PROJECT_NAME`과 `COMPOSE_FILES`는 현재 실행 중인 스택과 같아야 한다.
스크립트는 이름이 `frontend`인 서비스만 `up --no-deps --no-build --pull never --wait`로 교체한다.
이미지를 먼저 pull한 뒤 현재 이미지에 로컬 롤백 태그를 붙이므로, 새 버전이 실패해도 이전 이미지를 다시 다운로드할 필요가 없다.

프런트는 같은 출처의 `/api/v1`을 유지한다. `VITE_*` 값은 브라우저에 공개되는 빌드 설정이므로 서버 비밀값을 넣지 않는다.
현재 Dockerfile은 별도 `VITE_*` 빌드 인자를 받지 않으며 서버의 컨테이너 환경변수만 바꿔도 정적 번들은 바뀌지 않는다.

## 최초 배포와 확인

자동 배포를 켜기 전에 서버에서 검증한 이미지 digest로 직접 실행할 수 있다.

```sh
bash scripts/deploy-client.sh deploy \
  'ghcr.io/chagokai/client@sha256:<64자리-digest>' \
  /opt/chagok/client-deploy.conf
```

스크립트는 컨테이너 healthy 상태, `/healthz` 응답, `/login`의 앱 HTML,
`/api/v1/auth/csrf`의 실제 JSON 토큰 구조를 확인한다.
CI는 여기에 더해 Nginx 설정 검사와 HTML이 참조하는 JavaScript 파일 응답도 확인한다.
최초 운영 검증에는 로그인·세션 유지·SSE 수신 확인을 포함한다.

성공 후 `DEPLOY_ENABLED=true`를 등록하면 다음 main push부터 자동 배포한다.
현재 main을 바로 배포하려면 Actions에서 Client Deploy → Run workflow를 실행한다.

## 상태 보존과 롤백

`DEPLOY_STATE_DIR`에 다음 파일을 보존한다.

- `frontend.image.yaml`: 현재 이미지 override. 이후 수동 Compose 조작에도 반드시 마지막 `-f`로 추가한다.
- `current-image`, `previous-image`: 성공한 현재 버전과 직전 버전.
- `history.tsv`: 배포·복원 시각과 이미지 기록.
- `deploy.lock`: 서버 동시 실행 잠금.

예를 들어 수동 상태 확인은 서버 설정을 읽은 후 다음처럼 실행한다.

```sh
source /opt/chagok/client-deploy.conf
docker compose --project-directory "$COMPOSE_PROJECT_DIRECTORY" \
  --project-name "$COMPOSE_PROJECT_NAME" --env-file "$COMPOSE_ENV_FILE" \
  -f "${COMPOSE_FILES[0]}" -f "$DEPLOY_STATE_DIR/frontend.image.yaml" ps frontend
```

추가 Compose 파일을 설정했다면 같은 순서로 `-f` 옵션을 모두 포함한다.
기본 Compose만으로 frontend를 다시 기동하면 기존 이미지 설정으로 돌아갈 수 있다.

배포 실패 시 이전 이미지 복원을 시도하고, 복원 성공 여부와 관계없이 배포 작업은 실패로 남긴다.
복원도 실패하면 서버에서 backend 상태와 frontend 로그를 확인한다.
수동 롤백은 Actions의 Client Rollback 또는 서버에서 다음 명령으로 실행한다.

```sh
bash scripts/deploy-client.sh rollback '' /opt/chagok/client-deploy.conf
```

수동 롤백 성공 시 교체 전 버전이 새 직전 버전으로 기록되므로, 다시 실행하면 그 버전으로 전환한다.
같은 이미지를 재배포하면 기존 롤백 기록을 보존한다.
롤백 태그와 배포 상태 디렉터리를 정리 작업으로 삭제하지 않는다.
단일 frontend 교체에는 짧은 접속 중단과 SSE 재접속이 발생할 수 있다.
