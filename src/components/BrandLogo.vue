<template>
  <div class="brand-logo" aria-label="차곡 CHAGOK">
    <svg class="brand-logo__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path fill="#ffb64d" d="M24 2 45 14 24 26 3 14Z" />
      <path fill="#b87b3e" d="M3 17 22 28v20L3 37Z" />
      <path fill="#694023" d="m26 28 19-11v20L26 48Z" />
      <path fill="#ffe0a0" d="m15 7 20 12-7 4L8 11Z" />
    </svg>
    <span aria-hidden="true">CHAGOK</span>
  </div>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  color: var(--color-white);
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.brand-logo__mark {
  width: 44px;
  height: 44px;
  flex: none;
}
</style>
