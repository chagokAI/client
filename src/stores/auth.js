import { computed, ref } from 'vue'
import { api, clearCsrf } from '../api/client.js'

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
  // 관리자 전용 화면(센터 통합 현황·리포트)은 이 값으로 메뉴와 라우트를 함께 막습니다.
  // TODO: 개발 중에는 역할과 무관하게 모든 메뉴를 보려고 관리자로 취급합니다.
  //       권한을 실제로 나눌 때 import.meta.env.DEV 분기를 지웁니다. (운영 빌드는 영향 없음)
  isAdmin: computed(() => import.meta.env.DEV || session.value?.role === 'DIRECTOR'),
}

export function warehouseApi(path, options) {
  if (!auth.warehouseId.value) throw new Error('로그인한 센터를 확인해 주세요.')
  return api(`/warehouses/${auth.warehouseId.value}${path}`, options)
}
