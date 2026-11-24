<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import AppIcon from '@/components/app_icon.vue'

const route = useRoute()
const nav = [
  { name: 'orders', label: '订单', icon: 'order', path: '/orders' },
  { name: 'glazes', label: '釉料库', icon: 'glaze', path: '/glazes' },
]
const currentTitle = computed(() => (route.meta.title as string) ?? '工坊')
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">掐</span>
        <div>
          <div class="brand-name">珐琅图稿工坊</div>
          <div class="brand-sub">Cloisonné Workbench</div>
        </div>
      </div>
      <nav class="nav">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.name === item.name }"
        >
          <AppIcon :name="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-foot">毫米单位 · 本地存储</div>
    </aside>
    <main class="main">
      <header class="topbar">
        <h1 class="page-title">{{ currentTitle }}</h1>
      </header>
      <div class="content">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
}
.sidebar {
  width: 224px;
  flex-shrink: 0;
  background: var(--c-panel);
  border-right: 1px solid var(--c-border);
  display: flex;
  flex-direction: column;
  padding: var(--sp-5) var(--sp-4);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-2) var(--sp-5);
}
.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--c-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
}
.brand-name {
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
}
.brand-sub {
  font-size: var(--fs-xs);
  color: var(--c-text-3);
}
.nav {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-3);
  border-radius: var(--radius);
  color: var(--c-text-2);
  text-decoration: none;
  font-size: var(--fs-sm);
  transition:
    background var(--t-fast),
    color var(--t-fast);
}
.nav-item:hover {
  background: var(--c-panel-2);
  color: var(--c-text);
}
.nav-item.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: var(--fw-medium);
}
.sidebar-foot {
  margin-top: auto;
  padding: var(--sp-4) var(--sp-2) 0;
  font-size: var(--fs-xs);
  color: var(--c-text-3);
  border-top: 1px solid var(--c-border);
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 var(--sp-6);
  border-bottom: 1px solid var(--c-border);
  background: var(--c-panel);
}
.page-title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
}
.content {
  flex: 1;
  overflow: auto;
  padding: var(--sp-6);
}
</style>
