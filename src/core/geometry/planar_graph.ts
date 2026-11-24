import type {
  CellBuildResult,
  EnclosedCell,
  FlatSegment,
  GapDefect,
  GraphHalfEdge,
  GraphNode,
  Vec2,
  WirePath,
} from '../types'
import { flattenSegment, minRadiusOf } from './bezier'
import {
  SNAP_TOLERANCE,
  SpatialHash,
  segmentIntersect,
} from './intersect'
import { dist, polygonCentroid, sub } from './vec2'

const EPS = 1e-6

// 贝塞尔丝全部细分为直线段
export const flattenWires = (wires: WirePath[]): FlatSegment[] => {
  const out: FlatSegment[] = []
  for (const wire of wires) {
    for (let s = 0; s < wire.segments.length; s++) {
      const pieces = flattenSegment(wire.segments[s])
      for (const p of pieces) {
        out.push({
          wireId: wire.id,
          segIndex: s,
          t0: p.t0,
          t1: p.t1,
          a: p.points[0],
          b: p.points[1],
        })
      }
    }
  }
  return out
}

// 网格点索引：按 SNAP_TOLERANCE 格距合并近邻点
// 整数网格坐标哈希，避免字符串 key 的分配开销
class PointIndex {
  private map = new Map<number, number>()
  nodes: GraphNode[] = []

  private static cellKey = (cx: number, cy: number): number =>
    // 支持负坐标的 Cantor 配对
    ((cx + 32768) << 16) | (cy + 32768)

  add(p: Vec2, wireEnd?: { wireId: string; end: 0 | 1 }): number {
    const cx = Math.round(p.x / SNAP_TOLERANCE)
    const cy = Math.round(p.y / SNAP_TOLERANCE)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const id = this.map.get(PointIndex.cellKey(cx + dx, cy + dy))
        if (id !== undefined && dist(p, this.nodes[id].pos) <= SNAP_TOLERANCE) {
          if (wireEnd) this.nodes[id].wireEnds.push(wireEnd)
          return id
        }
      }
    }
    const id = this.nodes.length
    this.nodes.push({
      id,
      pos: { ...p },
      wireEnds: wireEnd ? [wireEnd] : [],
    })
    this.map.set(PointIndex.cellKey(cx, cy), id)
    return id
  }
}

const angleOf = (a: Vec2, b: Vec2): number => {
  const d = sub(b, a)
  return Math.atan2(d.y, d.x)
}

