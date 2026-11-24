import type {
  CellGlazeConfig,
  EnclosedCell,
  FlatSegment,
  Glaze,
} from '../types'
import { GlProgram, createGlContext } from './gl_program'
import {
  DISTANCE_FRAG,
  FIRING_FRAG,
  FULLSCREEN_VERT,
} from './shaders'

const TEXELS_PER_ROW = 2048
const MAX_SEGMENTS = 4096

export interface FiringRenderParams {
  firings: number
  requiredCoats: number
  pinholeSeed: number
  pinholeDensity: number
  wireWidth: number
  wireHeight: number
  polished: boolean
  gilded: boolean
  groundPattern: boolean
}

// 距离场 + 烧制预览渲染器
// 线段数据写入 RGBA32F 纹理，距离场渲染到 R32F 离屏纹理，再合成釉面
export class DistanceFieldRenderer {
  private gl: WebGL2RenderingContext
  private distanceProgram: GlProgram
  private firingProgram: GlProgram
  private vao: WebGLVertexArrayObject
  private segmentTex: WebGLTexture
  private cellColorTex: WebGLTexture
  private distanceTex: WebGLTexture
  private fbo: WebGLFramebuffer
  private segCount = 0
  private width = 1
  private height = 1

  constructor(private canvas: HTMLCanvasElement) {
    const gl = createGlContext(canvas)
    this.gl = gl
    this.distanceProgram = new GlProgram(gl, FULLSCREEN_VERT, DISTANCE_FRAG)
    this.firingProgram = new GlProgram(gl, FULLSCREEN_VERT, FIRING_FRAG)

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('无法创建 VAO')
    this.vao = vao
    gl.bindVertexArray(vao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.segmentTex = this.createFloatTexture(TEXELS_PER_ROW, 2)
    this.cellColorTex = this.createByteTexture(1, 1)
    this.distanceTex = this.createFloatTexture(1, 1)
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new Error('无法创建 FBO')
    this.fbo = fbo
  }

  private createFloatTexture(w: number, h: number): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('无法创建纹理')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      w,
      h,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  private createByteTexture(w: number, h: number): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('无法创建纹理')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  // 全量更新线段纹理；改单根丝的场景由上层做差量后调用
  uploadSegments(segments: FlatSegment[], worldH: number): void {
    const gl = this.gl
    if (segments.length > MAX_SEGMENTS) {
      throw new Error(`线段数 ${segments.length} 超过单次上限 ${MAX_SEGMENTS}`)
    }
    const data = new Float32Array(TEXELS_PER_ROW * 2 * 4)
    segments.forEach((s, i) => {
      data[i * 4] = s.a.x
      data[i * 4 + 1] = worldH - s.a.y
      data[i * 4 + 2] = s.b.x
      data[i * 4 + 3] = worldH - s.b.y
    })
    gl.bindTexture(gl.TEXTURE_2D, this.segmentTex)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      TEXELS_PER_ROW,
      2,
      gl.RGBA,
      gl.FLOAT,
      data,
    )
    this.segCount = segments.length
  }

