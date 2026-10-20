<script setup>
defineProps({
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
  emptyText: {
    type: String,
    default: '표시할 데이터가 없습니다.',
  },
})
</script>

<template>
  <div class="data-table" :class="{ 'data-table--flush': flush }">
    <table class="data-table__table">
      <colgroup>
        <col v-for="column in columns" :key="column.key" :style="column.width ? { width: column.width } : undefined" />
      </colgroup>

      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :style="{ textAlign: column.align || 'left' }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="!rows.length">
          <td class="data-table__empty" :colspan="columns.length">{{ emptyText }}</td>
        </tr>

        <tr
          v-for="(row, rowIndex) in rows"
          v-else
          :key="row[rowKey] ?? rowIndex"
          :class="{ 'data-table__row--highlight': row.highlight }"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            :style="{ textAlign: column.align || 'left' }"
          >
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
}

.data-table--flush {
  border: 0;
  border-radius: 0;
}

.data-table__table {
  width: 100%;
  min-width: 720px;
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

.data-table__empty {
  padding: 48px 20px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
