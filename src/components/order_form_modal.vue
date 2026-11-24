<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/app_button.vue'
import {
  createOrder,
  fileToDataUrl,
  type OrderInput,
} from '@/services/order_service'
import type { BodyType } from '@/core/types'

const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const saving = ref(false)
const error = ref('')

const form = reactive<OrderInput>({
  customer: '',
  bodyType: 'plate',
  diameter: 200,
  curvature: 0,
  title: '',
  referenceImage: null,
  unfoldWidth: 628,
  unfoldHeight: 300,
})

const bodyOptions: Array<{ value: BodyType; label: string }> = [
  { value: 'plate', label: '盘' },
  { value: 'vase', label: '瓶' },
  { value: 'figurine', label: '摆件' },
]

const onPickImage = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  form.referenceImage = await fileToDataUrl(file)
}

const submit = async () => {
  error.value = ''
  if (!form.customer.trim() || !form.title.trim()) {
    error.value = '客户名和作品名不能为空'
    return
  }
  if (form.diameter <= 0) {
    error.value = '胎面直径必须大于 0'
    return
  }
  saving.value = true
  try {
    const order = await createOrder({ ...form })
    emit('close')
    router.push(`/wire-design/${order.id}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal">
      <h2 class="modal-title">新建订单</h2>
      <div class="form">
        <label class="field">
          <span class="label">作品名</span>
          <input v-model="form.title" class="input" placeholder="如：山水纪念盘" />
        </label>
        <label class="field">
          <span class="label">客户</span>
          <input v-model="form.customer" class="input" placeholder="客户名称" />
        </label>
        <div class="row">
          <label class="field">
            <span class="label">胎型</span>
            <select v-model="form.bodyType" class="input">
              <option v-for="o in bodyOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <label class="field">
            <span class="label">胎面直径 (mm)</span>
            <input v-model.number="form.diameter" type="number" min="1" class="input" />
          </label>
        </div>
        <div class="row">
          <label class="field">
            <span class="label">曲率半径倒数 (1/mm)，平面填 0</span>
            <input v-model.number="form.curvature" type="number" step="0.0001" min="0" class="input" />
          </label>
        </div>
        <div v-if="form.bodyType === 'vase'" class="row">
          <label class="field">
            <span class="label">展开周长 (mm)</span>
            <input v-model.number="form.unfoldWidth" type="number" min="1" class="input" />
          </label>
          <label class="field">
            <span class="label">展开高度 (mm)</span>
            <input v-model.number="form.unfoldHeight" type="number" min="1" class="input" />
          </label>
        </div>
        <label class="field">
          <span class="label">客户原图（描丝底图）</span>
          <input type="file" accept="image/*" @change="onPickImage" />
        </label>
        <div v-if="form.referenceImage" class="preview">
          <img :src="form.referenceImage" alt="客户原图" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
      <div class="modal-actions">
        <AppButton @click="emit('close')">取消</AppButton>
        <AppButton variant="primary" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '建档并进入丝工图' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: 560px;
  max-width: calc(100vw - var(--sp-7));
  max-height: 86vh;
  overflow: auto;
  background: var(--c-panel);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  box-shadow: var(--shadow-lg);
}
.modal-title {
  margin: 0 0 var(--sp-5);
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.label {
  font-size: var(--fs-xs);
  color: var(--c-text-2);
  font-weight: var(--fw-medium);
}
.input {
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-sm);
  background: var(--c-panel);
  color: var(--c-text);
  transition: border-color var(--t-fast);
}
.input:focus {
  outline: none;
  border-color: var(--c-primary);
}
.preview img {
  max-height: 160px;
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
}
.error {
  color: var(--c-danger);
  margin: 0;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}
</style>
