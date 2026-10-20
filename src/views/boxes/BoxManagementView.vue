<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import TabNav from '@/components/common/TabNav.vue'

const route = useRoute()

const tabs = [
  { to: '/boxes/matching', label: '박스 규격/매칭' },
  { to: '/boxes/inventory', label: '박스 재고 관리' },
  { to: '/boxes/specs', label: '박스 규격 관리' },
]

// 탭마다 설명 문구와 우측 액션이 달라서 라우트 메타에서 가져옵니다.
const description = computed(() => route.meta.description ?? '')
</script>

<template>
  <div class="box-management">
    <PageHeader title="박스 관리" :description="description">
      <template #actions>
        <!-- 규격 관리 탭에서만 '+ 규격 추가' 버튼이 필요해 자식 뷰가 이 자리를 채웁니다. -->
        <div id="box-management-actions" />
      </template>
    </PageHeader>

    <TabNav :tabs="tabs" aria-label="박스 관리 하위 메뉴" />

    <RouterView />
  </div>
</template>
