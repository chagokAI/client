<script setup>
import { computed } from 'vue'

const props = defineProps({
  // { key, label, width, align } 형태의 배열
  columns: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    default: () => [],
  },
  rowKey: {
    type: String,
    default: 'id',
  },
  // 테두리 없이 카드·모달 안쪽에 넣을 때 사용합니다.
  flush: {
    type: Boolean,
    default: false,
  },
  // 열이 많아 좁은 화면에서 가로 스크롤이 필요한 표에 지정합니다. (예: '1440px')
  minWidth: {
    type: String,
    default: '720px',
  },
  emptyText: {
    type: String,
    default: '표시할 데이터가 없습니다.',
  },
  // 조회하는 동안 내용 대신 자리 표시줄을 보여 줍니다. 표 높이가 그대로라 화면이 흔들리지 않습니다.
  loading: {
    type: Boolean,
    default: false,
  },
  // 보여 줄 데이터가 아직 없을 때 그릴 자리 표시줄 줄 수입니다.
  skeletonRows: {
    type: Number,
    default: 5,
  },
})

// 이미 보고 있던 줄 수를 그대로 유지해, 조회 전후로 표 높이가 바뀌지 않게 합니다.
const skeletonCount = computed(() => props.rows.length || props.skeletonRows)

// 칸마다 길이를 달리해야 실제 내용처럼 보입니다.
const SKELETON_WIDTHS = ['72%', '54%', '86%', '62%', '78%', '48%']
</script>

<template>
  <div class="data-table" :class="{ 'data-table--flush': flush }">
    <table class="data-table__table" :style="{ minWidth }">
      <colgroup>
        <col v-for="column in columns" :key="column.key" :style="column.width ? { width: column.width } : undefined" />
      </colgroup>

      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col" :style="{ textAlign: column.align || 'left' }">
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <tbody v-if="loading" aria-busy="true">
        <tr v-for="line in skeletonCount" :key="`skeleton-${line}`">
          <td v-for="(column, columnIndex) in columns" :key="column.key">
            <span
              class="data-table__skeleton"
              :style="{ width: SKELETON_WIDTHS[columnIndex % SKELETON_WIDTHS.length] }"
            />
          </td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-if="!rows.length">
          <td class="data-table__empty" :colspan="columns.length">{{ emptyText }}</td>
        </tr>

        <tr
          v-for="(row, rowIndex) in rows"
          v-else
          :key="row[rowKey] ?? rowIndex"
          :class="{ 'data-table__row--highlight': row.highlight }"
        >
          <td v-for="column in columns" :key="column.key" :style="{ textAlign: column.align || 'left' }">
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="rowIndex">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table {
  overflow-x: auto;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
  /* 가로 스크롤바도 표 테두리·머리글과 같은 베이지 계열로 맞춥니다. */
  scrollbar-color: var(--color-border) var(--color-cream);
  scrollbar-width: thin;
}

.data-table::-webkit-scrollbar {
  height: 10px;
}

.data-table::-webkit-scrollbar-track {
  border-top: 1px solid var(--color-divider);
  background: var(--color-cream);
}

.data-table::-webkit-scrollbar-thumb {
  border: 2px solid var(--color-cream);
  border-radius: var(--radius-pill);
  background: var(--color-border);
}

.data-table::-webkit-scrollbar-thumb:hover {
  background: var(--color-gold);
}

.data-table--flush {
  border: 0;
  border-radius: 0;
}

.data-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table__table th {
  padding: 14px 16px;
  background: var(--color-cream);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.data-table--flush .data-table__table th:first-child,
.data-table__table th:first-child {
  padding-left: 20px;
}

.data-table__table th:last-child,
.data-table__table td:last-child {
  padding-right: 20px;
}

.data-table__table td {
  padding: 14px 16px;
  border-top: 1px solid var(--color-divider);
  color: var(--color-text);
  line-height: 1.5;
  vertical-align: middle;
}

.data-table__table td:first-child {
  padding-left: 20px;
}

.data-table__table tbody tr:first-child td {
  border-top: 0;
}

.data-table__row--highlight td {
  background: #fffaf2;
}

/* 조회 중 자리 표시줄. inline-block 이라 줄 높이가 실제 내용과 같습니다. */
.data-table__skeleton {
  display: inline-block;
  height: 12px;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--color-divider) 25%, var(--color-cream-strong) 37%, var(--color-divider) 63%);
  background-size: 400% 100%;
  vertical-align: middle;
  animation: data-table-shimmer 1.4s ease infinite;
}

@keyframes data-table-shimmer {
  from {
    background-position: 100% 50%;
  }

  to {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .data-table__skeleton {
    animation: none;
  }
}

.data-table__empty {
  padding: 48px 20px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
