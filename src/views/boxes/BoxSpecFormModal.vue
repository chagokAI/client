<script setup>
import { computed, reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import SelectField from '@/components/common/SelectField.vue'
// 크기 분류(S/M/L)는 서버가 내경 부피로 정합니다. 화면에서는 현재 값만 보여 줍니다.
const SIZE_CLASS = { S: '소형 (S)', M: '중형 (M)', L: '대형 (L)' }

const props = defineProps({
  suppliers: { type: Array, default: () => [] },
  // 재질 선택지는 서버 코드 목록(/box-materials)입니다. 라벨을 그대로 보내면 400입니다.
  materials: { type: Array, default: () => [] },
  busy: Boolean,
  // 수정할 규격. null이면 새 규격 등록으로 동작합니다.
  spec: {
    type: Object,
    default: null,
  },
})

const editableSuppliers = computed(() =>
  props.spec?.supplierId ? props.suppliers.filter((s) => s.value) : props.suppliers,
)

const emit = defineEmits(['close', 'save'])

const isEditing = Boolean(props.spec)

const form = reactive({
  code: props.spec?.code ?? '',
  sizeName: props.spec?.sizeName ?? '',
  width: props.spec?.width ?? '',
  depth: props.spec?.depth ?? '',
  height: props.spec?.height ?? '',
  material: props.spec?.material ?? props.materials[0]?.value ?? '',
  supplier: props.spec?.supplierId ?? '',
  unitPriceKrw: props.spec?.unitPriceKrw ?? 0,
  initialOnHandQty: 0,
  // 수정할 때는 목록이 함께 받아 온 현재 안전 재고를 그대로 보여 줍니다.
  safetyQty: props.spec?.configuredSafetyQty ?? '',
  targetQty: props.spec?.configuredTargetQty ?? '',
  kind: props.spec?.custom ? 'custom' : 'standard',
  inUse: props.spec ? props.spec.isActive : true,
  description: props.spec?.description ?? '',
})

function handleSave() {
  if (props.busy) return
  emit('save', { ...form })
}
</script>

<template>
  <BaseModal
    :title="isEditing ? '박스 규격 수정' : '박스 규격 등록'"
    :description="
      isEditing
        ? `${spec.code} · ${spec.sizeName} · 연결 상품 ${spec.linkedProducts}개`
        : '새 박스 규격 정보를 입력하세요.'
    "
    width="600px"
    @close="emit('close')"
  >
    <template v-if="form.kind === 'custom'" #title-badge>
      <span class="custom-mark" title="자체 제작 규격" aria-label="자체 제작 규격">★</span>
    </template>

    <form class="spec-form" novalidate @submit.prevent="handleSave">
      <div class="spec-form__row">
        <div class="field">
          <label class="field__label" for="spec-code">박스 규격명 <span class="field__required">*</span></label>
          <input id="spec-code" v-model="form.code" class="field__input" type="text" required />
        </div>

        <div class="field">
          <label class="field__label" for="spec-size-name">박스 사이즈명 <span class="field__required">*</span></label>
          <input id="spec-size-name" v-model="form.sizeName" class="field__input" type="text" required />
        </div>
      </div>

      <div class="field">
        <span class="field__label">내경 사이즈 (mm) <span class="field__required">*</span></span>
        <div class="dimensions">
          <div class="dimensions__input">
            <input v-model="form.width" type="number" min="0" aria-label="가로 (mm)" required />
            <span class="dimensions__unit">가로</span>
          </div>
          <span class="dimensions__times" aria-hidden="true">×</span>
          <div class="dimensions__input">
            <input v-model="form.depth" type="number" min="0" aria-label="세로 (mm)" required />
            <span class="dimensions__unit">세로</span>
          </div>
          <span class="dimensions__times" aria-hidden="true">×</span>
          <div class="dimensions__input">
            <input v-model="form.height" type="number" min="0" aria-label="높이 (mm)" required />
            <span class="dimensions__unit">높이</span>
          </div>
        </div>
      </div>

      <div class="spec-form__row">
        <div class="field">
          <span class="field__label">재질 <span class="field__required">*</span></span>
          <SelectField v-model="form.material" :options="materials" width="100%" aria-label="재질" />
        </div>

        <div class="field">
          <span class="field__label">공급사</span>
          <SelectField v-model="form.supplier" :options="editableSuppliers" width="100%" aria-label="공급사" />
        </div>
      </div>

      <div class="spec-form__row">
        <div class="field">
          <span class="field__label">규격 구분</span>
          <div class="radio-group">
            <label class="radio">
              <input v-model="form.kind" type="radio" value="standard" name="spec-kind" />
              <span>표준 규격</span>
            </label>
            <label class="radio">
              <input v-model="form.kind" type="radio" value="custom" name="spec-kind" />
              <span>커스텀 규격</span>
            </label>
          </div>
        </div>

        <div class="field">
          <span class="field__label">사용 여부</span>
          <label class="toggle">
            <input v-model="form.inUse" type="checkbox" />
            <span class="toggle__track" aria-hidden="true"><span class="toggle__thumb" /></span>
            <span class="toggle__text">{{ form.inUse ? '사용 중' : '미사용' }}</span>
          </label>
        </div>
      </div>

      <div class="spec-form__row">
        <div class="field">
          <label class="field__label" for="spec-price">단가 (원)</label
          ><input
            id="spec-price"
            v-model.number="form.unitPriceKrw"
            class="field__input"
            type="number"
            min="0"
            step="1"
            required
          />
        </div>
        <div class="field">
          <span class="field__label">크기 분류</span>
          <p class="field__readonly">
            {{ SIZE_CLASS[spec?.sizeClass] ?? '내경 크기로 자동 분류' }}
          </p>
        </div>
      </div>
      <div v-if="isEditing" class="spec-form__row">
        <div class="field">
          <label class="field__label" for="spec-safety-edit">안전 재고 (개)</label
          ><input
            id="spec-safety-edit"
            v-model.number="form.safetyQty"
            class="field__input"
            type="number"
            min="0"
            step="1"
            placeholder="비우면 기본 7일분 자동 계산"
          />
        </div>
        <div class="field">
          <span class="field__label">현재 재고</span>
          <p class="field__readonly">{{ spec.current }}</p>
        </div>
      </div>

      <div v-if="isEditing" class="field">
        <label class="field__label" for="spec-target-edit">목표 재고 (개, 선택)</label>
        <input
          id="spec-target-edit"
          v-model.number="form.targetQty"
          class="field__input"
          type="number"
          min="0"
          step="1"
          placeholder="비우면 납품일까지 소모 + 안전 재고"
        />
      </div>
      <div v-if="!isEditing" class="spec-form__row">
        <div class="field">
          <label class="field__label" for="spec-stock">초기 재고 (개)</label
          ><input
            id="spec-stock"
            v-model.number="form.initialOnHandQty"
            class="field__input"
            type="number"
            min="0"
            step="1"
          />
        </div>
        <div class="field">
          <label class="field__label" for="spec-safety">안전 재고 (개, 선택)</label
          ><input
            id="spec-safety"
            v-model.number="form.safetyQty"
            class="field__input"
            type="number"
            min="0"
            step="1"
            placeholder="비우면 기본 7일분 자동 계산"
          />
        </div>
        <div class="field">
          <label class="field__label" for="spec-target">목표 재고 (개, 선택)</label
          ><input
            id="spec-target"
            v-model.number="form.targetQty"
            class="field__input"
            type="number"
            min="0"
            step="1"
            placeholder="비우면 납품일까지 소모 + 안전 재고"
          />
        </div>
      </div>

      <p class="spec-form__notice">
        안전 재고는 기본 7일분입니다. 목표 재고는 다음 납품일까지의 예상 소모에 안전 재고를 더합니다. 확정 납품일이
        없으면 5일을 기준으로 계산합니다. 수량을 직접 입력하면 해당 값을 우선합니다.
      </p>

      <div class="field">
        <label class="field__label" for="spec-description">간단 설명</label>
        <textarea id="spec-description" v-model="form.description" class="field__textarea" rows="3" />
      </div>

      <p v-if="isEditing && spec.linkedProducts > 0" class="spec-form__notice">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.2" />
          <path d="M8 4.8v3.6M8 10.9v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        저장하면 이 규격에 연결된 상품 {{ spec.linkedProducts }}개의 매칭 적합 여부와 비율이 다시 계산돼요.
      </p>
    </form>

    <template #footer>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="primary" :disabled="busy" @click="handleSave">저장하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.custom-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-cream-strong);
  color: var(--color-gold);
  font-size: 11px;
  line-height: 1;
}

