<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandPanel from '../components/BrandPanel.vue'
import LoginForm from '../components/LoginForm.vue'

const router = useRouter()
const message = ref('')

function handleLogin() {
  // TODO: submit 이벤트의 { employeeId, password, rememberMe }를 받아 인증 API에 연결합니다.
  // 인증이 붙기 전까지는 입력값 검증만 통과하면 대시보드로 이동합니다.
  message.value = ''
  router.push('/dashboard')
}
</script>

<template>
  <div class="login-page">
    <BrandPanel />

    <main class="login-page__main">
      <LoginForm :message="message" @submit="handleLogin" @change="message = ''" />
    </main>

    <footer class="login-page__mobile-footer">
      © {{ new Date().getFullYear() }} CHAGOK. All rights reserved.
    </footer>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: 5fr 4fr;
  min-height: 100vh;
  min-height: 100svh;
}

.login-page__main {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 64px clamp(32px, 5vw, 72px);
}

.login-page__mobile-footer {
  display: none;
}

@media (max-width: 760px) {
  .login-page {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
  }

  .login-page__main {
    padding: 40px 28px 32px;
  }

  .login-page__mobile-footer {
    display: block;
    padding: 0 24px 24px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.6;
    text-align: center;
  }
}
</style>
