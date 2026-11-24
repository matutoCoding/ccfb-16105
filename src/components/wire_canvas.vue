<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  CellBuildResult,
  Vec2,
  WirePath,
} from '@/core/types'
import { evalBezier } from '@/core/geometry/bezier'

const props = defineProps<{
  wires: WirePath[]
  build: CellBuildResult | null
  referenceImage: string | null
  worldW: number
  worldH: number
  selectedId: string | null
}>()

const emit = defineEmits<{
  pick: [id: string]
  drawEnd: [points: Vec2[], degree: 2 | 3]
}>()

const zoom = ref(1)
const pan = ref<Vec2>({ x: 0, y: 0 })
const drawing = ref<Vec2[]>([])
const degree = ref<2 | 3>(3)
const panning = ref(false)
const panStart = ref<{ mouse: Vec2; pan: Vec2 } | null>(null)

const viewBox = computed(() => {
  const w = props.worldW / zoom.value
  const h = props.worldH / zoom.value
  return `${-pan.value.x} ${-pan.value.y} ${w} ${h}`
})

const toWorld = (e: MouseEvent): Vec2 => {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const w = props.worldW / zoom.value
  const h = props.worldH / zoom.value
  return {
    x: -pan.value.x + ((e.clientX - rect.left) / rect.width) * w,
    y: -pan.value.y + ((e.clientY - rect.top) / rect.height) * h,
  }
}

const onWheel = (e: WheelEvent) => {
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  zoom.value = Math.min(8, Math.max(0.2, zoom.value * factor))
}

