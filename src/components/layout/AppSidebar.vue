<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NotificationPanel from './NotificationPanel.vue'
import ProfileMenu from './ProfileMenu.vue'
import AppToast from '@/components/common/AppToast.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { notificationRow } from '@/api/adapters'
import { useSidebar } from '@/composables/useSidebar'

const { isCollapsed, isMobileOpen, toggle, expand, openMobile, closeMobile } = useSidebar()
const route = useRoute()
const router = useRouter()

const currentUser = computed(() => auth.session.value ?? {})
const centerId = computed(() => auth.warehouseId.value ?? '')

const navItems = [
  { to: '/dashboard', label: '실시간 센터 현황', icon: 'M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-3.5v-4h-5v4H4a1 1 0 0 1-1-1Z' },
  { to: '/boxes/specs', label: '박스 재고/규격 관리', icon: 'M3 7.5h14M3 7.5v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M3 7.5 5 4h10l2 3.5M8 11h4' },
  {
    label: '주문 관리',
    icon: 'M3.5 4h2l1.6 8.4a1 1 0 0 0 1 .8h6.3a1 1 0 0 0 1-.8L16.8 7H6.3M8 16.5h.01M14 16.5h.01',
    children: [
      { to: '/orders', label: '박스 주문' },
      { to: '/purchase-orders', label: '발주서 이력 관리' },
    ],
  },
  { to: '/boxes/matching', label: '물품-박스 매칭 현황', icon: 'M4 5.5h.01M4 10h.01M4 14.5h.01M7.5 5.5H17M7.5 10H17M7.5 14.5H17' },
]

// 하위 카테고리가 있는 메뉴는 기본으로 펼쳐 둡니다.
const openGroups = ref(navItems.filter(item => item.children).map(item => item.label))

function hasActiveChild(item) {
  return !!item.children?.some(child => route.path === child.to)
}

function isGroupOpen(item) {
  return openGroups.value.includes(item.label)
}

// 상위 카테고리는 펼치고 접기만 합니다. 이동은 하위 메뉴에서만 일어납니다.
function toggleGroup(item) {
  // 아이콘만 남은 드로어에서는 하위 메뉴가 보이도록 드로어부터 펼칩니다.
  if (isCollapsed.value) {
    expand()
    if (!isGroupOpen(item)) openGroups.value = [...openGroups.value, item.label]
    return
  }

  openGroups.value = isGroupOpen(item)
    ? openGroups.value.filter(label => label !== item.label)
    : [...openGroups.value, item.label]
}

// 주소로 바로 들어온 경우에도 해당 그룹은 펼쳐 둡니다.
watch(
  () => route.path,
  () => {
    const labels = navItems.filter(hasActiveChild).map(item => item.label)
    const added = labels.filter(label => !openGroups.value.includes(label))
    if (added.length) openGroups.value = [...openGroups.value, ...added]
  },
  { immediate: true },
)

const notifications = ref([])
const unreadCount = ref(0)
const toastMessage = ref('')
const isPanelOpen = ref(false)
const isProfileOpen = ref(false)
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
  closeMobile()
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

async function handleLogout() {
  try { await auth.logout(); await router.replace('/login') }
  catch (error) { toastMessage.value = error.message }
  isProfileOpen.value = false
}

// 모바일에서는 메뉴를 고르면 드로어를 닫습니다.
watch(() => route.fullPath, closeMobile)