  // 格内釉色烘焙成 RGBA8 纹理（CPU 光栅化多边形 + 晕染）
  uploadCellColors(
    cells: EnclosedCell[],
    configs: Map<number, CellGlazeConfig>,
    glazeMap: Map<string, Glaze>,
    worldW: number,
    worldH: number,
  ): void {
    const gl = this.gl
    const scale = 2 // 0.5mm/像素，控制纹理内存
    const w = Math.max(1, Math.round(worldW * scale))
    const h = Math.max(1, Math.round(worldH * scale))
    const pixels = new Uint8Array(w * h * 4).fill(245, 0).fill(255, 3, 4)
    for (const cell of cells) {
      const cfg = configs.get(cell.id)
      if (!cfg || cfg.stops.length === 0) continue
      this.rasterizeCell(cell, cfg, glazeMap, pixels, w, h, scale, worldH)
    }
    gl.bindTexture(gl.TEXTURE_2D, this.cellColorTex)
    if (w !== this.width || h !== this.height) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      )
      this.width = w
      this.height = h
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        w,
        h,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      )
    }
  }

  private rasterizeCell(
    cell: EnclosedCell,
    cfg: CellGlazeConfig,
    glazeMap: Map<string, Glaze>,
    pixels: Uint8Array,
    w: number,
    h: number,
    scale: number,
    worldH: number,
  ): void {
    const minX = Math.floor(Math.min(...cell.polygon.map((p) => p.x)) * scale)
    const maxX = Math.ceil(Math.max(...cell.polygon.map((p) => p.x)) * scale)
    const minY = Math.floor(Math.min(...cell.polygon.map((p) => p.y)) * scale)
    const maxY = Math.ceil(Math.max(...cell.polygon.map((p) => p.y)) * scale)
    const dir = { x: Math.cos(cfg.blendAngle), y: Math.sin(cfg.blendAngle) }
    const stops = cfg.stops
      .map((s) => ({ stop: s, glaze: glazeMap.get(s.glazeId) }))
      .filter((s): s is { stop: CellGlazeConfig['stops'][number]; glaze: Glaze } => Boolean(s.glaze))
    if (stops.length === 0) return

    for (let py = minY; py <= maxY && py < h; py++) {
      for (let px = minX; px <= maxX && px < w; px++) {
        const world = { x: (px + 0.5) / scale, y: worldH - (py + 0.5) / scale }
        if (!pointInPolygon(world, cell.polygon)) continue
        const rel = {
          x: world.x - cell.centroid.x,
          y: world.y - cell.centroid.y,
        }
        const t =
          0.5 +
          (rel.x * dir.x + rel.y * dir.y) /
            Math.max(1, Math.sqrt(cell.area) * 1.2)
        const color = sampleGradient(stops, clamp01(t), cfg.blendWidth)
        const idx = (py * w + px) * 4
        pixels[idx] = color[0]
        pixels[idx + 1] = color[1]
        pixels[idx + 2] = color[2]
      }
    }
  }

  resize(cssW: number, cssH: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(cssW * dpr))
    const h = Math.max(1, Math.round(cssH * dpr))
    if (this.canvas.width === w && this.canvas.height === h) return
    this.canvas.width = w
    this.canvas.height = h
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.distanceTex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      w,
      h,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    )
  }

  render(worldW: number, worldH: number, params: FiringRenderParams): void {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    gl.bindVertexArray(this.vao)
    gl.disable(gl.DEPTH_TEST)

    // Pass 1：距离场写入 R32F
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.distanceTex,
      0,
    )
    gl.viewport(0, 0, w, h)
    this.distanceProgram.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.segmentTex)
    gl.uniform1i(this.distanceProgram.uniform('u_segments'), 0)
    gl.uniform1i(this.distanceProgram.uniform('u_segCount'), this.segCount)
    gl.uniform2f(this.distanceProgram.uniform('u_worldSize'), worldW, worldH)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Pass 2：烧制效果合成到画布
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    this.firingProgram.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.distanceTex)
    gl.uniform1i(this.firingProgram.uniform('u_distance'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.cellColorTex)
    gl.uniform1i(this.firingProgram.uniform('u_cellColor'), 1)
    gl.uniform2f(this.firingProgram.uniform('u_worldSize'), worldW, worldH)
    gl.uniform1f(this.firingProgram.uniform('u_wireWidth'), params.wireWidth)
    gl.uniform1f(this.firingProgram.uniform('u_wireHeight'), params.wireHeight)
    gl.uniform1i(this.firingProgram.uniform('u_firings'), params.firings)
    gl.uniform1i(
      this.firingProgram.uniform('u_requiredCoats'),
      params.requiredCoats,
    )
    gl.uniform1i(
      this.firingProgram.uniform('u_pinholeSeed'),
      params.pinholeSeed,
    )
    gl.uniform1f(
      this.firingProgram.uniform('u_pinholeDensity'),
      params.pinholeDensity,
    )
    gl.uniform1i(
      this.firingProgram.uniform('u_gilded'),
      params.gilded ? 1 : 0,
    )
    gl.uniform1i(
      this.firingProgram.uniform('u_polished'),
      params.polished ? 1 : 0,
    )
    gl.uniform1i(
      this.firingProgram.uniform('u_groundPattern'),
      params.groundPattern ? 1 : 0,
    )
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteTexture(this.segmentTex)
    gl.deleteTexture(this.cellColorTex)
    gl.deleteTexture(this.distanceTex)
    gl.deleteFramebuffer(this.fbo)
    gl.deleteVertexArray(this.vao)
  }
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

const pointInPolygon = (
  p: { x: number; y: number },
  poly: { x: number; y: number }[],
): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersect) inside = !inside
  }
  return inside
}

const sampleGradient = (
  stops: Array<{
    stop: { offset: number }
    glaze: Glaze
  }>,
  t: number,
  blendWidth: number,
): [number, number, number] => {
  const sorted = [...stops].sort((a, b) => a.stop.offset - b.stop.offset)
  if (t <= sorted[0].stop.offset) return sorted[0].glaze.color
  if (t >= sorted.at(-1)!.stop.offset) return sorted.at(-1)!.glaze.color
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.stop.offset && t <= b.stop.offset) {
      const span = Math.max(1e-4, b.stop.offset - a.stop.offset)
      const local = (t - a.stop.offset) / span
      const eased = clamp01((local - 0.5) / Math.max(0.05, blendWidth) + 0.5)
      return [
        Math.round(a.glaze.color[0] + (b.glaze.color[0] - a.glaze.color[0]) * eased),
        Math.round(a.glaze.color[1] + (b.glaze.color[1] - a.glaze.color[1]) * eased),
        Math.round(a.glaze.color[2] + (b.glaze.color[2] - a.glaze.color[2]) * eased),
      ]
    }
  }
  return sorted[0].glaze.color
}
