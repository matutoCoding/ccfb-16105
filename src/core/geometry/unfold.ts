import type { Vec2 } from '../types'

// 瓶身圆柱展开：3D 柱面坐标 -> 平面展开图坐标
// 展开图 x = 弧长，y = 高度；变形量 = 展开长度与弦长之差
export interface UnfoldResult {
  // 平面坐标，毫米
  planar: Vec2
  // 该点周向变形量，毫米（弧长 - 弦长投影）
  distortion: number
}

export const unfoldCylinder = (
  point: Vec2,
  radius: number,
  height: number,
): UnfoldResult => {
  // point.x 视为周向角度（弧度），point.y 视为高度比例
  const angle = point.x
  const planar = {
    x: radius * angle,
    y: point.y * height,
  }
  const chord = 2 * radius * Math.sin(angle / 2)
  const arc = radius * angle
  return { planar, distortion: arc - chord }
}

// 逆展开：平面展开图坐标 -> 胎面 3D 近似坐标（用于曲率预览）
export const refoldCylinder = (
  planar: Vec2,
  radius: number,
): { x: number; y: number; z: number } => {
  const angle = planar.x / radius
  return {
    x: radius * Math.cos(angle),
    y: planar.y,
    z: radius * Math.sin(angle),
  }
}

// 盘面曲率下的弧长修正：给定弦长与曲率半径，返回实际弧长
export const curvedArcLength = (
  chord: number,
  curvatureRadius: number,
): number => {
  if (!Number.isFinite(curvatureRadius) || curvatureRadius <= 0) return chord
  const theta = 2 * Math.asin(Math.min(1, chord / (2 * curvatureRadius)))
  return curvatureRadius * theta
}