onMounted(() => {
  loadNotifications()
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="sidebar-root" :class="{ 'sidebar-root--open': isMobileOpen }">
    <div class="sidebar__scrim" @click="closeMobile" />

    <button class="sidebar__fab" type="button" aria-label="메뉴 열기" @click="openMobile">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <aside class="sidebar" :class="{ 'sidebar--collapsed': isCollapsed }">
      <div class="sidebar__head">
        <RouterLink class="sidebar__logo" to="/dashboard" aria-label="차곡 대시보드로 이동">
          <svg class="sidebar__logo-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path fill="#ffb64d" d="M24 2 45 14 24 26 3 14Z" />
            <path fill="#b87b3e" d="M3 17 22 28v20L3 37Z" />
            <path fill="#694023" d="m26 28 19-11v20L26 48Z" />
            <path fill="#ffe0a0" d="m15 7 20 12-7 4L8 11Z" />
          </svg>
          <span class="sidebar__logo-text">차곡 CHAGOK</span>
        </RouterLink>

        <button
          class="sidebar__toggle"
          type="button"
          :aria-label="isCollapsed ? '메뉴 펼치기' : '메뉴 접기'"
          :aria-expanded="!isCollapsed"
          @click="toggle"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              :d="isCollapsed ? 'M4 10h11m-4-4 4 4-4 4' : 'M16 10H5m4-4-4 4 4 4'"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav class="sidebar__nav" aria-label="주요 메뉴">
        <template v-for="item in navItems" :key="item.to ?? item.label">
          <RouterLink
            v-if="!item.children"
            class="sidebar__link"
            :to="item.to"
            :title="isCollapsed ? item.label : null"
          >
            <svg class="sidebar__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                :d="item.icon"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="sidebar__label">{{ item.label }}</span>
          </RouterLink>

          <template v-else>
            <button
              class="sidebar__link sidebar__link--group"
              :class="{ 'sidebar__link--has-active': hasActiveChild(item) }"
              type="button"
              :aria-expanded="isGroupOpen(item)"
              :title="isCollapsed ? item.label : null"
              @click="toggleGroup(item)"
            >
              <svg class="sidebar__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  :d="item.icon"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span class="sidebar__label">{{ item.label }}</span>
              <svg class="sidebar__chevron" :class="{ 'sidebar__chevron--open': isGroupOpen(item) }" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m8 6 4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <RouterLink
              v-for="child in (isGroupOpen(item) ? item.children : [])"
              :key="child.to"
              class="sidebar__link sidebar__link--child"
              :to="child.to"
            >
              <span class="sidebar__label">{{ child.label }}</span>
            </RouterLink>
          </template>
        </template>
      </nav>

      <div class="sidebar__foot">
        <div ref="bellArea" class="sidebar__slot">
          <button
            class="sidebar__action"
            type="button"
            :aria-label="unreadCount ? `알림 ${unreadCount}건` : '알림'"
            :aria-expanded="isPanelOpen"
            :title="isCollapsed ? '알림' : null"
            @click="toggleNotifications"
          >
            <span class="sidebar__action-icon">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5v3L4 13h12l-1.5-3V7A4.5 4.5 0 0 0 10 2.5ZM8.2 15.5a1.9 1.9 0 0 0 3.6 0"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span v-if="unreadCount" class="sidebar__badge">{{ unreadCount }}</span>
            </span>
            <span class="sidebar__label">알림</span>
          </button>

          <div v-if="isPanelOpen" class="sidebar__panel">
            <NotificationPanel
              :notifications="notifications"
              :unread-count="unreadCount"
              @read-all="markAllAsRead"
              @view-all="handleViewAll"
            />
          </div>
        </div>

        <div ref="profileArea" class="sidebar__slot">
          <button
            class="sidebar__action"
            type="button"
            :aria-label="`${currentUser.name} 계정 메뉴`"
            :aria-expanded="isProfileOpen"
            :title="isCollapsed ? currentUser.name : null"
            @click="toggleProfile"
          >
            <span class="sidebar__avatar" />
            <span class="sidebar__label sidebar__label--name">{{ currentUser.name }}</span>
          </button>

          <div v-if="isProfileOpen" class="sidebar__panel">
            <ProfileMenu
              :center-id="centerId"
              @select="handleProfileSelect"
              @logout="handleLogout"
            />
          </div>
        </div>
      </div>
    </aside>

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100vh;
  height: 100svh;
  padding: 0 12px 16px;
  background: var(--color-navy);
  transition: width 180ms ease;
}

.sidebar--collapsed {
  width: var(--sidebar-width-collapsed);
  padding: 0 10px 16px;
}

.sidebar__head {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--header-height);
  flex: none;
}

.sidebar--collapsed .sidebar__head {
  justify-content: center;
}

.sidebar__logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-decoration: none;
}

.sidebar--collapsed .sidebar__logo {
  display: none;
}

.sidebar__logo-mark {
  width: 28px;
  height: 28px;
  flex: none;
}

