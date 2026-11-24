<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  CellBuildResult,
  Vec2,
  WirePath,
  WireWarning,
} from '@/core/types'
import { flattenWires, buildPlanarGraph, buildWireWarnings } from '@/core/geometry/planar_graph'
import { buildWireBom } from '@/core/geometry/wire_bom'
import {
  createOutlineWire,
  createWire,
  deleteWire,
  listWires,
  updateWire,
} from '@/services/wire_service'
import { getOrder } from '@/services/order_service'
import { buildSvgDocument, downloadSvg } from '@/core/export/svg_exporter'
import WireCanvas from '@/components/wire_canvas.vue'
import AppButton from '@/components/app_button.vue'
import AppIcon from '@/components/app_icon.vue'

const route = useRoute()
const router = useRouter()
const orderId = route.params.orderId as string

const order = ref<Awaited<ReturnType<typeof getOrder>>>(undefined)
const wires = ref<WirePath[]>([])
const build = ref<CellBuildResult | null>(null)
const warnings = ref<WireWarning[]>([])
const selectedId = ref<string | null>(null)
const maxCellArea = ref(1500)
const minBendRadius = ref(2)

const worldW = computed(() => order.value?.unfoldWidth ?? order.value?.diameter ?? 300)
const worldH = computed(() =>
  order.value?.bodyType === 'vase'
    ? order.value.unfoldHeight
    : (order.value?.diameter ?? 300),
)
const selected = computed(() => wires.value.find((w) => w.id === selectedId.value) ?? null)
const bom = computed(() => buildWireBom(wires.value))
const totalLength = computed(() =>
  bom.value.reduce((sum, item) => sum + item.length, 0),
)

const load = async () => {
  order.value = await getOrder(orderId)
  wires.value = await listWires(orderId)
}

const rebuild = () => {
  if (wires.value.length === 0) {
    build.value = null
    warnings.value = []
    return
  }
  const start = performance.now()
  const flats = flattenWires(wires.value)
  build.value = buildPlanarGraph(flats)
  warnings.value = buildWireWarnings(
    wires.value,
    build.value,
    maxCellArea.value,
    minBendRadius.value,
  )
  // 性能埋点：验证 50ms 刷新指标
  // eslint-disable-next-line no-console
  console.info(`[丝工图重建] ${(performance.now() - start).toFixed(1)}ms，线段 ${flats.length}`)
}

watch(wires, rebuild, { deep: false })
watch([maxCellArea, minBendRadius], rebuild)

const onDrawEnd = async (points: Vec2[], degree: 2 | 3) => {
  const wire = await createWire(orderId, points, degree)
  wires.value = await listWires(orderId)
  selectedId.value = wire.id
}

const onPick = (id: string) => {
  selectedId.value = id
}

const removeSelected = async () => {
  if (!selectedId.value) return
  await deleteWire(selectedId.value)
  selectedId.value = null
  wires.value = await listWires(orderId)
}

const makeOutline = async () => {
  if (!order.value) return
  await createOutlineWire(orderId, order.value.diameter)
  wires.value = await listWires(orderId)
}

const setWireSize = (key: 'width' | 'height', value: number) => {
  if (!selected.value || value <= 0) return
  updateWire(selected.value.id, { [key]: value })
  const target = wires.value.find((w) => w.id === selected.value?.id)
  if (target) target[key] = value
}

const exportSvg = () => {
  if (!build.value) return
  const svg = buildSvgDocument(wires.value, build.value.cells, worldW.value, worldH.value)
  downloadSvg(svg, `${order.value?.code ?? 'wire'}_1to1.svg`)
}

load()
</script>

