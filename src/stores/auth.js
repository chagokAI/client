import { computed, ref } from 'vue'
import { api, clearCsrf, downloadFile } from '../api/client.js'

const session = ref(null)
let checked = false
let checking = null

async function restore() {
  if (checked) return session.value
  if (!checking)
    checking = api('/auth/me')
      .then(({ data }) => {
        session.value = data
        checked = true
        return data
      })
      .catch((error) => {
        if (error.status !== 401) throw error
        session.value = null
        checked = true
        return null
      })
      .finally(() => {
        checking = null
      })
  return checking
}

async function login(input) {
  const { data } = await api('/auth/login', { method: 'POST', body: input })
  session.value = data
  checked = true
  return data
}

async function logout() {
  await api('/auth/logout', { method: 'POST' })
  session.value = null
  checked = true
  clearCsrf()
}

export function resetSession() {
  session.value = null
  checked = false
  clearCsrf()
}

export const auth = {
  session,
  restore,
  login,
  logout,
  warehouseId: computed(() => session.value?.warehouse?.id ?? null),
  canEdit: computed(() => ['OPERATOR', 'DIRECTOR'].includes(session.value?.role)),
  // 메뉴와 라우트는 역할로 가릅니다. DIRECTOR는 관리자 화면만, 그 외는 업무 화면만 봅니다.
  isAdmin: computed(() => session.value?.role === 'DIRECTOR'),
  // 로그인 직후·차단된 주소에서 돌려보낼 역할별 첫 화면입니다.
  homePath: computed(() => (session.value?.role === 'DIRECTOR' ? '/admin/dashboard' : '/dashboard')),
}

export function warehouseApi(path, options) {
  if (!auth.warehouseId.value) throw new Error('로그인한 센터를 확인해 주세요.')
  return api(`/warehouses/${auth.warehouseId.value}${path}`, options)
}

/** 센터 범위의 파일 내려받기(발주서 PDF 등). 응답이 JSON 이 아니라 파일이라 downloadFile 을 씁니다. */
export function warehouseDownload(path, options) {
  if (!auth.warehouseId.value) throw new Error('로그인한 센터를 확인해 주세요.')
  return downloadFile(`/warehouses/${auth.warehouseId.value}${path}`, options)
}
