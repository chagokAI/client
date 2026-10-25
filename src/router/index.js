import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import { auth, resetSession } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    // 로그인 화면은 좌우 2단 구성이라 공통 헤더 레이아웃을 쓰지 않습니다.
    meta: { layout: 'blank', title: '로그인' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '실시간 센터 현황', operator: true },
  },
  { path: '/boxes', redirect: '/boxes/specs' },
  { path: '/boxes/inventory', redirect: '/boxes/specs' },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/views/NotificationsView.vue'),
    meta: { title: '전체 알림' },
  },
  {
    path: '/boxes/matching',
    name: 'box-matching',
    component: () => import('@/views/boxes/BoxMatchingView.vue'),
    meta: {
      title: '물품-박스 매칭 현황',
      description: '상품 규격을 분석하고 가장 알맞은 택배 상자를 매칭합니다.',
      operator: true,
    },
  },
  {
    path: '/boxes/specs',
    name: 'box-management',
    component: () => import('@/views/boxes/BoxManagementView.vue'),
    meta: {
      title: '박스 재고/규격 관리',
      description: '택배 상자 규격 정보와 규격별 재고를 함께 확인하고 관리합니다.',
      operator: true,
    },
  },
  {
    path: '/orders',
    name: 'box-order',
    component: () => import('@/views/BoxOrderView.vue'),
    meta: { title: '박스 주문', operator: true },
  },
  {
    path: '/purchase-orders',
    name: 'purchase-orders',
    component: () => import('@/views/PurchaseOrderHistoryView.vue'),
    meta: { title: '발주서 이력 관리', operator: true },
  },
  // 관리자(DIRECTOR) 전용. meta.admin 이 붙은 경로는 아래 beforeEach 에서 막습니다.
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/views/admin/AdminDashboardView.vue'),
    meta: { title: '실시간 센터 현황', admin: true },
  },
  {
    path: '/admin/reports',
    name: 'admin-reports',
    component: () => import('@/views/admin/CenterReportView.vue'),
    meta: { title: '센터별 리포트/지침서', admin: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { title: '내 정보' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  try {
    const session = await auth.restore()
    if (!session && to.name !== 'login') return { name: 'login', query: { redirect: to.fullPath } }
    if (session && to.name === 'login') return auth.homePath.value
    // 역할 전용 화면은 주소로 바로 들어와도 막고, 그 역할의 첫 화면으로 돌려보냅니다.
    // (판정 기준은 메뉴와 같은 auth.isAdmin)
    if (to.meta.admin && !auth.isAdmin.value) return auth.homePath.value
    if (to.meta.operator && auth.isAdmin.value) return auth.homePath.value
  } catch {
    if (to.name !== 'login') return { name: 'login', query: { connection: 'unavailable' } }
  }
})

window.addEventListener('auth:expired', () => {
  const redirect = router.currentRoute.value.fullPath
  resetSession()
  if (router.currentRoute.value.name !== 'login') router.replace({ name: 'login', query: { redirect } })
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · 차곡 CHAGOK` : '차곡 CHAGOK'
})

export default router
