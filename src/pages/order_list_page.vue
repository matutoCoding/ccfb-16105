<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/db/use_live_query'
import { deleteOrder, listOrders } from '@/services/order_service'
import { dayjs } from '@/libs'
import AppButton from '@/components/app_button.vue'
import AppIcon from '@/components/app_icon.vue'
import OrderFormModal from '@/components/order_form_modal.vue'
import { ref } from 'vue'
import type { Order } from '@/core/types'

const router = useRouter()
const orders = useLiveQuery(listOrders)
const showCreate = ref(false)

const bodyLabel: Record<Order['bodyType'], string> = {
  plate: '盘',
  vase: '瓶',
  figurine: '摆件',
}

const onDelete = async (id: string) => {
  if (window.confirm('删除订单会同时清掉丝工图与烧制配置，确认？')) {
    await deleteOrder(id)
  }
}

const go = (path: string) => router.push(path)
</script>

<template>
  <div class="page">
    <div class="head">
      <p class="head-desc">按胎型建档，录入胎面直径与曲率，导入客户原图作为描丝底图</p>
      <AppButton variant="primary" @click="showCreate = true">
        <AppIcon name="plus" />新建订单
      </AppButton>
    </div>

    <div v-if="orders && orders.length === 0" class="empty-card">
      <AppIcon name="order" />
      <div class="empty-title">还没有订单</div>
      <div class="empty-sub">新建第一个胎型订单，开始画丝工图</div>
    </div>

    <div v-else class="grid">
      <article v-for="order in orders" :key="order.id" class="card">
        <div class="card-head">
          <div>
            <div class="card-code">{{ order.code }}</div>
            <div class="card-title">{{ order.title }}</div>
          </div>
          <span class="tag">{{ bodyLabel[order.bodyType] }}</span>
        </div>
        <div class="card-meta">
          <div class="meta-row">
            <span class="meta-label">客户</span>
            <span>{{ order.customer }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">胎面直径</span>
            <span>{{ order.diameter }} mm</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">曲率</span>
            <span>{{ order.curvature === 0 ? '平面' : `R=${(1 / order.curvature).toFixed(1)}mm` }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">建档</span>
            <span>{{ dayjs(order.createdAt).format('YYYY-MM-DD') }}</span>
          </div>
        </div>
        <div class="card-actions">
          <AppButton size="sm" @click="go(`/wire-design/${order.id}`)">丝工图</AppButton>
          <AppButton size="sm" @click="go(`/firing/${order.id}`)">烧制</AppButton>
          <AppButton size="sm" @click="go(`/finish/${order.id}`)">镀金</AppButton>
          <AppButton size="sm" @click="go(`/work-order/${order.id}`)">工单</AppButton>
          <AppButton size="sm" variant="danger" @click="onDelete(order.id)">
            <AppIcon name="trash" />
          </AppButton>
        </div>
      </article>
    </div>

    <OrderFormModal v-if="showCreate" @close="showCreate = false" />
  </div>
</template>

<style scoped>
.page {
  max-width: 1100px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-5);
  gap: var(--sp-4);
}
.head-desc {
  margin: 0;
  color: var(--c-text-2);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--sp-4);
}
.card {
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  transition: box-shadow var(--t);
}
.card:hover {
  box-shadow: var(--shadow);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.card-code {
  font-size: var(--fs-xs);
  color: var(--c-text-3);
  letter-spacing: 0.4px;
}
.card-title {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  margin-top: var(--sp-1);
}
.tag {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-sm);
  padding: var(--sp-1) var(--sp-3);
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
}
.meta-row {
  display: flex;
  justify-content: space-between;
  padding: var(--sp-1) 0;
  color: var(--c-text-2);
}
.meta-label {
  color: var(--c-text-3);
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border);
}
.empty-card {
  border: 1px dashed var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-7);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-text-3);
  background: var(--c-panel);
}
.empty-title {
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  color: var(--c-text-2);
  margin-top: var(--sp-3);
}
.empty-sub {
  font-size: var(--fs-xs);
}
</style>
