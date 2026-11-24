<script setup lang="ts">
// 统一线性图标：stroke 1.7、圆角端点，中性色，禁 emoji
defineProps<{ name: string }>()
</script>

<template>
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'order'">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </template>
    <template v-else-if="name === 'wire'">
      <path d="M4 18c4-12 12-12 16 0" />
      <circle cx="4" cy="18" r="1.4" />
      <circle cx="20" cy="18" r="1.4" />
    </template>
    <template v-else-if="name === 'glaze'">
      <path d="M12 3l5 8a5 5 0 1 1-10 0z" />
    </template>
    <template v-else-if="name === 'fire'">
      <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-4 1-7 1-9z" />
    </template>
    <template v-else-if="name === 'polish'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </template>
    <template v-else-if="name === 'ticket'">
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z" />
      <path d="M13 5v14" stroke-dasharray="2 2" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'warn'">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17.5v.5" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
      <path d="M4 19h16" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>