// 半边面遍历：构造求交图并枚举全部封闭面与缺口
export const buildPlanarGraph = (segments: FlatSegment[]): CellBuildResult => {
  // 1. 收集每段的切分参数（端点 + 交点）
  const splits: Array<Map<number, Vec2>> = segments.map(
    (seg) =>
      new Map([
        [0, seg.a],
        [1, seg.b],
      ]),
  )
  const maxLen = Math.max(
    SNAP_TOLERANCE * 4,
    ...segments.map((s) => dist(s.a, s.b)),
  )
  const hash = new SpatialHash(segments, Math.max(2, maxLen / 4))

  for (let i = 0; i < segments.length; i++) {
    for (const j of hash.candidates(i, segments[i])) {
      const hit = segmentIntersect(
        segments[i].a,
        segments[i].b,
        segments[j].a,
        segments[j].b,
      )
      if (!hit) continue
      const put = (idx: number, t: number, pt: Vec2) => {
        const m = splits[idx]
        for (const [et] of m) {
          if (Math.abs(et - t) < EPS) return
        }
        m.set(t, pt)
      }
      put(i, hit.tA, hit.point)
      put(j, hit.tB, hit.point)
    }
  }

  // 2. 切分子段 + 节点焊接
  const pointIndex = new PointIndex()
  const subEdges: Array<{ from: number; to: number; wireId: string }> = []

  segments.forEach((seg, idx) => {
    const entries = [...splits[idx].entries()].sort((a, b) => a[0] - b[0])
    let prevNode = -1
    for (let k = 0; k < entries.length; k++) {
      const [t, pt] = entries[k]
      const isWireStart = seg.t0 === 0 && t <= EPS && k === 0
      const isWireEnd = t >= 1 - EPS && k === entries.length - 1
      const wireEnd =
        seg.segIndex === 0 && isWireStart
          ? { wireId: seg.wireId, end: 0 as const }
          : isWireEnd
            ? { wireId: seg.wireId, end: 1 as const }
            : undefined
      const node = pointIndex.add(pt, wireEnd)
      if (prevNode >= 0 && node !== prevNode) {
        subEdges.push({ from: prevNode, to: node, wireId: seg.wireId })
      }
      prevNode = node
    }
  })

  const nodes = pointIndex.nodes

  // 3. 半边结构
  const halfEdges: GraphHalfEdge[] = []
  const outgoing: number[][] = nodes.map(() => [])
  for (const e of subEdges) {
    const h = halfEdges.length
    halfEdges.push({
      id: h,
      from: e.from,
      to: e.to,
      twin: h + 1,
      face: -1,
      wireId: e.wireId,
    })
    halfEdges.push({
      id: h + 1,
      from: e.to,
      to: e.from,
      twin: h,
      face: -1,
      wireId: e.wireId,
    })
    outgoing[e.from].push(h)
    outgoing[e.to].push(h + 1)
  }

  // 出边按极角排序（CCW），极角只算一次缓存到 angleAt
  const angleAt = new Float64Array(halfEdges.length)
  for (const list of outgoing) {
    for (const h of list) {
      angleAt[h] = angleOf(
        nodes[halfEdges[h].from].pos,
        nodes[halfEdges[h].to].pos,
      )
    }
    list.sort((h1, h2) => angleAt[h1] - angleAt[h2])
  }

  // 预算每条半边的"下一条"：
  // h: A→B，next(h) 在终点 B 的出边表里，取孪生边 twin(h)=B→A 的顺时针邻居
  // 遍历内不再做 indexOf / Map 查表
  const nextEdge = new Int32Array(halfEdges.length)
  const edgePosition = new Int32Array(halfEdges.length).fill(-1)
  for (let node = 0; node < outgoing.length; node++) {
    const list = outgoing[node]
    for (let i = 0; i < list.length; i++) edgePosition[list[i]] = i
    for (const outgoingHe of list) {
      const incoming = halfEdges[outgoingHe].twin
      const pos = edgePosition[outgoingHe]
      nextEdge[incoming] = list[(pos - 1 + list.length) % list.length]
    }
  }

  // 4. 面遍历
  const cells: EnclosedCell[] = []
  let faceId = 0
  for (const start of halfEdges) {
    if (start.face !== -1) continue
    const faceHalfEdges: number[] = []
    let signed = 0
    let cur = start.id
    do {
      halfEdges[cur].face = faceId
      faceHalfEdges.push(cur)
      const a = nodes[halfEdges[cur].from].pos
      const b = nodes[halfEdges[cur].to].pos
      signed += a.x * b.y - b.x * a.y
      cur = nextEdge[cur]
    } while (cur !== start.id)
    signed /= 2

    // 负面积=外面（顺时针）；零面积=重叠丝产生的退化面，跳过多边形分配
    if (signed < -EPS || Math.abs(signed) < 1e-6) {
      faceId++
      continue
    }
    const polygon = faceHalfEdges.map((h) => nodes[halfEdges[h].from].pos)
    cells.push({
      id: cells.length,
      halfEdges: faceHalfEdges,
      polygon,
      area: signed,
      centroid: polygonCentroid(polygon),
      isOuter: false,
    })
    faceId++
  }

  // 5. 缺口检测：度数为 1 的节点即未焊到任何丝上的自由丝端，一律标红
  const gaps: GapDefect[] = []
  nodes.forEach((node) => {
    if (outgoing[node.id].length !== 1) return
    const heId = outgoing[node.id][0]
    const he = halfEdges[heId]
    gaps.push({
      halfEdgeId: heId,
      from: he.from,
      to: he.to,
      pos: node.pos,
      reason: 'dangling-end',
    })
  })

  return { nodes, halfEdges, cells, gaps }
}

// 丝工告警：超大格 + 弯曲半径不足
export const buildWireWarnings = (
  wires: WirePath[],
  result: CellBuildResult,
  maxCellArea: number,
  minBendRadius: number,
): Array<{
  wireId: string
  type: 'min-radius' | 'oversize-cell'
  message: string
  radius?: number
  cellId?: number
  area?: number
}> => {
  const warnings: Array<{
    wireId: string
    type: 'min-radius' | 'oversize-cell'
    message: string
    radius?: number
    cellId?: number
    area?: number
  }> = []
  for (const wire of wires) {
    for (const seg of wire.segments) {
      const r = minRadiusOf(seg)
      if (r < minBendRadius) {
        warnings.push({
          wireId: wire.id,
          type: 'min-radius' as const,
          message: `弯曲半径 ${r.toFixed(2)}mm 小于最小值 ${minBendRadius}mm，掐不出来`,
          radius: r,
        })
      }
    }
  }
  for (const cell of result.cells) {
    if (cell.area > maxCellArea) {
      const wireId =
        result.halfEdges[cell.halfEdges[0]]?.wireId ?? 'unknown'
      warnings.push({
        wireId,
        type: 'oversize-cell' as const,
        message: `格 #${cell.id} 面积 ${cell.area.toFixed(1)}mm² 超上限 ${maxCellArea}mm²，建议加垫丝`,
        cellId: cell.id,
        area: cell.area,
      })
    }
  }
  return warnings
}
