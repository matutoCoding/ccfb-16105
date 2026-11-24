import type { BezierSegment, Vec2 } from '../types'
import { dist, lerpVec, sub } from './vec2'

// 弦差容差：毫米。打印精度要求 0.2mm，细分取其四分之一留余量
export const FLATNESS_TOLERANCE = 0.05

const deCasteljau = (points: Vec2[], t: number): Vec2[] => {
  const next: Vec2[] = []
  for (let i = 0; i < points.length - 1; i++) {
    next.push(lerpVec(points[i], points[i + 1], t))
  }
  return next
}

export const evalBezier = (seg: BezierSegment, t: number): Vec2 => {
  let pts = seg.points
  while (pts.length > 1) pts = deCasteljau(pts, t)
  return pts[0]
}

export const evalBezierDerivative = (seg: BezierSegment, t: number): Vec2 => {
  const n = seg.points.length - 1
  const dPts: Vec2[] = []
  for (let i = 0; i < n; i++) {
    dPts.push(sub(seg.points[i + 1], seg.points[i]))
  }
  let pts = dPts
  while (pts.length > 1) pts = deCasteljau(pts, t)
  return scaleVec(pts[0], n)
}

const scaleVec = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })

// 控制点到弦的最大垂直距离，作为平直度判据
const maxControlOffset = (points: Vec2[]): number => {
  const start = points[0]
  const end = points[points.length - 1]
  let max = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDist(points[i], start, end)
    if (d > max) max = d
  }
  return max
}

const pointLineDist = (p: Vec2, a: Vec2, b: Vec2): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  const cross = (p.x - a.x) * dy - (p.y - a.y) * dx
  return Math.abs(cross) / Math.sqrt(lenSq)
}

export interface FlatPiece {
  points: Vec2[]
  t0: number
  t1: number
}

// 递归细分，返回参数区间与折线点
const subdivide = (
  points: Vec2[],
  t0: number,
  t1: number,
  out: FlatPiece[],
): void => {
  if (maxControlOffset(points) <= FLATNESS_TOLERANCE) {
    out.push({ points: [points[0], points[points.length - 1]], t0, t1 })
    return
  }
  const mid = 0.5
  let left = points
  let rights: Vec2[][] = []
  let current = points
  // de Casteljau 同时切出左右两段控制多边形
  const levels: Vec2[][] = [points]
  while (current.length > 1) {
    current = deCasteljau(current, mid)
    levels.push(current)
  }
  const leftPts = levels.map((lv) => lv[0])
  const rightPts = levels.map((lv) => lv[lv.length - 1]).reverse()
  left = leftPts
  rights = [rightPts]
  const tm = (t0 + t1) / 2
  subdivide(left, t0, tm, out)
  subdivide(rights[0], tm, t1, out)
}

export const flattenSegment = (seg: BezierSegment): FlatPiece[] => {
  const out: FlatPiece[] = []
  subdivide(seg.points, 0, 1, out)
  return out
}

// 弧长：细分折线长度之和
export const bezierLength = (seg: BezierSegment): number => {
  const pieces = flattenSegment(seg)
  let total = 0
  for (const p of pieces) total += dist(p.points[0], p.points[1])
  return total
}

// 三点外接圆半径，用于弯曲半径估算
export const circumRadius = (a: Vec2, b: Vec2, c: Vec2): number => {
  const ab = dist(a, b)
  const bc = dist(b, c)
  const ca = dist(c, a)
  const area4 =
    Math.abs(
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
    ) * 2
  if (area4 === 0) return Infinity
  return (ab * bc * ca) / area4
}

// 沿曲线采样的最小弯曲半径
export const minRadiusOf = (seg: BezierSegment, samples = 16): number => {
  const pts: Vec2[] = []
  for (let i = 0; i <= samples; i++) pts.push(evalBezier(seg, i / samples))
  let min = Infinity
  for (let i = 1; i < pts.length - 1; i++) {
    const r = circumRadius(pts[i - 1], pts[i], pts[i + 1])
    if (r < min) min = r
  }
  return min
}
