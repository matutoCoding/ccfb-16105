import { describe, expect, it } from 'vitest'
import type { BezierSegment, FlatSegment, WirePath } from '../types'
import { bezierLength, evalBezier, flattenSegment } from './bezier'
import { buildPlanarGraph, flattenWires } from './planar_graph'
import { segmentIntersect } from './intersect'

const seg = (points: BezierSegment['points']): BezierSegment => ({
  id: 's',
  degree: points.length === 3 ? 2 : 3,
  points,
})

const wire = (
  id: string,
  segments: BezierSegment[],
  isOutline = false,
): WirePath => ({
  id,
  orderId: 'o1',
  name: id,
  segments,
  width: 0.5,
  height: 0.8,
  isOutline,
  createdAt: 0,
  updatedAt: 0,
})

const line = (id: string, a: [number, number], b: [number, number]) =>
  wire(id, [
    seg([
      { x: a[0], y: a[1] },
      { x: b[0], y: b[1] },
    ]),
  ])

// 10x10 方框（外轮廓）
const squareWires = () => [
  line('w0', [0, 0], [10, 0]),
  line('w1', [10, 0], [10, 10]),
  line('w2', [10, 10], [0, 10]),
  line('w3', [0, 10], [0, 0]),
]

describe('贝塞尔细分', () => {
  it('直线段细分后首尾不变且长度精确', () => {
    const s = seg([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
    const pieces = flattenSegment(s)
    expect(pieces[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(pieces.at(-1)!.points[1]).toEqual({ x: 10, y: 0 })
    expect(bezierLength(s)).toBeCloseTo(10, 6)
  })

  it('三次曲线过端点且细分弦差在容差内', () => {
    const s = seg([
      { x: 0, y: 0 },
      { x: 3, y: 8 },
      { x: 7, y: 8 },
      { x: 10, y: 0 },
    ])
    expect(evalBezier(s, 0)).toEqual({ x: 0, y: 0 })
    expect(evalBezier(s, 1)).toEqual({ x: 10, y: 0 })
    const pieces = flattenSegment(s)
    expect(pieces.length).toBeGreaterThan(4)
    // 弧长不小于弦长
    expect(bezierLength(s)).toBeGreaterThan(10)
  })
})

describe('线段求交', () => {
  it('十字相交返回中点参数', () => {
    const hit = segmentIntersect(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    )
    expect(hit).not.toBeNull()
    expect(hit!.point.x).toBeCloseTo(5, 6)
    expect(hit!.point.y).toBeCloseTo(5, 6)
  })

  it('不相交返回 null', () => {
    expect(
      segmentIntersect(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ),
    ).toBeNull()
  })
})

describe('封闭格检测', () => {
  it('封闭方框枚举出一个面且无缺口', () => {
    const flats: FlatSegment[] = flattenWires(squareWires())
    const result = buildPlanarGraph(flats)
    expect(result.gaps).toHaveLength(0)
    expect(result.cells).toHaveLength(1)
    expect(result.cells[0].area).toBeCloseTo(100, 4)
  })

  it('缺一条边的方框必须报出两个自由端缺口', () => {
    const flats = flattenWires(squareWires().slice(0, 3))
    const result = buildPlanarGraph(flats)
    expect(result.cells).toHaveLength(0)
    // 两条开放链各留一个度数为 1 的端点
    expect(result.gaps.length).toBeGreaterThanOrEqual(2)
    expect(result.gaps.every((g) => g.reason === 'dangling-end')).toBe(true)
  })

  it('内部加一道隔丝后枚举两个面', () => {
    const wires = [...squareWires(), line('w4', [5, 0], [5, 10])]
    const result = buildPlanarGraph(flattenWires(wires))
    expect(result.gaps).toHaveLength(0)
    expect(result.cells).toHaveLength(2)
    const total = result.cells.reduce((sum, c) => sum + c.area, 0)
    expect(total).toBeCloseTo(100, 4)
  })

  it('端点间隙超过焊接容差（0.15mm）按缺口处理', () => {
    const wires = [
      line('w0', [0, 0], [10, 0]),
      line('w1', [10, 0], [10, 10]),
      line('w2', [10, 10], [0, 10]),
      line('w3', [0, 10], [0, 0.15]),
    ]
    const result = buildPlanarGraph(flattenWires(wires))
    expect(result.gaps.length).toBeGreaterThan(0)
  })

  it('丝间 T 型相交自动切分且不产生缺口', () => {
    // 横丝贯通方框，竖丝端点焊在横丝中段（真正的 T 型焊）
    const wires = [
      ...squareWires(),
      line('w4', [0, 5], [10, 5]),
      line('w5', [5, 5], [5, 10]),
    ]
    const result = buildPlanarGraph(flattenWires(wires))
    expect(result.gaps).toHaveLength(0)
    expect(result.cells.length).toBeGreaterThanOrEqual(3)
  })
})
