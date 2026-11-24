import { db, genId } from '@/db/database'
import type { BezierSegment, Vec2, WirePath } from '@/core/types'

export const listWires = (orderId: string) =>
  db.wires.where('orderId').equals(orderId).toArray()

export const createWire = async (
  orderId: string,
  points: Vec2[],
  degree: 2 | 3,
  isOutline = false,
): Promise<WirePath> => {
  const now = Date.now()
  const seg: BezierSegment = { id: genId('seg'), degree, points }
  const count = await db.wires.where('orderId').equals(orderId).count()
  const wire: WirePath = {
    id: genId('wire'),
    orderId,
    name: `丝 ${String(count + 1).padStart(3, '0')}`,
    segments: [seg],
    width: 0.5,
    height: 0.8,
    isOutline,
    createdAt: now,
    updatedAt: now,
  }
  await db.wires.add(wire)
  return wire
}

export const updateWire = async (
  id: string,
  patch: Partial<WirePath>,
): Promise<void> => {
  await db.wires.update(id, { ...patch, updatedAt: Date.now() })
}

export const deleteWire = async (id: string): Promise<void> => {
  await db.wires.delete(id)
}

// 胎体外轮廓：按直径生成圆形闭合丝（四段三次贝塞尔近似圆）
export const createOutlineWire = async (
  orderId: string,
  diameter: number,
): Promise<WirePath> => {
  const r = diameter / 2
  const c = r * 0.5523
  const cx = r
  const cy = r
  const arc = (
    p0: Vec2,
    p1: Vec2,
    p2: Vec2,
    p3: Vec2,
  ): BezierSegment => ({ id: genId('seg'), degree: 3, points: [p0, p1, p2, p3] })
  const now = Date.now()
  const wire: WirePath = {
    id: genId('wire'),
    orderId,
    name: '胎体外轮廓',
    width: 0.8,
    height: 1.0,
    isOutline: true,
    createdAt: now,
    updatedAt: now,
    segments: [
      arc({ x: cx + r, y: cy }, { x: cx + r, y: cy + c }, { x: cx + c, y: cy + r }, { x: cx, y: cy + r }),
      arc({ x: cx, y: cy + r }, { x: cx - c, y: cy + r }, { x: cx - r, y: cy + c }, { x: cx - r, y: cy }),
      arc({ x: cx - r, y: cy }, { x: cx - r, y: cy - c }, { x: cx - c, y: cy - r }, { x: cx, y: cy - r }),
      arc({ x: cx, y: cy - r }, { x: cx + c, y: cy - r }, { x: cx + r, y: cy - c }, { x: cx + r, y: cy }),
    ],
  }
  await db.wires.add(wire)
  return wire
}
