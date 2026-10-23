const baseUrl = (import.meta.env?.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
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

export async function api(path, { method = 'GET', body, query, signal, keepalive = false } = {}) {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
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
