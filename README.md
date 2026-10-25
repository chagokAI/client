# 차곡 Client

Vue/Vite 프런트엔드와 API·SSE 프록시를 제공하는 Nginx 컨테이너입니다.

```sh
npm ci
npm run dev
```

검증은 `npm run format:check`, `npm test`, 빌드는 `npm run build`로 실행합니다.
GitHub Actions 구성, 서버 준비, 배포·롤백 절차는 [CI/CD 안내](docs/cicd.md)를 참고하세요.

알림 벨은 로그인한 사용자의 `/notifications/stream`을 구독하고 새 알림을 즉시 표시합니다.
`알림 전체 보기`에서 전체 이력을 페이지별로 조회하고 분류·미읽음 필터, 단건·전체 읽음을 사용할 수 있습니다.
프로필의 `알림 받기`를 끄면 배지와 새 알림 팝업을 숨기며, 이력은 계속 조회할 수 있습니다.
SSE 재접속·탭 복귀 시 다시 조회하고, 보이는 탭은 30초마다 서버와 상태를 맞춥니다.
