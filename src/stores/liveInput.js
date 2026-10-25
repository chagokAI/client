import { api } from '@/api/client'
import { auth } from '@/stores/auth'
import { createLiveInputSession } from '@/live/session'

let session = null
let owner = null

export function resetLiveInput() {
  session?.dispose()
  session = null
  owner = null
}

export function attachLiveInput(listener) {
  const warehouseId = auth.warehouseId.value
  const key = `${auth.session.value?.id}:${warehouseId}`
  if (!session || owner !== key) {
    resetLiveInput()
    owner = key
    // 로그인 사용자나 센터가 바뀌어도 이전 실행의 정지 요청은 원래 센터에만 보낸다.
    const path = `/warehouses/${warehouseId}/live-input`
    session = createLiveInputSession(
      async () => (await api(path)).data,
      async (running, { ownedOnly, controlId, ...options }) =>
        (await api(path, { method: 'PUT', body: { running, ownedOnly, controlId }, ...options })).data,
    )
  }
  return session.attach(listener)
}
