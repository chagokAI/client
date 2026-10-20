<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import NotificationPanel from './NotificationPanel.vue'
import ProfileMenu from './ProfileMenu.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { notificationRow } from '@/api/adapters'
import AppToast from '@/components/common/AppToast.vue'
const currentUser = computed(() => auth.session.value ?? {})

const router = useRouter()

const navItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/boxes', label: '박스 관리' },
  { to: '/orders', label: '박스 주문' },
  { to: '/purchase-orders', label: '발주서 이력' },
]

const notifications = ref([])
const unreadCount = ref(0)
const toastMessage = ref('')
const isPanelOpen = ref(false)
const isProfileOpen = ref(false)
const centerId = computed(() => auth.warehouseId.value ?? '')
const bellArea = useTemplateRef('bellArea')
const profileArea = useTemplateRef('profileArea')

async function loadNotifications() {
  try {
    const { data } = await warehouseApi('/notifications', { query: { size: 20 } })
    notifications.value = data.items.map(notificationRow); unreadCount.value = data.unreadCount
  } catch (error) { toastMessage.value = error.message }
}

function markAllAsRead() {
  toastMessage.value = '알림 읽음 처리는 아직 사용할 수 없어요.'
}

function handleViewAll() {
  isPanelOpen.value = false
  // TODO: 알림 전체 목록 페이지가 생기면 해당 경로로 이동시킵니다.
}

// 패널 바깥을 누르거나 Esc를 누르면 닫습니다.
function handleDocumentClick(event) {
  if (isPanelOpen.value && !bellArea.value?.contains(event.target)) isPanelOpen.value = false
  if (isProfileOpen.value && !profileArea.value?.contains(event.target)) isProfileOpen.value = false
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  isPanelOpen.value = false
  isProfileOpen.value = false
}

// 벨과 프로필 메뉴는 동시에 열리지 않습니다.
function toggleNotifications() {
  if (!isPanelOpen.value) loadNotifications()
  isProfileOpen.value = false
  isPanelOpen.value = !isPanelOpen.value
}

function toggleProfile() {
  isPanelOpen.value = false
  isProfileOpen.value = !isProfileOpen.value
}

function handleProfileSelect() {
  isProfileOpen.value = false
  // TODO: 내 정보 · 알림 설정 · 비밀번호 변경 화면이 생기면 해당 경로로 이동시킵니다.
}

onMounted(() => {
  loadNotifications()
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})

async function handleLogout() {
  try { await auth.logout(); await router.replace('/login') }
  catch (error) { toastMessage.value = error.message }
  isProfileOpen.value = false
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <RouterLink class="app-header__logo" to="/dashboard" aria-label="차곡 대시보드로 이동">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path fill="#ffb64d" d="M24 2 45 14 24 26 3 14Z" />
          <path fill="#b87b3e" d="M3 17 22 28v20L3 37Z" />
          <path fill="#694023" d="m26 28 19-11v20L26 48Z" />
          <path fill="#ffe0a0" d="m15 7 20 12-7 4L8 11Z" />
        </svg>
      </RouterLink>

      <nav class="app-header__nav" aria-label="주요 메뉴">
        <RouterLink v-for="item in navItems" :key="item.to" class="app-header__nav-link" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="app-header__aside">
        <div ref="bellArea" class="app-header__bell-area">
          <button
            class="app-header__bell"
            type="button"
            :aria-label="unreadCount ? `알림 ${unreadCount}건` : '알림'"
            :aria-expanded="isPanelOpen"
            @click="toggleNotifications"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13h12l-1.5-3V7A4.5 4.5 0 0 0 10 2.5ZM8.2 15.5a1.9 1.9 0 0 0 3.6 0"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span v-if="unreadCount" class="app-header__badge">{{ unreadCount }}</span>
          </button>

          <div v-if="isPanelOpen" class="app-header__panel">
            <NotificationPanel
              :notifications="notifications"
              :unread-count="unreadCount"
              @read-all="markAllAsRead"
              @view-all="handleViewAll"
            />
          </div>
        </div>

        <div ref="profileArea" class="app-header__profile-area">
          <button
            class="app-header__avatar"
            type="button"
            :aria-label="`${currentUser.name} 계정 메뉴`"
            :aria-expanded="isProfileOpen"
            @click="toggleProfile"
          />

          <div v-if="isProfileOpen" class="app-header__panel">
            <ProfileMenu
              :center-id="centerId"
              @select="handleProfileSelect"
              @logout="handleLogout"
            />
          </div>
        </div>
      </div>
    </div>
    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--color-navy);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 20px;
  max-width: var(--layout-max-width);
  height: var(--header-height);
  margin: 0 auto;
  padding: 0 var(--layout-gutter);
}

.app-header__logo {
  display: inline-flex;
  flex: none;
}

.app-header__logo svg {
  width: 30px;
  height: 30px;
}

.app-header__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.app-header__nav-link {
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  color: #c7ccd4;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 160ms ease, color 160ms ease;
}

.app-header__nav-link:hover {
  color: var(--color-white);
}

.app-header__nav-link.router-link-active {
  background: #35404f;
  color: var(--color-white);
  font-weight: 700;
}

.app-header__aside {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}

.app-header__bell-area,
.app-header__profile-area {
  position: relative;
  display: flex;
}

.app-header__bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #e4e7eb;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.app-header__bell:hover {
  background: #35404f;
  color: var(--color-white);
}

.app-header__bell svg {
  width: 20px;
  height: 20px;
}

.app-header__badge {
  position: absolute;
  top: 1px;
  right: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  color: var(--color-white);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.app-header__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 60;
}

.app-header__avatar {
  width: 32px;
  height: 32px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: #e8cfae;
  cursor: pointer;
  transition: filter 160ms ease;
}

.app-header__avatar:hover {
  filter: brightness(1.06);
}

@media (max-width: 1100px) {
  .app-header__inner {
    padding: 0 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-header__nav-link,
  .app-header__bell,
  .app-header__avatar {
    transition: none;
  }
}
</style>
