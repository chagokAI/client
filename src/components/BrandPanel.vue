<script setup>
import BrandLogo from './BrandLogo.vue'
</script>

<template>
  <aside class="brand-panel" aria-label="차곡 소개">
    <BrandLogo />

    <div class="brand-panel__introduction">
      <h2>딱 맞는 상자에<br /><span>차곡차곡</span>.</h2>
      <p class="brand-panel__description">AI 박스 추천과 에이전트 기반 박스 최적화를 만듭니다.</p>
      <p class="brand-panel__english" lang="en">
        Packing logistics neatly, with AI.<br />
        We pick the right box for every item and design better boxes from data.
      </p>
    </div>

    <small class="brand-panel__copyright">© {{ new Date().getFullYear() }} CHAGOK. All rights reserved.</small>
  </aside>
</template>

<style scoped>
.brand-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: 64px clamp(32px, 5.56vw, 80px) 60px;
  background: var(--color-navy);
  color: var(--color-white);
}

.brand-panel__introduction {
  align-self: center;
}

.brand-panel__introduction h2 {
  margin: 0 0 16px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -1px;
}

.brand-panel__introduction h2 span {
  color: var(--color-gold);
}

.brand-panel__description {
  margin: 0 0 14px;
  color: #e4d7c6;
  font-size: 14px;
  line-height: 1.6;
  word-break: keep-all;
}

.brand-panel__english {
  margin: 0;
  color: #a4acb7;
  font-size: 12px;
  line-height: 1.6;
}

.brand-panel__copyright {
  color: #a4acb7;
  font-size: 11px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .brand-panel {
    gap: 36px;
    grid-template-rows: auto auto;
    padding: 28px 28px 32px;
  }

  .brand-panel__introduction h2 {
    margin-bottom: 12px;
    font-size: 26px;
  }

  .brand-panel__description {
    margin: 0;
    font-size: 13px;
  }

  .brand-panel__english,
  .brand-panel__copyright {
    display: none;
  }
}
</style>
