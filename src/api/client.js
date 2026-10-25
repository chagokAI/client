// .env 에 VITE_API_BASE_URL= 로 빈 값을 둔 경우도 기본값을 쓴다(?? 는 빈 문자열을 통과시킨다)
const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
let csrf = null
let csrfRequest = null

export class ApiError extends Error {
  constructor(status, error = {}) {
    super(
      error.message ||
        (status >= 500 ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.' : '요청을 처리하지 못했습니다.'),
    )
    this.status = status
    this.code = error.code
    this.fieldErrors = error.fieldErrors ?? []
  }
}

async function read(response) {
  if (response.status === 204) return null
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body?.error)
  if (!body || !Object.hasOwn(body, 'data')) throw new Error('서버 응답을 확인할 수 없습니다.')
  return body
}

async function csrfToken() {
  if (csrf) return csrf
  if (!csrfRequest)
    csrfRequest = fetch(`${baseUrl}/auth/csrf`, { credentials: 'include' })
      .then(read)
      .then((body) => {
        csrf = body.data
        return csrf
      })
      .finally(() => {
        csrfRequest = null
      })
  return csrfRequest
}

export function clearCsrf() {
  csrf = null
}

// EventSource(SSE)는 fetch 를 거치지 않으므로 같은 기준 주소로 URL 만 만든다. 세션 쿠키는 같은 출처라 함께 간다.
export function apiUrl(path) {
  return `${baseUrl}${path}`
}

function searchParams(query) {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params
}

// Content-Disposition 의 filename*(RFC 5987) → 실제 파일명. 없으면 호출부의 기본 이름을 씁니다.
function filenameOf(header, fallback) {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header ?? '')
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      return fallback
    }
  }
  return /filename="?([^";]+)"?/i.exec(header ?? '')?.[1] ?? fallback
}

/**
 * 파일 응답(PDF 등)을 받아 브라우저 다운로드를 띄웁니다. {data,meta} Envelope 가 아니라 본문이 파일 그대로입니다.
 * 세션 쿠키가 필요해 a[href] 대신 fetch 로 받습니다(교차 출처일 때 쿠키가 빠지는 걸 막습니다).
 */
export async function downloadFile(path, { query, filename } = {}) {
  const params = searchParams(query)
  let response
  try {
    response = await fetch(`${baseUrl}${path}${params.size ? `?${params}` : ''}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/pdf, application/json' },
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.')
  }
  if (response.status === 401) globalThis.dispatchEvent?.(new Event('auth:expired'))
  if (!response.ok) {
    // 실패하면 서버가 평소처럼 JSON 오류 본문을 주므로 같은 ApiError 로 맞춥니다.
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.error)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filenameOf(response.headers.get('Content-Disposition'), filename ?? 'download')
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // 클릭 직후 해제하면 일부 브라우저가 저장을 시작하기 전에 끊기므로 한 틱 뒤에 정리합니다.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function api(path, { method = 'GET', body, query, signal, keepalive = false } = {}) {
  const params = searchParams(query)
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await csrfToken()
    headers[token.headerName] = token.token
  }
  let response
  try {
    response = await fetch(`${baseUrl}${path}${params.size ? `?${params}` : ''}`, {
      method,
      credentials: 'include',
      headers,
      signal,
      keepalive,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.')
  }
  if (response.status === 401 && !path.startsWith('/auth/')) {
    globalThis.dispatchEvent?.(new Event('auth:expired'))
  }
  const result = await read(response)
  if (path === '/auth/login' || path === '/auth/logout') clearCsrf()
  return result
}
