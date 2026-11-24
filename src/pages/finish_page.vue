<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  CellBuildResult,
  FinishConfig,
  WirePath,
} from '@/core/types'
import { flattenWires, buildPlanarGraph } from '@/core/geometry/planar_graph'
import { listWires } from '@/services/wire_service'
import { getOrder } from '@/services/order_service'
import { listCellConfigs, getFinishConfig, saveFinishConfig } from '@/services/firing_service'
import { listGlazes } from '@/services/glaze_service'
import { DistanceFieldRenderer } from '@/core/render/distance_field_renderer'
import AppButton from '@/components/app_button.vue'

const route = useRoute()
const router = useRouter()
const orderId = route.params.orderId as string
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: DistanceFieldRenderer | null = null

const order = ref<Awaited<ReturnType<typeof getOrder>>>(undefined)
const wires = ref<WirePath[]>([])
const build = ref<CellBuildResult | null>(null)
const finish = ref<FinishConfig | null>(null)

const worldW = () => order.value?.unfoldWidth ?? order.value?.diameter ?? 300
const worldH = () =>
  order.value?.bodyType === 'vase'
    ? order.value.unfoldHeight
    : (order.value?.diameter ?? 300)

const render = async () => {
  if (!renderer || !build.value || !finish.value) return
  const glazes = await listGlazes()
  const configs = await listCellConfigs(orderId)
  const glazeMap = new Map(glazes.map((g) => [g.id, g]))
  const configMap = new Map(configs.map((c) => [c.cellId, c]))
  const flats = flattenWires(wires.value)
  renderer.uploadSegments(flats, worldH())
  renderer.uploadCellColors(
    build.value.cells,
    configMap,
    glazeMap,
    worldW(),
    worldH(),
  )
  const avgW = wires.value.reduce((s, x) => s + x.width, 0) / wires.value.length
  const avgH = wires.value.reduce((s, x) => s + x.height, 0) / wires.value.length
  renderer.render(worldW(), worldH(), {
    firings: 4,
    requiredCoats: 3,
    pinholeSeed: 7,
    pinholeDensity: 0.3,
    wireWidth: avgW,
    wireHeight: avgH,
    polished: finish.value.polished,
    gilded: finish.value.gilded,
    groundPattern: finish.value.groundPattern,
  })
}

onMounted(async () => {
  order.value = await getOrder(orderId)
  wires.value = await listWires(orderId)
  finish.value = await getFinishConfig(orderId)
  if (wires.value.length > 0) {
    build.value = buildPlanarGraph(flattenWires(wires.value))
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  if (canvasRef.value && build.value) {
    renderer = new DistanceFieldRenderer(canvasRef.value)
    const rect = canvasRef.value.parentElement!.getBoundingClientRect()
    renderer.resize(rect.width, rect.height)
    render()
  }
})

watch(finish, async () => {
  if (finish.value) {
    await saveFinishConfig(finish.value)
    render()
  }
}, { deep: true })
</script>

<template>
  <div v-if="order && finish" class="page">
    <div class="head">
      <div>
        <button class="link" @click="router.push('/orders')">← 返回订单</button>
        <h2 class="title">{{ order.title }} · 磨光镀金</h2>
      </div>
    </div>

    <div class="layout">
      <div class="stage">
        <p v-if="!build" class="tip">先完成丝工图与点蓝，再看磨光镀金效果</p>
        <canvas ref="canvasRef" class="gl-canvas" />
      </div>
      <aside class="panel">
        <section class="block">
          <h3 class="block-title">后道工序开关</h3>
          <label class="switch-row">
            <input v-model="finish.polished" type="checkbox" />
            <div>
              <div class="switch-title">磨光找平</div>
              <div class="switch-sub">釉面与丝顶磨平，消除凹坑起伏</div>
            </div>
          </label>
          <label class="switch-row">
            <input v-model="finish.gilded" type="checkbox" />
            <div>
              <div class="switch-title">铜丝镀金</div>
              <div class="switch-sub">露出的丝面呈现金色反光</div>
            </div>
          </label>
          <label class="switch-row">
            <input v-model="finish.groundPattern" type="checkbox" />
            <div>
              <div class="switch-title">透明釉下錾地纹</div>
              <div class="switch-sub">地纹反光透过透明釉层显现</div>
            </div>
          </label>
        </section>
        <AppButton @click="router.push(`/work-order/${orderId}`)">去出工单</AppButton>
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
.title {
  margin: var(--sp-1) 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
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
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  background: var(--c-panel);
  min-height: 520px;
  position: relative;
  overflow: hidden;
}
.gl-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.tip {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--c-text-3);
}
.panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.block {
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
}
.block-title {
  margin: 0 0 var(--sp-4);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}
.switch-row {
  display: flex;
  gap: var(--sp-3);
  align-items: flex-start;
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--c-border);
  cursor: pointer;
}
.switch-row:last-of-type {
  border-bottom: none;
}
.switch-title {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}
.switch-sub {
  font-size: var(--fs-xs);
  color: var(--c-text-3);
  margin-top: 2px;
}
.switch-row input {
  margin-top: 4px;
  accent-color: var(--c-primary);
  width: 16px;
  height: 16px;
}
</style>
