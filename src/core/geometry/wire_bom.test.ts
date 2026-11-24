import { describe, expect, it } from 'vitest'
import type { WirePath } from '../types'
import { buildWireBom } from './wire_bom'
import { mulberry32, pinholeCount } from '../firing/random'

const wire = (id: string, points: WirePath['segments'][number]['points']): WirePath => ({
  id,
  orderId: 'o',
  name: id,
  segments: [
    {
      id: `${id}-seg`,
      degree: points.length === 3 ? 2 : 3,
      points,
    },
  ],
  width: 0.5,
  height: 0.8,
  isOutline: false,
  createdAt: 0,
  updatedAt: 0,
})

describe('丝料清单', () => {
  it('直线丝长度精确且无弯折', () => {
    const bom = buildWireBom([
      wire('w1', [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ]),
    ])
    expect(bom[0].length).toBeCloseTo(20, 5)
    expect(bom[0].bendCount).toBe(0)
  })

  it('直角两段丝计一次弯折', () => {
    const w: WirePath = {
      ...wire('w2', [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    }
    w.segments.push({
      id: 's2',
      degree: 2,
      points: [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    })
    const bom = buildWireBom([w])
    expect(bom[0].bendCount).toBe(1)
    expect(bom[0].length).toBeCloseTo(20, 5)
  })
})

describe('种子随机', () => {
  it('同种子序列完全一致', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 8 }, a)
    const seqB = Array.from({ length: 8 }, b)
    expect(seqA).toEqual(seqB)
  })

  it('不同种子序列不同', () => {
    const a = mulberry32(1)()
    const b = mulberry32(2)()
    expect(a).not.toEqual(b)
  })

  it('砂眼数量随釉厚不足而增多', () => {
    const thin = pinholeCount(2000, 0.4, 7)
    const full = pinholeCount(2000, 1, 7)
    expect(thin).toBeGreaterThanOrEqual(full)
  })
})
