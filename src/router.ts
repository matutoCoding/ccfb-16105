import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/orders' },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/pages/order_list_page.vue'),
      meta: { title: '订单' },
    },
    {
      path: '/wire-design/:orderId',
      name: 'wire-design',
      component: () => import('@/pages/wire_design_page.vue'),
      meta: { title: '丝工图' },
    },
    {
      path: '/glazes',
      name: 'glazes',
      component: () => import('@/pages/glaze_library_page.vue'),
      meta: { title: '釉料库' },
    },
    {
      path: '/firing/:orderId',
      name: 'firing',
      component: () => import('@/pages/firing_preview_page.vue'),
      meta: { title: '点蓝烧制预览' },
    },
    {
      path: '/finish/:orderId',
      name: 'finish',
      component: () => import('@/pages/finish_page.vue'),
      meta: { title: '磨光镀金' },
    },
    {
      path: '/work-order/:orderId',
      name: 'work-order',
      component: () => import('@/pages/work_order_page.vue'),
      meta: { title: '出工单' },
    },
  ],
})
