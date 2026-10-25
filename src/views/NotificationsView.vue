<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import Pagination from '@/components/common/Pagination.vue'
import ApiState from '@/components/common/ApiState.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import { warehouseApi } from '@/stores/auth'
import { notifications, notificationTarget } from '@/stores/notifications'
import { notificationRow } from '@/api/rows'
import { useListQuery } from '@/composables/useListQuery'

const router = useRouter()
const category = ref('')
const unreadOnly = ref(false)
const items = ref([])
const total = ref(0)
const toast = ref('')
const { unreadCount, saving } = notifications
const filters = [
  { value: '', label: '전체' },
  { value: 'INVENTORY', label: '재고' },
  { value: 'PURCHASE', label: '발주' },
  { value: 'AI', label: 'AI' },
  { value: 'MATCHING', label: '매칭' },
]
const description = computed(() => `읽지 않은 알림 ${unreadCount.value}건 · 조회 결과 ${total.value}건`)
const { loading, error, page, totalPages, refresh } = useListQuery(
  [category, unreadOnly],
  (signal, page) =>
    warehouseApi('/notifications', {
      signal,
      query: { category: category.value, unreadOnly: unreadOnly.value, page, size: 20 },
    }),
  ({ data }) => {
    items.value = data.items.map(notificationRow)
    total.value = data.totalElements
    // 마지막 페이지의 미읽음이 사라지거나 라이브 기록이 정리되면 유효한 페이지로 돌아간다.
    if (page.value > Math.max(1, data.totalPages)) page.value = Math.max(1, data.totalPages)
    return data.totalPages
  },
)
watch(notifications.revision, refresh)

async function open(item) {
  try {
    await notifications.markRead(item)
    const target = notificationTarget(item.link)
    if (target) await router.push(target)
    else await refresh()
  } catch (error) {
    toast.value = error.message
  }
}
async function readAll() {
  try {
    await notifications.markAllRead()
    await refresh()
  } catch (error) {
    toast.value = error.message
  }
}
</script>

<template>
  <section class="notifications-view">
    <PageHeader title="전체 알림" :description="description">
      <template #actions>
        <AppButton variant="secondary" :disabled="saving || !unreadCount" @click="readAll">모두 읽음</AppButton>
      </template>
    </PageHeader>
    <div class="notifications-view__filters">
      <FilterChips v-model="category" :options="filters" aria-label="알림 분류" />
      <label class="notifications-view__unread"><input v-model="unreadOnly" type="checkbox" /> 미읽음만 보기</label>
    </div>
    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <p v-if="!loading && !error && !items.length" class="notifications-view__empty">해당하는 알림이 없습니다.</p>
    <ul v-else class="notifications-view__list" :aria-busy="loading">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="notifications-view__item"
          :class="{ 'notifications-view__item--unread': item.unread }"
          @click="open(item)"
        >
          <span class="notifications-view__category">{{ item.category }}</span>
          <span class="notifications-view__body">
            <strong>{{ item.title }}</strong>
            <span>{{ item.detail }}</span>
            <time :datetime="item.createdAt">{{ item.time }}</time>
          </span>
          <span class="notifications-view__status">{{ item.unread ? '읽지 않음' : '읽음' }}</span>
        </button>
      </li>
    </ul>
    <Pagination v-if="totalPages > 1" v-model="page" :total-pages="totalPages" />
    <AppToast v-if="toast" :key="toast" :message="toast" @close="toast = ''" />
  </section>
</template>

<style scoped>
.notifications-view__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.notifications-view__unread {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.notifications-view__list {
  padding: 0;
  margin: 0 0 24px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  list-style: none;
  background: var(--color-white);
}
.notifications-view__list li + li {
  border-top: 1px solid var(--color-divider);
}
.notifications-view__item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  padding: 20px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.notifications-view__item--unread {
  background: #fff8f0;
}
.notifications-view__item:hover {
  background: var(--color-cream);
}
.notifications-view__category {
  flex: none;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-cream-strong);
  color: var(--color-brown);
  font-size: 12px;
}
.notifications-view__body {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.notifications-view__body strong {
  font-size: 14px;
}
.notifications-view__body > span {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.notifications-view__body time,
.notifications-view__status {
  font-size: 12px;
  color: var(--color-text-muted);
}
.notifications-view__status {
  flex: none;
}
.notifications-view__empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-muted);
}
@media (max-width: 600px) {
  .notifications-view__item {
    gap: 10px;
    padding: 16px 12px;
  }
  .notifications-view__status {
    font-size: 10px;
  }
}
</style>