.spec-form {
  display: grid;
  gap: 16px;
}

.spec-form__row {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field__label {
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.field__required {
  color: var(--color-gold);
}

.field__input,
.field__textarea,
.dimensions__input input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.field__input,
.dimensions__input input {
  height: 40px;
  padding: 0 14px;
}

.field__textarea {
  padding: 10px 14px;
  line-height: 1.5;
  resize: vertical;
}

.field__readonly {
  display: flex;
  align-items: center;
  height: 40px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.field__input:focus,
.field__textarea:focus,
.dimensions__input input:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.dimensions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dimensions__input {
  position: relative;
  flex: 1;
  min-width: 0;
}

.dimensions__input input {
  padding-right: 44px;
  appearance: textfield;
}

.dimensions__input input::-webkit-outer-spin-button,
.dimensions__input input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.dimensions__unit {
  position: absolute;
  top: 50%;
  right: 12px;
  color: var(--color-text-muted);
  font-size: 12px;
  transform: translateY(-50%);
  pointer-events: none;
}

.dimensions__times {
  color: var(--color-text-muted);
  font-size: 13px;
}

.radio-group {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 40px;
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  cursor: pointer;
}

.radio input {
  appearance: none;
  display: grid;
  place-content: center;
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1px solid var(--color-text-muted);
  border-radius: 50%;
  background: var(--color-white);
  cursor: pointer;
}

.radio input:checked {
  border-color: var(--color-brown);
}

.radio input:checked::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-brown);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  font-size: 13px;
  cursor: pointer;
}

.toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.toggle__track {
  display: inline-flex;
  align-items: center;
  width: 40px;
  height: 22px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: #d5d9df;
  transition: background-color 160ms ease;
}

.toggle__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-white);
  transition: transform 160ms ease;
}

.toggle input:checked + .toggle__track {
  background: var(--color-brown);
}

.toggle input:checked + .toggle__track .toggle__thumb {
  transform: translateX(18px);
}

.toggle input:focus-visible + .toggle__track {
  outline: 3px solid var(--color-gold);
  outline-offset: 2px;
}

.spec-form__notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  word-break: keep-all;
}

.spec-form__notice svg {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 1px;
  color: var(--color-gold);
}

@media (prefers-reduced-motion: reduce) {
  .field__input,
  .field__textarea,
  .dimensions__input input,
  .toggle__track,
  .toggle__thumb {
    transition: none;
  }
}
</style>
