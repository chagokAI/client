<script setup>
import { computed } from 'vue'

// 화면 전반에서 쓰이는 상태 라벨을 색 계열로 묶어 둡니다.
// info(정상 진행) · warning(확인 필요) · danger(문제) · success(완료) · neutral(해당 없음)
const TONE_BY_LABEL = {
  '매칭 완료': 'info',
  '사용 중': 'info',
  충분: 'info',
  '배송 중': 'info',
  '검토 필요': 'warning',
  주의: 'warning',
  '승인 대기': 'warning',
  '승인 완료': 'warning',
  미매칭: 'danger',
  부족: 'danger',
  '입고 완료': 'success',
  미사용: 'neutral',
}

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  // 표에 없는 라벨이거나 색을 직접 지정하고 싶을 때 넘깁니다.
  tone: {
    type: String,
    default: '',
  },
})

const resolvedTone = computed(() => props.tone || TONE_BY_LABEL[props.label] || 'neutral')
</script>

<template>
  <span class="status-badge" :class="`status-badge--${resolvedTone}`">{{ label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.status-badge--info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.status-badge--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.status-badge--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.status-badge--success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.status-badge--neutral {
  background: var(--color-neutral-bg);
  color: var(--color-neutral-text);
}
</style>
