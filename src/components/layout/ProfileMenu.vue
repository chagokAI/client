<script setup>
import SelectField from '../common/SelectField.vue'
import ToggleSwitch from '../common/ToggleSwitch.vue'
import { computed } from 'vue'
import { auth } from '@/stores/auth'
import { useNotificationSetting } from '@/composables/useNotificationSetting'

const { isEnabled: notificationsEnabled, setEnabled: setNotificationsEnabled } = useNotificationSetting()

const currentUser = computed(() => ({
  ...auth.session.value,
  initial: auth.session.value?.name?.slice(0, 1) ?? '',
  team: auth.session.value?.department ?? '',
  role: { VIEWER: '조회자', OPERATOR: '운영자', DIRECTOR: '관리자' }[auth.session.value?.role] ?? '',
}))
// 컨트롤 타워는 서버 센터 목록에 없는 화면 전용 선택지입니다.
const centerOptions = computed(() => [
  ...(auth.session.value?.warehouses ?? []).map((w) => ({ value: w.id, label: w.name })),
  { value: 'control-tower', label: '컨트롤 타워' },
])

defineProps({
  centerId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:centerId', 'select', 'logout'])

const menuItems = [{ id: 'profile', label: '내 정보' }]
</script>

<template>
  <div class="profile-menu">
    <header class="profile-menu__header">
      <span class="profile-menu__avatar" aria-hidden="true">{{ currentUser.initial }}</span>

      <div class="profile-menu__identity">
        <p class="profile-menu__name">
          {{ currentUser.name }}
          <span class="profile-menu__role">{{ currentUser.role }}</span>
        </p>
        <p class="profile-menu__meta">{{ currentUser.employeeId }} · {{ currentUser.team }}</p>
      </div>
    </header>

    <div class="profile-menu__center">
      <span class="profile-menu__center-label">물류센터</span>
      <SelectField
        :model-value="centerId"
        :options="centerOptions"
        width="160px"
        aria-label="물류센터 선택"
        @update:model-value="emit('update:centerId', $event)"
      />
    </div>

    <ul class="profile-menu__list">
      <li v-for="item in menuItems" :key="item.id">
        <button class="profile-menu__item" type="button" @click="emit('select', item.id)">
          {{ item.label }}
        </button>
      </li>
      <li class="profile-menu__setting">
        <span>알림 받기</span>
        <ToggleSwitch
          :model-value="notificationsEnabled"
          aria-label="알림 받기"
          @update:model-value="setNotificationsEnabled"
        />
      </li>
    </ul>

    <footer class="profile-menu__footer">
      <button class="profile-menu__item profile-menu__item--logout" type="button" @click="emit('logout')">
        로그아웃
      </button>
    </footer>
  </div>
</template>

<style scoped>
.profile-menu {
  width: 280px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-popover);
  overflow: hidden;
}

.profile-menu__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
}

.profile-menu__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  background: #e8cfae;
  color: var(--color-brown);
  font-size: 15px;
  font-weight: 700;
}

.profile-menu__identity {
  min-width: 0;
}

.profile-menu__name {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.profile-menu__role {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--color-cream-strong);
  color: var(--color-brown);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.profile-menu__meta {
  margin: 3px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.profile-menu__center {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--color-divider);
  background: var(--color-cream);
}

.profile-menu__center-label {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.profile-menu__list {
  margin: 0;
  padding: 6px 0;
  border-top: 1px solid var(--color-divider);
  list-style: none;
}

.profile-menu__item {
  width: 100%;
  padding: 11px 18px;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.profile-menu__item:hover {
  background: var(--color-cream);
}

.profile-menu__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 18px;
  color: var(--color-text);
  font-size: 13px;
}

.profile-menu__footer {
  border-top: 1px solid var(--color-divider);
  padding: 6px 0;
}

.profile-menu__item--logout {
  color: var(--color-danger);
  font-weight: 600;
}

.profile-menu__item--logout:hover {
  background: var(--color-danger-bg);
}
</style>
