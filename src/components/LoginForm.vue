<script setup>
import { nextTick, reactive, useTemplateRef } from 'vue'

const props = defineProps({
  busy: Boolean,
  message: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['submit', 'change'])
const employeeIdInput = useTemplateRef('employeeIdInput')
const passwordInput = useTemplateRef('passwordInput')

const form = reactive({
  employeeId: '',
  password: '',
  rememberMe: false,
})

const errors = reactive({ employeeId: '', password: '' })

function clearError(field) {
  errors[field] = ''
  emit('change')
}

async function handleSubmit() {
  if (props.busy) return
  const employeeId = form.employeeId.trim()
  errors.employeeId = employeeId ? '' : '사내번호를 입력해 주세요.'
  errors.password = form.password ? '' : '비밀번호를 입력해 주세요.'

  if (errors.employeeId || errors.password) {
    await nextTick()
    const firstInvalidInput = errors.employeeId ? employeeIdInput : passwordInput
    firstInvalidInput.value?.focus()
    return
  }

  emit('submit', { ...form, employeeId })
}
</script>

<template>
  <form class="login-form" aria-labelledby="login-title" novalidate @submit.prevent="handleSubmit">
    <header class="login-form__header">
      <h1 id="login-title">로그인</h1>
      <p>차곡에 오신 것을 환영합니다.</p>
    </header>

    <div class="login-form__fields">
      <div class="form-field">
        <label for="employee-id">사내번호</label>
        <input
          id="employee-id"
          ref="employeeIdInput"
          v-model="form.employeeId"
          name="username"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          :spellcheck="false"
          placeholder="사내번호를 입력하세요 (예: CG-20231)"
          :aria-invalid="Boolean(errors.employeeId)"
          :aria-describedby="errors.employeeId ? 'employee-id-error' : undefined"
          required
          @input="clearError('employeeId')"
        />
        <p v-if="errors.employeeId" id="employee-id-error" class="form-field__error" role="alert">
          {{ errors.employeeId }}
        </p>
      </div>

      <div class="form-field">
        <label for="password">비밀번호</label>
        <input
          id="password"
          ref="passwordInput"
          v-model="form.password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="비밀번호를 입력하세요"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? 'password-error' : undefined"
          required
          @input="clearError('password')"
        />
        <p v-if="errors.password" id="password-error" class="form-field__error" role="alert">
          {{ errors.password }}
        </p>
      </div>
    </div>

    <label class="remember-me">
      <input v-model="form.rememberMe" name="remember-me" type="checkbox" @change="emit('change')" />
      <span>로그인 상태 유지</span>
    </label>

    <button class="login-form__submit" type="submit" :disabled="busy">{{ busy ? '로그인 중…' : '로그인' }}</button>

    <p v-if="message" class="login-form__message" role="status">{{ message }}</p>

    <p class="login-form__help">계정 발급이나 비밀번호 초기화는 시스템 관리자에게 문의하세요.</p>
  </form>
</template>

<style scoped>
.login-form {
  width: 100%;
  max-width: 400px;
}

.login-form__header {
  margin-bottom: 16px;
}

.login-form__header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.8px;
}

.login-form__header p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.login-form__fields {
  display: grid;
  gap: 14px;
}

.form-field {
  display: grid;
  gap: 4px;
}

.form-field label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.form-field input {
  width: 100%;
  min-width: 0;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-white);
  color: var(--color-text);
  font-size: 14px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.form-field input::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.form-field input:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.form-field input[aria-invalid='true'] {
  border-color: var(--color-error);
}

.form-field__error {
  margin: 2px 0 0;
  color: var(--color-error);
  font-size: 12px;
  line-height: 1.5;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  min-height: 24px;
  margin: 14px 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}

.remember-me input {
  appearance: none;
  display: grid;
  place-content: center;
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1px solid var(--color-text-muted);
  border-radius: 4px;
  background: var(--color-white);
  cursor: pointer;
}

.remember-me input:checked {
  border-color: var(--color-brown);
  background: var(--color-brown);
}

.remember-me input:checked::after {
  content: '';
  width: 4px;
  height: 8px;
  border: solid var(--color-white);
  border-width: 0 2px 2px 0;
  transform: translateY(-1px) rotate(45deg);
}

.login-form__submit {
  width: 100%;
  min-height: 41px;
  padding: 10px 16px;
  border: 0;
  border-radius: 8px;
  background: var(--color-brown);
  color: var(--color-white);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.login-form__submit:hover {
  background: #4d2e18;
}

.login-form__submit:active {
  background: #3c2413;
}

.login-form__message {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: #f8f3ed;
  color: var(--color-brown);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.login-form__help {
  margin: 16px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  word-break: keep-all;
}

@media (max-width: 760px) {
  .form-field input {
    height: 48px;
    font-size: 16px;
  }

  .remember-me {
    min-height: 44px;
    margin: 4px 0;
  }

  .login-form__submit {
    min-height: 48px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-field input,
  .login-form__submit {
    transition: none;
  }
}
</style>
