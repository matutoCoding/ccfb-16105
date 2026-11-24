<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  CellBuildResult,
  CellGlazeConfig,
  Glaze,
  WirePath,
} from '@/core/types'
import { flattenWires, buildPlanarGraph } from '@/core/geometry/planar_graph'
import { buildWireBom } from '@/core/geometry/wire_bom'
import { listWires } from '@/services/wire_service'
import { getOrder } from '@/services/order_service'
import { listGlazes } from '@/services/glaze_service'
import { listCellConfigs } from '@/services/firing_service'
import { buildSvgDocument, downloadSvg } from '@/core/export/svg_exporter'
import { curvedArcLength } from '@/core/geometry/unfold'
import AppButton from '@/components/app_button.vue'
import AppIcon from '@/components/app_icon.vue'
import { dayjs } from '@/libs'

const route = useRoute()
const router = useRouter()
const orderId = route.params.orderId as string

const order = ref<Awaited<ReturnType<typeof getOrder>>>(undefined)
const wires = ref<WirePath[]>([])
const glazes = ref<Glaze[]>([])
const configs = ref<CellGlazeConfig[]>([])
const build = ref<CellBuildResult | null>(null)

const bom = computed(() => buildWireBom(wires.value))
const glazeMap = computed(() => new Map(glazes.value.map((g) => [g.id, g])))

const worldW = computed(() => order.value?.unfoldWidth ?? order.value?.diameter ?? 300)
const worldH = computed(() =>
  order.value?.bodyType === 'vase'
    ? order.value.unfoldHeight
    : (order.value?.diameter ?? 300),
)

// 曲率变形量：盘面弦长对应实际弧长的增量
const distortion = computed(() => {
  if (!order.value || order.value.curvature === 0) return 0
  const radius = 1 / order.value.curvature
  return curvedArcLength(order.value.diameter, radius) - order.value.diameter
})

const rows = computed(() => {
  if (!build.value) return []
  return build.value.cells.map((cell) => {
    const cfg = configs.value.find((c) => c.cellId === cell.id)
    const entries =
      cfg?.stops.map((s) => {
        const g = glazeMap.value.get(s.glazeId)
        return g ? `${g.code} ${g.name}` : '未匹配釉料'
      }) ?? []
    return {
      cellId: cell.id,
      area: cell.area,
      glazes: entries.length > 0 ? entries.join(' → ') : '未配釉',
      coats: cfg?.coats ?? 0,
      blend: cfg ? `${Math.round((cfg.blendAngle * 180) / Math.PI)}°` : '—',
    }
  })
})

const exportSvg = () => {
  if (!build.value || !order.value) return
  const svg = buildSvgDocument(wires.value, build.value.cells, worldW.value, worldH.value)
  downloadSvg(svg, `${order.value.code}_丝工图_1比1.svg`)
}

const printPage = () => window.print()

onMounted(async () => {
  order.value = await getOrder(orderId)
  wires.value = await listWires(orderId)
  glazes.value = await listGlazes()
  configs.value = await listCellConfigs(orderId)
  if (wires.value.length > 0) {
    build.value = buildPlanarGraph(flattenWires(wires.value))
  }
})
</script>

<template>
  <div v-if="order" class="page">
    <div class="head no-print">
      <div>
        <button class="link" @click="router.push('/orders')">← 返回订单</button>
        <h2 class="title">出工单 · {{ order.code }}</h2>
      </div>
      <div class="actions">
        <AppButton @click="exportSvg">
          <AppIcon name="download" />1:1 丝工图 SVG
        </AppButton>
        <AppButton variant="primary" @click="printPage">打印工单</AppButton>
      </div>
    </div>

    <div class="sheet">
      <header class="sheet-head">
        <div>
          <h3>{{ order.title }}</h3>
          <p>客户：{{ order.customer }} ｜ 下单：{{ dayjs(order.createdAt).format('YYYY-MM-DD') }}</p>
        </div>
        <div class="sheet-meta">
          <div>胎型：{{ { plate: '盘', vase: '瓶', figurine: '摆件' }[order.bodyType] }}</div>
          <div>胎面直径：{{ order.diameter }}mm</div>
          <div>展开尺寸：{{ worldW }} × {{ worldH }}mm</div>
          <div v-if="distortion > 0">
            曲率变形量：+{{ distortion.toFixed(2) }}mm（弧长修正）
          </div>
        </div>
      </header>

      <section>
        <h4 class="section-title">一、丝料清单</h4>
        <table class="table">
          <thead>
            <tr>
              <th>丝编号</th>
              <th>扁丝宽×高 (mm)</th>
              <th>长度 (mm)</th>
              <th>弯折次数</th>
              <th>最小弯曲半径 (mm)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in bom" :key="item.wireId">
              <td>{{ item.name }}</td>
              <td>{{ item.width }} × {{ item.height }}</td>
              <td>{{ item.length.toFixed(1) }}</td>
              <td>{{ item.bendCount }}</td>
              <td>{{ Number.isFinite(item.minRadius) ? item.minRadius.toFixed(1) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h4 class="section-title">二、按格点蓝工单</h4>
        <table class="table">
          <thead>
            <tr>
              <th>格编号</th>
              <th>面积 (mm²)</th>
              <th>釉色色号</th>
              <th>晕染方向</th>
              <th>填釉遍数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.cellId">
              <td>#{{ row.cellId }}</td>
              <td>{{ row.area.toFixed(1) }}</td>
              <td>{{ row.glazes }}</td>
              <td>{{ row.blend }}</td>
              <td>{{ row.coats }}</td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="5" class="empty">还没有封闭格，先完成丝工图</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer class="sheet-foot">
        丝工图按 1:1 毫米尺寸导出 SVG，打印时选择"实际大小/100%"，标称精度 ±0.2mm
      </footer>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 1000px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--sp-5);
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
.actions {
  display: flex;
  gap: var(--sp-2);
}
.sheet {
  background: var(--c-panel);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  box-shadow: var(--shadow-sm);
}
.sheet-head {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-5);
  padding-bottom: var(--sp-4);
  border-bottom: 2px solid var(--c-text);
  margin-bottom: var(--sp-5);
}
.sheet-head h3 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-lg);
}
.sheet-head p {
  margin: 0;
  color: var(--c-text-2);
}
.sheet-meta {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--c-text-2);
  text-align: right;
}
.section-title {
  font-size: var(--fs-base);
  margin: var(--sp-5) 0 var(--sp-3);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-xs);
}
.table th,
.table td {
  text-align: left;
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--c-border);
}
.table th {
  background: var(--c-panel-2);
  font-weight: var(--fw-medium);
  color: var(--c-text-2);
}
.empty {
  text-align: center;
  color: var(--c-text-3);
  padding: var(--sp-5);
}
.sheet-foot {
  margin-top: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
  font-size: var(--fs-xs);
  color: var(--c-text-3);
}
@media print {
  .no-print {
    display: none;
  }
  .sheet {
    border: none;
    box-shadow: none;
  }
}
</style>
