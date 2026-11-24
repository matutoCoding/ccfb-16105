<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
  }>(),
  { variant: 'ghost', size: 'md', disabled: false },
)
</script>

<template>
  <button class="btn" :class="[`btn-${variant}`, `btn-${size}`]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
  background: var(--c-panel);
  color: var(--c-text);
  transition:
    background var(--t-fast),
    border-color var(--t-fast),
    color var(--t-fast);
}
.btn:hover:not(:disabled) {
  border-color: var(--c-text-3);
  background: var(--c-panel-2);
}
.btn:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 1px;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-md {
  padding: var(--sp-2) var(--sp-4);
  font-size: var(--fs-sm);
}
.btn-sm {
  padding: var(--sp-1) var(--sp-3);
  font-size: var(--fs-xs);
}
.btn-primary {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
  border-color: var(--c-primary-hover);
}
.btn-danger {
  color: var(--c-danger);
  border-color: var(--c-danger-soft);
}
.btn-danger:hover:not(:disabled) {
  background: var(--c-danger-soft);
  border-color: var(--c-danger);
}
</style>
