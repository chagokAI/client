<script setup>
import { computed } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import InlineNotice from '@/components/common/InlineNotice.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { auth } from '@/stores/auth'

// 계정 정보는 로그인 세션(/auth/me) 값을 그대로 보여 줍니다. 수정 API가 없어 조회 전용입니다.
const ROLE = { VIEWER: '조회자', OPERATOR: '운영자', ADMIN: '관리자' }

const user = computed(() => auth.session.value ?? {})
const role = computed(() => ROLE[user.value.role] ?? user.value.role ?? '—')

// wide 항목은 두 칸을 모두 차지합니다.
const accountItems = computed(() => [
  { id: 'name', label: '이름', value: user.value.name },
  { id: 'employee', label: '사번', value: user.value.employeeId },
  { id: 'department', label: '부서', value: user.value.department },
  { id: 'job', label: '직함', value: user.value.jobTitle },
  { id: 'warehouse', label: '소속', value: user.value.warehouse?.name, wide: true },
])
</script>

<template>
  <div class="profile">
    <PageHeader title="내 정보" />

    <AppCard :padded="false">
      <div class="profile__layout">
        <aside class="profile__identity">
          <span class="profile__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" stroke-width="1.6" />
              <path
                d="M4.75 19.5c.9-3.4 3.8-5.5 7.25-5.5s6.35 2.1 7.25 5.5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <p class="profile__name">{{ user.name ?? '—' }}</p>
          <span class="profile__role">{{ role }}</span>
          <p class="profile__meta">{{ user.employeeId ?? '—' }}</p>
        </aside>

        <section class="profile__details">
          <h2 class="profile__title">계정 정보</h2>

          <dl class="profile__list">
            <div
              v-for="item in accountItems"
              :key="item.id"
              class="profile__item"
              :class="{ 'profile__item--wide': item.wide }"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value || '—' }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </AppCard>

    <InlineNotice class="profile__notice"> 계정 정보나 권한을 바꾸려면 시스템 관리자에게 요청해 주세요. </InlineNotice>
  </div>
</template>

<style scoped>
.profile__layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
}

/* 왼쪽 프로필 영역 */
.profile__identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 24px;
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  background: var(--color-cream);
  text-align: center;
}

.profile__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #e8cfae;
  color: var(--color-brown);
}

.profile__avatar svg {
  width: 36px;
  height: 36px;
}

.profile__name {
  margin: 16px 0 0;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.4px;
}

.profile__role {
  display: inline-flex;
  align-items: center;
  height: 22px;
  margin-top: 8px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  background: var(--color-cream-strong);
  color: var(--color-brown);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.profile__meta {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

/* 오른쪽 정보 영역 */
.profile__details {
  min-width: 0;
  padding: 24px 28px 28px;
}

.profile__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.profile__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
  margin: 0;
}

.profile__item {
  min-width: 0;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-divider);
}

.profile__item--wide {
  grid-column: 1 / -1;
  border-bottom: 0;
}

.profile__item dt {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.profile__item dd {
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile__notice {
  margin-top: 20px;
}

@media (max-width: 760px) {
  .profile__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile__identity {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .profile__list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