const onMouseDown = (e: MouseEvent) => {
  if (e.button === 1 || e.altKey) {
    panning.value = true
    panStart.value = { mouse: { x: e.clientX, y: e.clientY }, pan: { ...pan.value } }
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (!panning.value || !panStart.value) return
  const scale = props.worldW / zoom.value / (e.currentTarget as SVGSVGElement).getBoundingClientRect().width
  pan.value = {
    x: panStart.value.pan.x - (e.clientX - panStart.value.mouse.x) * scale,
    y: panStart.value.pan.y - (e.clientY - panStart.value.mouse.y) * scale,
  }
}

const onMouseUp = () => {
  panning.value = false
  panStart.value = null
}

const onClickCanvas = (e: MouseEvent) => {
  if (e.target !== e.currentTarget && (e.target as Element).tagName !== 'rect') return
  drawing.value.push(toWorld(e))
}

const finishDraw = () => {
  if (drawing.value.length >= (degree.value === 2 ? 3 : 4)) {
    emit('drawEnd', [...drawing.value], degree.value)
  }
  drawing.value = []
}

const cancelDraw = () => {
  drawing.value = []
}

const bezierPath = (wire: WirePath): string => {
  const parts: string[] = []
  for (const seg of wire.segments) {
    const [p0, ...rest] = seg.points
    if (parts.length === 0) parts.push(`M ${p0.x} ${p0.y}`)
    if (seg.degree === 2) {
      parts.push(`Q ${rest[0].x} ${rest[0].y} ${rest[1].x} ${rest[1].y}`)
    } else {
      parts.push(
        `C ${rest[0].x} ${rest[0].y} ${rest[1].x} ${rest[1].y} ${rest[2].x} ${rest[2].y}`,
      )
    }
  }
  return parts.join(' ')
}

const draftPath = computed(() => {
  const pts = drawing.value
  if (pts.length < 2) return ''
  if (degree.value === 2) {
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
    return `M ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y}`
  }
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  if (pts.length === 3) return `M ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y}`
  return `M ${pts[0].x} ${pts[0].y} C ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} ${pts[3].x} ${pts[3].y}`
})

const gapSegments = computed(() => {
  if (!props.build) return []
  return props.build.gaps.map((g) => ({
    from: props.build!.nodes[g.from].pos,
    to: props.build!.nodes[g.to].pos,
  }))
})

defineExpose({ evalBezier })
</script>

<template>
  <div class="canvas-wrap">
    <div class="toolbar">
      <label class="tool">
        曲线阶数
        <select v-model="degree">
          <option :value="2">二次贝塞尔</option>
          <option :value="3">三次贝塞尔</option>
        </select>
      </label>
      <span class="zoom">{{ Math.round(zoom * 100) }}%</span>
      <button class="link" @click="zoom = Math.min(8, zoom * 1.2)">放大</button>
      <button class="link" @click="zoom = Math.max(0.2, zoom / 1.2)">缩小</button>
      <button class="link" @click="zoom = 1; pan = { x: 0, y: 0 }">复位</button>
      <span class="hint">Alt+拖拽平移 · 滚轮缩放 · 单击画布落控制点</span>
    </div>
    <svg
      class="canvas"
      :viewBox="viewBox"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @click="onClickCanvas"
    >
      <rect
        :x="-pan.x"
        :y="-pan.y"
        :width="worldW / zoom"
        :height="worldH / zoom"
        fill="#f8fafc"
      />
      <image
        v-if="referenceImage"
        :href="referenceImage"
        :width="worldW"
        :height="worldH"
        opacity="0.45"
        preserveAspectRatio="none"
      />
      <g v-for="wire in wires" :key="wire.id">
        <path
          :d="bezierPath(wire)"
          fill="none"
          :stroke="selectedId === wire.id ? '#b45309' : '#1e293b'"
          :stroke-width="wire.width"
          stroke-linejoin="round"
          stroke-linecap="round"
          class="wire"
          @click.stop="emit('pick', wire.id)"
        />
      </g>
      <path
        v-if="draftPath"
        :d="draftPath"
        fill="none"
        stroke="#b45309"
        stroke-width="0.4"
        stroke-dasharray="1.5 1.5"
      />
      <circle
        v-for="(p, i) in drawing"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        r="0.8"
        fill="#b45309"
      />
      <g v-for="(g, i) in gapSegments" :key="`gap-${i}`">
        <line
          :x1="g.from.x"
          :y1="g.from.y"
          :x2="g.to.x"
          :y2="g.to.y"
          stroke="#dc2626"
          stroke-width="1.2"
          stroke-linecap="round"
          class="gap"
        />
        <circle :cx="g.from.x" :cy="g.from.y" r="1.2" fill="#dc2626" class="gap" />
      </g>
      <g v-if="build">
        <text
          v-for="cell in build.cells"
          :key="cell.id"
          :x="cell.centroid.x"
          :y="cell.centroid.y"
          font-size="2.4"
          fill="#15803d"
          text-anchor="middle"
        >
          #{{ cell.id }}
        </text>
      </g>
    </svg>
    <div v-if="drawing.length > 0" class="draw-bar">
      <span>已落 {{ drawing.length }} 个控制点</span>
      <button class="link" @click="finishDraw">成丝</button>
      <button class="link" @click="cancelDraw">取消</button>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 480px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--c-panel);
}
.toolbar {
  position: absolute;
  top: var(--sp-3);
  left: var(--sp-3);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  background: rgb(255 255 255 / 0.92);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  box-shadow: var(--shadow-sm);
  font-size: var(--fs-xs);
}
.tool select {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: var(--sp-1) var(--sp-2);
  margin-left: var(--sp-2);
}
.zoom {
  color: var(--c-text-2);
  min-width: 48px;
}
.link {
  background: none;
  border: none;
  color: var(--c-primary);
  padding: 0;
}
.hint {
  color: var(--c-text-3);
}
.canvas {
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
.wire {
  cursor: pointer;
  transition: stroke var(--t-fast);
}
.gap {
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  50% {
    opacity: 0.35;
  }
}
.draw-bar {
  position: absolute;
  bottom: var(--sp-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--sp-4);
  align-items: center;
  background: var(--c-text);
  color: #fff;
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-4);
  font-size: var(--fs-xs);
}
.draw-bar .link {
  color: #fcd34d;
}
</style>
