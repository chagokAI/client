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
    meta: { title: '대시보드' },
  },
  {
    path: '/boxes',
    component: () => import('@/views/boxes/BoxManagementView.vue'),
    children: [
      { path: '', redirect: '/boxes/matching' },
      {
        path: 'matching',
        name: 'box-matching',
        component: () => import('@/views/boxes/BoxMatchingView.vue'),
        meta: { title: '박스 규격/매칭', description: '상품 규격을 분석하고 가장 알맞은 택배 상자를 매칭합니다.' },
      },
      {
        path: 'inventory',
        name: 'box-inventory',
        component: () => import('@/views/boxes/BoxInventoryView.vue'),
        meta: { title: '박스 재고 관리', description: '보유 중인 택배 상자 재고를 규격별로 확인하고 관리합니다.' },
      },
      {
        path: 'specs',
        name: 'box-specs',
        component: () => import('@/views/boxes/BoxSpecView.vue'),
        meta: { title: '박스 규격 관리', description: '물류센터에서 사용하는 택배 상자 규격 정보를 등록하고 관리합니다.' },
      },
    ],
  },
  {
    path: '/orders',
    name: 'box-order',
    component: () => import('@/views/BoxOrderView.vue'),
    meta: { title: '박스 주문' },
  },
  {
    path: '/purchase-orders',
    name: 'purchase-orders',
    component: () => import('@/views/PurchaseOrderHistoryView.vue'),
    meta: { title: '발주서 이력' },
  },
  {
    path: '/digital-twin',
    name: 'digital-twin',
    component: () => import('@/views/DigitalTwinView.vue'),
    meta: { title: '디지털트윈' },
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
    if (session && to.name === 'login') return { name: 'dashboard' }
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
  // 중첩 라우트에서는 자식의 title이 우선합니다.
  const title = to.matched.findLast((record) => record.meta.title)?.meta.title
  document.title = title ? `${title} · 차곡 CHAGOK` : '차곡 CHAGOK'
})

export default router
