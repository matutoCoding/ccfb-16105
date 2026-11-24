// WebGL2 最小封装：着色器编译、程序链接、uniform 缓存
export class GlProgram {
  readonly program: WebGLProgram
  private uniforms = new Map<string, WebGLUniformLocation | null>()
  private attribs = new Map<string, number>()

  constructor(
    private gl: WebGL2RenderingContext,
    vertexSrc: string,
    fragmentSrc: string,
  ) {
    const vs = this.compile(gl.VERTEX_SHADER, vertexSrc)
    const fs = this.compile(gl.FRAGMENT_SHADER, fragmentSrc)
    const program = gl.createProgram()
    if (!program) throw new Error('无法创建 WebGL 程序')
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      throw new Error(`着色器链接失败: ${log}`)
    }
    this.program = program
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)
    if (!shader) throw new Error('无法创建着色器')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      throw new Error(`着色器编译失败: ${log}\n${source}`)
    }
    return shader
  }

  use(): void {
    this.gl.useProgram(this.program)
  }

  uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name))
    }
    return this.uniforms.get(name) ?? null
  }

  attrib(name: string): number {
    if (!this.attribs.has(name)) {
      this.attribs.set(name, this.gl.getAttribLocation(this.program, name))
    }
    return this.attribs.get(name)!
  }
}

export const createGlContext = (
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext => {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    preserveDrawingBuffer: true,
  })
  if (!gl) throw new Error('当前浏览器不支持 WebGL2')
  return gl
}
