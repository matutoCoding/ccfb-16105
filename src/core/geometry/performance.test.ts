import { describe, expect, it } from 'vitest'
import type { BezierSegment, WirePath } from '../types'
import { buildPlanarGraph, flattenWires } from './planar_graph'

const cubic = (
  id: string,
  x: number,
  y: number,
): BezierSegment => ({
  id,
  degree: 3,
  points: [
    { x, y },
    { x: x + 2.5, y: y + 4 },
    { x: x + 7.5, y: y - 4 },
    { x: x + 10, y },
  ],
})

// 1000 根互不相交的三次贝塞尔丝，铺在网格上
const buildThousandWires = (): WirePath[] => {
  const wires: WirePath[] = []
  let n = 0
  for (let row = 0; row < 40 && n < 1000; row++) {
    for (let col = 0; col < 25 && n < 1000; col++) {
      wires.push({
        id: `w${n}`,
        orderId: 'o',
        name: `丝 ${n}`,
        segments: [cubic(`s${n}`, col * 12, row * 12)],
        width: 0.5,
        height: 0.8,
        isOutline: false,
        createdAt: 0,
        updatedAt: 0,
      })
      n++
    }
  }
  return wires
}

describe('千丝性能指标', () => {
  it('1000 根丝的细分+求交+面枚举在 50ms 内完成', () => {
    const wires = buildThousandWires()
    expect(wires).toHaveLength(1000)
    // 预热一轮让 JIT 生效，再取计时，贴近真实编辑场景的稳态表现
    buildPlanarGraph(flattenWires(wires))
    const start = performance.now()
    const flats = flattenWires(wires)
    const result = buildPlanarGraph(flats)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
    // 每根开放丝两端都是自由端，共 2000 个缺口，一个不漏
    expect(result.gaps).toHaveLength(2000)
  })
})
