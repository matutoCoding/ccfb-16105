<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  CellBuildResult,
  CellGlazeConfig,
  FiringConfig,
  Glaze,
  WirePath,
} from '@/core/types'
import { flattenWires, buildPlanarGraph } from '@/core/geometry/planar_graph'
import { listWires } from '@/services/wire_service'
import { getOrder } from '@/services/order_service'
import { listGlazes } from '@/services/glaze_service'
import {
  getFiringConfig,
  listCellConfigs,
  saveFiringConfig,
  upsertCellConfig,
} from '@/services/firing_service'
import { DistanceFieldRenderer } from '@/core/render/distance_field_renderer'
import AppButton from '@/components/app_button.vue'
import CellGlazePanel from '@/components/cell_glaze_panel.vue'

const route = useRoute()
const router = useRouter()
const orderId = route.params.orderId as string

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderMs = ref(0)
const errorMsg = ref('')
let renderer: DistanceFieldRenderer | null = null

const order = ref<Awaited<ReturnType<typeof getOrder>>>(undefined)
const wires = ref<WirePath[]>([])
const glazes = ref<Glaze[]>([])
const build = ref<CellBuildResult | null>(null)
const configs = ref<CellGlazeConfig[]>([])
const firing = ref<FiringConfig | null>(null)
const selectedCell = ref<number | null>(null)

const worldW = computed(() => order.value?.unfoldWidth ?? order.value?.diameter ?? 300)
const worldH = computed(() =>
  order.value?.bodyType === 'vase'
    ? order.value.unfoldHeight
    : (order.value?.diameter ?? 300),
)
const glazeMap = computed(() => new Map(glazes.value.map((g) => [g.id, g])))
const configMap = computed(
  () => new Map(configs.value.map((c) => [c.cellId, c])),
)
const avgWire = computed(() => {
  if (wires.value.length === 0) return { width: 0.5, height: 0.8 }
  const w = wires.value.reduce((s, x) => s + x.width, 0) / wires.value.length
  const h = wires.value.reduce((s, x) => s + x.height, 0) / wires.value.length
  return { width: w, height: h }
})

const render = () => {
  if (!renderer || !build.value || !firing.value) return
  const start = performance.now()
  const flats = flattenWires(wires.value)
  try {
    renderer.uploadSegments(flats, worldH.value)
    renderer.uploadCellColors(
      build.value.cells,
      configMap.value,
      glazeMap.value,
      worldW.value,
      worldH.value,
    )
    const requiredCoats = Math.max(
      1,
      ...[...configMap.value.values()].map((c) => c.coats),
      3,
    )
    renderer.render(worldW.value, worldH.value, {
      firings: firing.value.firings,
      requiredCoats,
      pinholeSeed: firing.value.pinholeSeed,
      pinholeDensity: 1,
      wireWidth: avgWire.value.width,
      wireHeight: avgWire.value.height,
      polished: false,
      gilded: false,
      groundPattern: false,
    })
    renderMs.value = performance.now() - start
  } catch (err) {
    errorMsg.value = (err as Error).message
  }
}

const resize = () => {
  if (!renderer || !canvasRef.value) return
  const rect = canvasRef.value.parentElement!.getBoundingClientRect()
  renderer.resize(rect.width, rect.height)
  render()
}

onMounted(async () => {
  order.value = await getOrder(orderId)
  wires.value = await listWires(orderId)
  glazes.value = await listGlazes()
  configs.value = await listCellConfigs(orderId)
  firing.value = await getFiringConfig(orderId)
  if (wires.value.length > 0) {
    build.value = buildPlanarGraph(flattenWires(wires.value))
  }
  await nextTickSafe()
  if (canvasRef.value) {
    try {
      renderer = new DistanceFieldRenderer(canvasRef.value)
      resize()
    } catch (err) {
      errorMsg.value = (err as Error).message
    }
  }
  window.addEventListener('resize', resize)
})

