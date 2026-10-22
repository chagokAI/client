<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth } from '@/stores/auth'
import BrandPanel from '../components/BrandPanel.vue'
import LoginForm from '../components/LoginForm.vue'

const router = useRouter()
const route = useRoute()
const message = ref(route.query.connection ? '서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.' : '')
const busy = ref(false)

async function handleLogin(input) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await auth.login(input)
    const redirect =
      typeof route.query.redirect === 'string' &&
      route.query.redirect.startsWith('/') &&
      !route.query.redirect.startsWith('//')
        ? route.query.redirect
        : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    message.value = error.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <BrandPanel />

    <main class="login-page__main">
      <LoginForm :message="message" :busy="busy" @submit="handleLogin" @change="message = ''" />
    </main>

    <footer class="login-page__mobile-footer">© {{ new Date().getFullYear() }} CHAGOK. All rights reserved.</footer>
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