.sidebar__logo-text {
  color: var(--color-white);
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}

.sidebar__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #c7ccd4;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.sidebar__toggle:hover {
  background: #35404f;
  color: var(--color-white);
}

.sidebar__toggle svg {
  width: 18px;
  height: 18px;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  min-height: 0;
  overflow-y: auto;
}

.sidebar__link,
.sidebar__action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: #c7ccd4;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.sidebar--collapsed .sidebar__link,
.sidebar--collapsed .sidebar__action {
  justify-content: center;
  padding: 10px 0;
}

.sidebar__link:hover,
.sidebar__action:hover {
  background: #2a3545;
  color: var(--color-white);
}

.sidebar__link.router-link-active {
  background: #35404f;
  color: var(--color-white);
  font-weight: 700;
}

.sidebar__icon {
  width: 20px;
  height: 20px;
  flex: none;
}

.sidebar--collapsed .sidebar__label {
  display: none;
}

.sidebar__chevron {
  width: 16px;
  height: 16px;
  flex: none;
  margin-left: auto;
  transition: transform 160ms ease;
}

.sidebar__chevron--open {
  transform: rotate(90deg);
}

.sidebar--collapsed .sidebar__chevron {
  display: none;
}

/* 하위 메뉴는 아이콘 자리만큼 들여써서 상위 카테고리와 구분합니다. */
.sidebar__link--child {
  padding-left: 42px;
  font-size: 13px;
}

/* 접힌 드로어에서는 아이콘만 남으므로 하위 메뉴를 숨깁니다. */
.sidebar--collapsed .sidebar__link--child {
  display: none;
}

.sidebar__link--has-active {
  color: var(--color-white);
}

/* 알림·프로필은 메뉴 목록과 구분되도록 드로어 아래쪽에 붙입니다. */
.sidebar__foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgb(255 255 255 / 10%);
}

.sidebar__slot {
  position: relative;
}

.sidebar__action-icon {
  position: relative;
  display: inline-flex;
  flex: none;
}

.sidebar__action-icon svg {
  width: 20px;
  height: 20px;
}

.sidebar__badge {
  position: absolute;
  top: -4px;
  right: -5px;
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

.sidebar__avatar {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: #e8cfae;
}

.sidebar__label--name {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 패널은 드로어 오른쪽 바깥으로 띄웁니다. */
.sidebar__panel {
  position: absolute;
  bottom: 0;
  left: calc(100% + 10px);
  z-index: 70;
}

.sidebar__scrim,
.sidebar__fab {
  display: none;
}

/* 좁은 화면에서는 본문 위를 덮는 오버레이 드로어로 동작합니다. */
@media (max-width: 900px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 180ms ease;
    box-shadow: var(--shadow-modal);
  }

  .sidebar--collapsed {
    width: var(--sidebar-width);
    padding: 0 12px 16px;
  }

  .sidebar--collapsed .sidebar__logo {
    display: inline-flex;
  }

  .sidebar--collapsed .sidebar__label {
    display: inline;
  }

  .sidebar--collapsed .sidebar__head {
    justify-content: flex-start;
  }

  .sidebar--collapsed .sidebar__link,
  .sidebar--collapsed .sidebar__action {
    justify-content: flex-start;
    padding: 10px 12px;
  }

  .sidebar--collapsed .sidebar__chevron {
    display: block;
  }

  .sidebar--collapsed .sidebar__link--child {
    display: flex;
    padding-left: 42px;
  }

  .sidebar__toggle {
    display: none;
  }

  .sidebar__panel {
    bottom: calc(100% + 10px);
    left: 0;
  }

  .sidebar__fab {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-sm);
    background: var(--color-white);
    color: var(--color-text-secondary);
    box-shadow: var(--shadow-card);
    cursor: pointer;
  }

  .sidebar__fab svg {
    width: 18px;
    height: 18px;
  }

  .sidebar-root--open .sidebar {
    transform: none;
  }

  .sidebar-root--open .sidebar__fab {
    display: none;
  }

  .sidebar-root--open .sidebar__scrim {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: block;
    background: rgb(32 42 56 / 45%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .sidebar__link,
  .sidebar__action,
  .sidebar__toggle {
    transition: none;
  }
}
</style>
