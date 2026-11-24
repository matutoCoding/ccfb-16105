import type { WirePath } from '../types'
import { bezierLength, evalBezier, minRadiusOf } from './bezier'

export interface WireBomItem {
  wireId: string
  name: string
  // 总长度，毫米
  length: number
  // 弯折次数：相邻段方向变化超过 15 度计一次
  bendCount: number
  minRadius: number
  width: number
  height: number
}

const BEND_ANGLE = (15 * Math.PI) / 180

const directionAt = (wire: WirePath, index: number, t: number) => {
  const seg = wire.segments[index]
  const p0 = evalBezier(seg, t)
  const p1 = evalBezier(seg, Math.min(1, t + 0.01))
  return { x: p1.x - p0.x, y: p1.y - p0.y }
}

const angleBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => {
  const la = Math.hypot(a.x, a.y)
  const lb = Math.hypot(b.x, b.y)
  if (la === 0 || lb === 0) return 0
  const cos = (a.x * b.x + a.y * b.y) / (la * lb)
  return Math.acos(Math.min(1, Math.max(-1, cos)))
}

export const buildWireBom = (wires: WirePath[]): WireBomItem[] =>
  wires.map((wire) => {
    let length = 0
    let bendCount = 0
    let minRadius = Infinity
    for (let i = 0; i < wire.segments.length; i++) {
      const seg = wire.segments[i]
      length += bezierLength(seg)
      minRadius = Math.min(minRadius, minRadiusOf(seg))
      if (i > 0) {
        const prev = directionAt(wire, i - 1, 0.99)
        const next = directionAt(wire, i, 0)
        if (angleBetween(prev, next) > BEND_ANGLE) bendCount++
      }
    }
    return {
      wireId: wire.id,
      name: wire.name,
      length,
      bendCount,
      minRadius,
      width: wire.width,
      height: wire.height,
    }
  })