const nextTickSafe = () => new Promise((r) => requestAnimationFrame(() => r(null)))

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  renderer?.dispose()
})

watch([wires, configs, firing], render, { deep: true })

const saveFiring = () => {
  if (firing.value) saveFiringConfig(firing.value)
}

const onSaveCell = async (cfg: CellGlazeConfig) => {
  await upsertCellConfig({ ...cfg, orderId })
  configs.value = await listCellConfigs(orderId)
}

const reseed = () => {
  if (!firing.value) return
  firing.value.pinholeSeed = Math.floor(Math.random() * 1e9)
  saveFiring()
}
</script>

<template>
  <div v-if="order && firing" class="page">
    <div class="head">
      <div>
        <button class="link" @click="router.push('/orders')">← 返回订单</button>
        <h2 class="title">{{ order.title }} · 点蓝烧制预览</h2>
        <p class="sub">
          GPU 距离场实时渲染 ｜ 本次刷新 {{ renderMs.toFixed(1) }}ms
          <span v-if="renderMs > 50" class="warn">超出 50ms 指标</span>
        </p>
      </div>
    </div>

    <div class="layout">
      <div class="stage">
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        <p v-else-if="!build || build.cells.length === 0" class="empty-tip">
          还没有封闭格，先去丝工图把丝路封上
        </p>
        <canvas ref="canvasRef" class="gl-canvas" />
      </div>

      <aside class="panel">
        <section class="block">
          <h3 class="block-title">烧制参数</h3>
          <label class="field">
            烧制遍数
            <input v-model.number="firing.firings" type="number" min="1" max="12" class="input" @change="saveFiring" />
          </label>
          <p class="tip" :class="{ bad: firing.firings < 3 }">
            遍数不足时格心釉面低于丝顶，预览可见凹坑
          </p>
          <label class="field">
            砂眼种子
            <input v-model.number="firing.pinholeSeed" type="number" class="input" @change="saveFiring" />
          </label>
          <AppButton size="sm" @click="reseed">换一批砂眼分布</AppButton>
        </section>

        <section v-if="build" class="block grow">
          <h3 class="block-title">填釉格（{{ build.cells.length }}）</h3>
          <div class="cell-list">
            <button
              v-for="cell in build.cells"
              :key="cell.id"
              class="cell-chip"
              :class="{ on: selectedCell === cell.id }"
              @click="selectedCell = cell.id"
            >
              #{{ cell.id }}
              <span class="cell-area">{{ cell.area.toFixed(0) }}mm²</span>
            </button>
          </div>
          <CellGlazePanel
            v-if="selectedCell !== null"
            :cell-id="selectedCell"
            :glazes="glazes"
            :config="configMap.get(selectedCell)"
            @save="onSaveCell"
          />
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
.warn {
  color: var(--c-warn);
  margin-left: var(--sp-2);
}
.link {
  background: none;
  border: none;
  color: var(--c-primary);
  padding: 0;
  cursor: pointer;
}
.layout {
  flex: 1;
  display: flex;
  gap: var(--sp-4);
  min-height: 0;
}
.stage {
  flex: 1;
  position: relative;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  background: var(--c-panel);
  min-height: 520px;
  overflow: hidden;
}
.gl-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.error,
.empty-tip {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--c-text-3);
  margin: 0;
}
.error {
  color: var(--c-danger);
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
.tip {
  font-size: var(--fs-xs);
  color: var(--c-text-3);
  margin: 0 0 var(--sp-3);
}
.tip.bad {
  color: var(--c-warn);
}
.cell-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.cell-chip {
  border: 1px solid var(--c-border);
  background: var(--c-panel);
  border-radius: var(--radius);
  padding: var(--sp-1) var(--sp-3);
  font-size: var(--fs-xs);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transition: all var(--t-fast);
}
.cell-chip:hover {
  border-color: var(--c-primary);
}
.cell-chip.on {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.cell-area {
  color: var(--c-text-3);
  font-size: 12px;
}
</style>
