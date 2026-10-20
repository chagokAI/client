import { computed, ref } from 'vue'
import { api, clearCsrf } from '../api/client.js'

const session = ref(null)
let checked = false
let checking = null

async function restore() {
  if (checked) return session.value
  if (!checking) checking = api('/auth/me').then(({ data }) => {
    session.value = data; checked = true; return data
  }).catch((error) => {
    if (error.status !== 401) throw error
    session.value = null; checked = true; return null
  }).finally(() => { checking = null })
  return checking
}

async function login(input) {
  const { data } = await api('/auth/login', { method: 'POST', body: input })
  session.value = data; checked = true
  return data
}

async function logout() {
  await api('/auth/logout', { method: 'POST' })
  session.value = null; checked = true; clearCsrf()
}

export function resetSession() { session.value = null; checked = false; clearCsrf() }

export const auth = {
  session, restore, login, logout,
  warehouseId: computed(() => session.value?.warehouse?.id ?? null),
  canEdit: computed(() => ['OPERATOR', 'ADMIN'].includes(session.value?.role)),
}

export function warehouseApi(path, options) {
  if (!auth.warehouseId.value) throw new Error('로그인한 센터를 확인해 주세요.')
  return api(`/warehouses/${auth.warehouseId.value}${path}`, options)
}
