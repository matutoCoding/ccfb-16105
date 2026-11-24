<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useLiveQuery } from '@/db/use_live_query'
import {
  createGlaze,
  deleteGlaze,
  listGlazes,
  seedGlazesIfEmpty,
} from '@/services/glaze_service'
import type { Glaze } from '@/core/types'
import AppButton from '@/components/app_button.vue'
import AppIcon from '@/components/app_icon.vue'

const glazes = useLiveQuery(listGlazes)
const showForm = ref(false)
const editing = ref<Glaze | null>(null)

const form = reactive({
  code: '',
  name: '',
  opaque: true,
  color: [30, 41, 59] as [number, number, number],
  ior: 1.5,
  remark: '',
})

const resetForm = () => {
  form.code = ''
  form.name = ''
  form.opaque = true
  form.color = [30, 41, 59]
  form.ior = 1.5
  form.remark = ''
  editing.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const onColor = (channel: 0 | 1 | 2, value: number) => {
  form.color[channel] = value
}

const submit = async () => {
  if (!form.code.trim() || !form.name.trim()) return
  if (editing.value) {
    await deleteGlaze(editing.value.id)
  }
  await createGlaze({
    code: form.code.trim(),
    name: form.name.trim(),
    opaque: form.opaque,
    color: [...form.color] as [number, number, number],
    ior: form.opaque ? undefined : form.ior,
    remark: form.remark,
  })
  showForm.value = false
  resetForm()
}

const remove = async (glaze: Glaze) => {
  if (window.confirm(`删除釉料 ${glaze.code} ${glaze.name}？已引用的格子会退成底色`)) {
    await deleteGlaze(glaze.id)
  }
}

const swatch = (c: [number, number, number]) =>
  `rgb(${c[0]}, ${c[1]}, ${c[2]})`

onMounted(seedGlazesIfEmpty)
</script>

<template>
  <div class="page">
    <div class="head">
      <p class="desc">按色号建档，透明釉与不透明釉分开；透明釉记录折射率用于反光计算</p>
      <AppButton variant="primary" @click="openCreate">
        <AppIcon name="plus" />新增釉料
      </AppButton>
    </div>

    <div v-if="glazes" class="groups">
      <section class="group">
        <h3 class="group-title">不透明釉</h3>
        <div class="grid">
          <article v-for="g in glazes.filter((x) => x.opaque)" :key="g.id" class="card">
            <div class="swatch" :style="{ background: swatch(g.color) }" />
            <div class="info">
              <div class="code">{{ g.code }}</div>
              <div class="name">{{ g.name }}</div>
              <div class="remark">{{ g.remark }}</div>
            </div>
            <AppButton size="sm" variant="danger" @click="remove(g)">
              <AppIcon name="trash" />
            </AppButton>
          </article>
        </div>
      </section>
      <section class="group">
        <h3 class="group-title">透明釉</h3>
        <div class="grid">
          <article v-for="g in glazes.filter((x) => !x.opaque)" :key="g.id" class="card">
            <div class="swatch transparent" :style="{ background: swatch(g.color) }" />
            <div class="info">
              <div class="code">{{ g.code }} <span class="ior">IOR {{ g.ior }}</span></div>
              <div class="name">{{ g.name }}</div>
              <div class="remark">{{ g.remark }}</div>
            </div>
            <AppButton size="sm" variant="danger" @click="remove(g)">
              <AppIcon name="trash" />
            </AppButton>
          </article>
        </div>
      </section>
    </div>

    <div v-if="showForm" class="mask" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">{{ editing ? '编辑' : '新增' }}釉料</h3>
        <div class="form">
          <label class="field">
            色号
            <input v-model="form.code" class="input" placeholder="如 OP-06" />
          </label>
          <label class="field">
            名称
            <input v-model="form.name" class="input" placeholder="釉色名称" />
          </label>
          <div class="seg">
            <button :class="{ on: form.opaque }" @click="form.opaque = true">不透明</button>
            <button :class="{ on: !form.opaque }" @click="form.opaque = false">透明</button>
          </div>
          <div class="color-row">
            <label v-for="(ch, i) in ['R', 'G', 'B']" :key="ch" class="field">
              {{ ch }}
              <input
                :value="form.color[i as 0 | 1 | 2]"
                type="number"
                min="0"
                max="255"
                class="input"
                @input="onColor(i as 0 | 1 | 2, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <div class="preview-swatch" :style="{ background: swatch(form.color) }" />
          </div>
          <label v-if="!form.opaque" class="field">
            折射率 IOR
            <input v-model.number="form.ior" type="number" step="0.01" min="1" max="2" class="input" />
          </label>
          <label class="field">
            备注
            <input v-model="form.remark" class="input" />
          </label>
        </div>
        <div class="modal-actions">
          <AppButton @click="showForm = false">取消</AppButton>
          <AppButton variant="primary" @click="submit">保存</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-5);
}
.desc {
  margin: 0;
  color: var(--c-text-2);
}
.groups {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}
.group-title {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
  padding-bottom: var(--sp-2);
  border-bottom: 1px solid var(--c-border);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-3);
}
.card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
  box-shadow: var(--shadow-sm);
}
.swatch {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
  flex-shrink: 0;
}
.swatch.transparent {
  background-image:
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%);
  background-size: 10px 10px;
}
.info {
  flex: 1;
  min-width: 0;
}
.code {
  font-weight: var(--fw-semibold);
  font-size: var(--fs-sm);
}
.ior {
  color: var(--c-text-3);
  font-weight: var(--fw-normal);
  margin-left: var(--sp-2);
}
.name {
  margin-top: var(--sp-1);
}
.remark {
  font-size: var(--fs-xs);
  color: var(--c-text-3);
}
.mask {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: 460px;
  background: var(--c-panel);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  box-shadow: var(--shadow-lg);
}
.modal-title {
  margin: 0 0 var(--sp-4);
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
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
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-sm);
}
.input:focus {
  outline: none;
  border-color: var(--c-primary);
}
.seg {
  display: flex;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}
.seg button {
  flex: 1;
  border: none;
  background: var(--c-panel);
  padding: var(--sp-2);
  color: var(--c-text-2);
}
.seg button.on {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: var(--fw-medium);
}
.color-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: var(--sp-3);
  align-items: end;
}
.preview-swatch {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}
</style>