<template>
  <div v-if="order" class="page">
    <div class="head">
      <div>
        <button class="link" @click="router.push('/orders')">← 返回订单</button>
        <h2 class="title">{{ order.title }} · 丝工图</h2>
        <p class="sub">
          {{ order.code }} ｜ 封闭格 {{ build?.cells.length ?? 0 }} 个 ｜
          缺口 <span :class="{ bad: (build?.gaps.length ?? 0) > 0 }">{{ build?.gaps.length ?? 0 }}</span> 处 ｜
          丝料总长 {{ totalLength.toFixed(1) }}mm
        </p>
      </div>
      <div class="head-actions">
        <AppButton size="sm" @click="makeOutline">生成胎体轮廓</AppButton>
        <AppButton variant="primary" size="sm" @click="exportSvg">
          <AppIcon name="download" />1:1 导出 SVG
        </AppButton>
      </div>
    </div>

    <div class="layout">
      <WireCanvas
        :wires="wires"
        :build="build"
        :reference-image="order.referenceImage"
        :world-w="worldW"
        :world-h="worldH"
        :selected-id="selectedId"
        @pick="onPick"
        @draw-end="onDrawEnd"
      />

      <aside class="panel">
        <section class="block">
          <h3 class="block-title">检测阈值</h3>
          <label class="field">
            单格面积上限 (mm²)
            <input v-model.number="maxCellArea" type="number" min="1" class="input" />
          </label>
          <label class="field">
            最小弯曲半径 (mm)
            <input v-model.number="minBendRadius" type="number" step="0.1" min="0.1" class="input" />
          </label>
        </section>

        <section v-if="build && build.gaps.length > 0" class="block danger-block">
          <h3 class="block-title danger">
            <AppIcon name="warn" />漏釉缺口 {{ build.gaps.length }}
          </h3>
          <p class="danger-text">存在未围成封闭格的自由丝端，已在画布标红，补丝焊接后再点蓝</p>
        </section>

        <section v-if="warnings.length > 0" class="block">
          <h3 class="block-title warn">工艺告警 {{ warnings.length }}</h3>
          <ul class="warn-list">
            <li v-for="(w, i) in warnings" :key="i" class="warn-item">{{ w.message }}</li>
          </ul>
        </section>

        <section v-if="selected" class="block">
          <h3 class="block-title">选中丝：{{ selected.name }}</h3>
          <label class="field">
            扁丝宽 (mm)
            <input
              :value="selected.width"
              type="number"
              step="0.05"
              min="0.1"
              class="input"
              @change="setWireSize('width', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field">
            扁丝高 (mm)
            <input
              :value="selected.height"
              type="number"
              step="0.05"
              min="0.1"
              class="input"
              @change="setWireSize('height', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <AppButton variant="danger" size="sm" @click="removeSelected">
            <AppIcon name="trash" />删除此丝
          </AppButton>
        </section>

        <section class="block grow">
          <h3 class="block-title">丝料清单</h3>
          <div class="bom-head">
            <span>名称</span><span>长度</span><span>弯折</span><span>最小 R</span>
          </div>
          <ul class="bom-list">
            <li v-for="item in bom" :key="item.wireId" class="bom-row" :class="{ on: item.wireId === selectedId }" @click="onPick(item.wireId)">
              <span>{{ item.name }}</span>
              <span>{{ item.length.toFixed(1) }}</span>
              <span>{{ item.bendCount }}</span>
              <span :class="{ bad: item.minRadius < minBendRadius }">
                {{ Number.isFinite(item.minRadius) ? item.minRadius.toFixed(1) : '—' }}
              </span>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--sp-4);
}
.title {
  margin: var(--sp-1) 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
}
.sub {
  margin: 0;
  color: var(--c-text-2);
}
.bad {
  color: var(--c-danger);
  font-weight: var(--fw-semibold);
}
.link {
  background: none;
  border: none;
  color: var(--c-primary);
  padding: 0;
  cursor: pointer;
}
.head-actions {
  display: flex;
  gap: var(--sp-2);
}
.layout {
  flex: 1;
  display: flex;
  gap: var(--sp-4);
  min-height: 0;
}
.panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  overflow: auto;
}
.block {
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
}
.block.grow {
  flex: 1;
}
.block-title {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.danger-block {
  border-color: var(--c-danger);
  background: var(--c-danger-soft);
}
.danger {
  color: var(--c-danger);
}
.danger-text {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-danger);
}
.warn {
  color: var(--c-warn);
}
.warn-list {
  margin: 0;
  padding-left: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--c-text-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin-bottom: var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--c-text-2);
}
.input {
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-2);
  font-size: var(--fs-sm);
}
.input:focus {
  outline: none;
  border-color: var(--c-primary);
}
.bom-head,
.bom-row {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.6fr 0.8fr;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  padding: var(--sp-1) var(--sp-2);
}
.bom-head {
  color: var(--c-text-3);
  border-bottom: 1px solid var(--c-border);
}
.bom-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow: auto;
}
.bom-row {
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.bom-row:hover {
  background: var(--c-panel-2);
}
.bom-row.on {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
</style>
