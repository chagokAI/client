import { ref } from 'vue'
import { apiUrl } from '@/api/client'
import { notificationRow } from '@/api/rows'
import { warehouseApi } from '@/stores/auth'
import { createNotificationFeed } from '@/notifications/feed'

const items = ref([])
const unreadCount = ref(0)
const error = ref('')
const revision = ref(0)
const incoming = ref(null)
const saving = ref(false)
let feed = null

function stop() {
  feed?.stop()
  feed = null
  items.value = []
  unreadCount.value = 0
  incoming.value = null
  error.value = ''
}

function start(warehouseId) {
  stop()
  if (!warehouseId) return
  feed = createNotificationFeed(
    apiUrl(`/warehouses/${warehouseId}/notifications/stream`),
    async (signal) => (await warehouseApi('/notifications', { signal, query: { size: 20 } })).data,
    (data) => {
      items.value = data.items.map(notificationRow)
      unreadCount.value = data.unreadCount
      revision.value++
    },
    {
      onNotification: (item) => (incoming.value = item),
      onError: (message) => (error.value = message),
    },
  )
  feed.start()
}

async function markRead(item) {
  if (!item.unread) return
  await warehouseApi(`/notifications/${item.id}/read`, { method: 'PATCH' })
  await feed?.refresh()
}

async function markAllRead() {
  if (saving.value) return
  saving.value = true
  try {
    await warehouseApi('/notifications/read-all', { method: 'POST' })
    await feed?.refresh()
  } finally {
    saving.value = false
  }
}

// 벨·전체 목록·다른 탭의 읽음 처리가 같은 서버 상태를 사용한다.
export const notifications = {
  items,
  unreadCount,
  error,
  revision,
  incoming,
  saving,
  start,
  stop,
  markRead,
  markAllRead,
  refresh: () => feed?.refresh(),
}

export function notificationTarget(link) {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null
  // 기존 재고 알림 링크를 현재의 통합 관리 화면으로 연결한다. 라이브 출처 쿼리도 보존한다.
  return link.replace(/^\/boxes\/inventory(?=[?#]|$)/, '/boxes/specs')
}
