<script setup>
import { computed, ref } from 'vue'
import FilterChips from '../common/FilterChips.vue'

const props = defineProps({
  unreadCount: { type: Number, default: 0 },
  // { id, category, title, detail, time, unread } 형태의 배열
  notifications: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['read-all', 'view-all'])

const activeFilter = ref('all')

const filterOptions = [
  { value: 'all', label: '전체' },
  { value: '재고', label: '재고' },
  { value: '발주', label: '발주' },
  { value: 'AI · 매칭', label: 'AI · 매칭' },
]

// 'AI · 매칭' 칩 하나로 AI와 매칭 알림을 함께 봅니다.
const visibleNotifications = computed(() => {
  if (activeFilter.value === 'all') return props.notifications
  if (activeFilter.value === 'AI · 매칭') {
    return props.notifications.filter((item) => item.category === 'AI' || item.category === '매칭')
  }
  return props.notifications.filter((item) => item.category === activeFilter.value)
})
</script>

<template>
  <div class="notification-panel">
    <header class="notification-panel__header">
      <h2 class="notification-panel__title">
        알림
        <span v-if="unreadCount" class="notification-panel__count">{{ unreadCount }}</span>
      </h2>
      <button class="notification-panel__read-all" type="button" disabled title="읽음 처리는 준비 중이에요">
        모두 읽음
      </button>
    </header>

    <div class="notification-panel__filters">
      <FilterChips v-model="activeFilter" :options="filterOptions" aria-label="알림 분류" />
    </div>

    <ul class="notification-panel__list">
      <li v-if="!visibleNotifications.length" class="notification-panel__empty">해당하는 알림이 없습니다.</li>

      <li
        v-for="notification in visibleNotifications"
        v-else
        :key="notification.id"
        class="notification-panel__item"
        :class="{ 'notification-panel__item--unread': notification.unread }"
      >
        <span class="notification-panel__category" :class="`notification-panel__category--${notification.tone}`">
          {{ notification.category }}
        </span>

        <div class="notification-panel__content">
          <p class="notification-panel__item-title">{{ notification.title }}</p>
          <p class="notification-panel__detail">{{ notification.detail }}</p>
          <p class="notification-panel__time">{{ notification.time }}</p>
        </div>

        <span v-if="notification.unread" class="notification-panel__dot" aria-label="읽지 않음" />
      </li>
    </ul>

    <footer class="notification-panel__footer">
      <button class="notification-panel__view-all" type="button" @click="emit('view-all')">알림 전체 보기</button>
    </footer>
  </div>
</template>

<style scoped>
.notification-panel {
  width: 380px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-popover);
  overflow: hidden;
}

.notification-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 10px;
}

.notification-panel__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
}

.notification-panel__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  color: var(--color-white);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.notification-panel__read-all {
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.notification-panel__read-all:hover {
  color: var(--color-brown);
  text-decoration: underline;
}

.notification-panel__filters {
  padding: 0 18px 12px;
}

.notification-panel__list {
  max-height: 420px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.notification-panel__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--color-divider);
}

.notification-panel__item--unread {
  background: #fff8f0;
}

.notification-panel__category {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 20px;
  flex: none;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.notification-panel__category--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.notification-panel__category--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.notification-panel__category--info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.notification-panel__category--neutral {
  background: var(--color-neutral-bg);
  color: var(--color-neutral-text);
}

.notification-panel__content {
  flex: 1;
  min-width: 0;
}

.notification-panel__item-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  word-break: keep-all;
}

.notification-panel__detail {
  margin: 3px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  word-break: keep-all;
}

.notification-panel__time {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.notification-panel__dot {
  width: 6px;
  height: 6px;
  flex: none;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--color-danger);
}

.notification-panel__empty {
  padding: 40px 18px;
  border-top: 1px solid var(--color-divider);
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}

.notification-panel__footer {
  border-top: 1px solid var(--color-divider);
}

.notification-panel__view-all {
  width: 100%;
  padding: 14px;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.notification-panel__view-all:hover {
  background: var(--color-cream);
  color: var(--color-text);
}
</style>
