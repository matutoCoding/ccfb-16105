<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { CellGlazeConfig, CellGlazeStop, Glaze } from '@/core/types'
import AppButton from '@/components/app_button.vue'

const props = defineProps<{
  cellId: number
  glazes: Glaze[]
  config: CellGlazeConfig | undefined
}>()

const emit = defineEmits<{ save: [cfg: CellGlazeConfig] }>()

const form = reactive<{
  stops: CellGlazeStop[]
  blendAngle: number
  blendWidth: number
  coats: number
}>({
  stops: [],
  blendAngle: 0,
  blendWidth: 0.4,
  coats: 3,
})

watch(
  () => props.config,
  (cfg) => {
    if (cfg) {
      form.stops = cfg.stops.map((s) => ({ ...s }))
      form.blendAngle = cfg.blendAngle
      form.blendWidth = cfg.blendWidth
      form.coats = cfg.coats
    } else {
      form.stops = props.glazes[0]
        ? [{ glazeId: props.glazes[0].id, offset: 0 }]
        : []
      form.blendAngle = 0
      form.blendWidth = 0.4
      form.coats = 3
    }
  },
  { immediate: true },
)

const addStop = () => {
  if (form.stops.length >= 3) return
  const used = new Set(form.stops.map((s) => s.glazeId))
  const candidate = props.glazes.find((g) => !used.has(g.id))
  if (!candidate) return
  form.stops.push({
    glazeId: candidate.id,
    offset: form.stops.length === 0 ? 0 : 1,
  })
}

const removeStop = (index: number) => {
  form.stops.splice(index, 1)
}

const save = () => {
  if (form.stops.length === 0) return
  const sorted = [...form.stops].sort((a, b) => a.offset - b.offset)
  sorted[0].offset = 0
  sorted[sorted.length - 1].offset = 1
  emit('save', {
    cellId: props.cellId,
    stops: sorted,
    blendAngle: (form.blendAngle * Math.PI) / 180,
    blendWidth: form.blendWidth,
    coats: form.coats,
  })
}

const swatch = (id: string) => props.glazes.find((g) => g.id === id)?.color
</script>

<template>
  <div class="panel">
    <h4 class="title">格 #{{ cellId }} 点蓝配方</h4>

    <div class="stops">
      <div v-for="(stop, i) in form.stops" :key="i" class="stop-row">
        <span class="dot" :style="{ background: `rgb(${swatch(stop.glazeId)?.join(',')})` }" />
        <select v-model="stop.glazeId" class="select">
          <option v-for="g in glazes" :key="g.id" :value="g.id">
            {{ g.code }} {{ g.name }}{{ g.opaque ? '' : '（透）' }}
          </option>
        </select>
        <input
          v-model.number="stop.offset"
          type="number"
          step="0.05"
          min="0"
          max="1"
          class="mini"
          title="停色位置 0-1"
        />
        <button class="icon-btn" @click="removeStop(i)">×</button>
      </div>
    </div>
    <AppButton size="sm" :disabled="form.stops.length >= 3" @click="addStop">
      加一色（最多三色晕染）
    </AppButton>

    <label class="field">
      晕染方向（度）
      <input v-model.number="form.blendAngle" type="number" min="0" max="360" class="input" />
    </label>
    <label class="field">
      过渡宽度
      <input v-model.number="form.blendWidth" type="range" min="0.05" max="1" step="0.05" />
      <span class="range-val">{{ form.blendWidth.toFixed(2) }}</span>
    </label>
    <label class="field">
      填釉遍数
      <input v-model.number="form.coats" type="number" min="1" max="8" class="input" />
    </label>
    <AppButton variant="primary" size="sm" @click="save">应用配方</AppButton>
  </div>
</template>

<style scoped>
.panel {
  border-top: 1px solid var(--c-border);
  padding-top: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}
.stops {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.stop-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.dot {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  flex-shrink: 0;
}
.select {
  flex: 1;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: var(--sp-1) var(--sp-2);
  font-size: var(--fs-xs);
  background: var(--c-panel);
}
.mini {
  width: 56px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: var(--sp-1);
  font-size: var(--fs-xs);
}
.icon-btn {
  border: none;
  background: none;
  color: var(--c-text-3);
  font-size: var(--fs-md);
  padding: 0 var(--sp-1);
}
.icon-btn:hover {
  color: var(--c-danger);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--c-text-2);
}
.input {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2);
  font-size: var(--fs-sm);
}
.input:focus {
  outline: none;
  border-color: var(--c-primary);
}
.range-val {
  color: var(--c-text-3);
}
</style>
