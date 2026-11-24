import type { EnclosedCell, WirePath } from '../types'
import { flattenSegment } from '../geometry/bezier'
import { polygonCentroid } from '../geometry/vec2'

const MM = 'mm'

// 1:1 打印 SVG：viewBox 与 width/height 均为毫米物理尺寸，
// 配合打印软件"实际大小/100%"输出，误差来源仅打印机本身
export const buildSvgDocument = (
  wires: WirePath[],
  cells: EnclosedCell[],
  worldW: number,
  worldH: number,
): string => {
  const wirePaths = wires
    .map((wire) => {
      const d = wireToPathD(wire)
      return `  <path d="${d}" fill="none" stroke="#1e293b" stroke-width="${wire.width}" stroke-linejoin="round" stroke-linecap="round" data-wire="${wire.id}"/>`
    })
    .join('\n')

  const cellLabels = cells
    .map((cell) => {
      const c = polygonCentroid(cell.polygon)
      return `  <text x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" font-size="3" fill="#b45309" text-anchor="middle" font-family="sans-serif">${cell.id}</text>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${worldW}${MM}" height="${worldH}${MM}" viewBox="0 0 ${worldW} ${worldH}">
  <rect x="0" y="0" width="${worldW}" height="${worldH}" fill="#ffffff"/>
${wirePaths}
${cellLabels}
</svg>
`
}

// 贝塞尔直接输出 SVG path 原生命令，打印端解析曲线而非折线，保证平滑
const wireToPathD = (wire: WirePath): string => {
  const parts: string[] = []
  let started = false
  for (const seg of wire.segments) {
    const [p0, ...rest] = seg.points
    if (!started) {
      parts.push(`M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)}`)
      started = true
    } else if (
      Math.abs(p0.x - lastEnd(parts).x) > 1e-6 ||
      Math.abs(p0.y - lastEnd(parts).y) > 1e-6
    ) {
      parts.push(`M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)}`)
    }
    if (seg.degree === 2) {
      const [p1, p2] = rest
      parts.push(
        `Q ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
      )
    } else {
      const [p1, p2, p3] = rest
      parts.push(
        `C ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} ${p3.x.toFixed(3)} ${p3.y.toFixed(3)}`,
      )
    }
  }
  return parts.join(' ')
}

// 维护当前路径终点，避免段间断线
const lastEnd = (parts: string[]): { x: number; y: number } => {
  const last = parts[parts.length - 1]
  const nums = last.split(/[\s,]+/).slice(-2).map(Number)
  return { x: nums[0], y: nums[1] }
}

// 下载触发
export const downloadSvg = (svg: string, filename: string): void => {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 供画布预览用的扁平化折线路径
export const wireToPolylinePoints = (wire: WirePath): string => {
  const pts: string[] = []
  for (const seg of wire.segments) {
    const pieces = flattenSegment(seg)
    pieces.forEach((p, i) => {
      if (pts.length === 0 || i === 0) {
        pts.push(`${p.points[0].x.toFixed(2)},${p.points[0].y.toFixed(2)}`)
      }
      pts.push(`${p.points[1].x.toFixed(2)},${p.points[1].y.toFixed(2)}`)
    })
  }
  return pts.join(' ')
}
