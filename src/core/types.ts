// 领域模型：全系统几何单位统一为毫米，平面坐标基于胎面展开图

export type BodyType = 'plate' | 'vase' | 'figurine'

// 二次/三次贝塞尔段，degree 决定控制点数量
export interface BezierSegment {
  id: string
  degree: 2 | 3
  // 二次：[p0, p1, p2]；三次：[p0, p1, p2, p3]
  points: Vec2[]
}

export interface Vec2 {
  x: number
  y: number
}

// 铜丝：一根丝由多段贝塞尔首尾相接组成
export interface WirePath {
  id: string
  orderId: string
  name: string
  segments: BezierSegment[]
  // 扁丝截面尺寸，毫米
  width: number
  height: number
  // 是否为胎体外轮廓丝（围出胎面边界）
  isOutline: boolean
  createdAt: number
  updatedAt: number
}

// 求交拆分后的直线段（带所属丝与参数信息）
export interface FlatSegment {
  wireId: string
  segIndex: number
  // 段在原贝塞尔上的参数区间 [t0, t1]
  t0: number
  t1: number
  a: Vec2
  b: Vec2
}

// 平面求交图节点：丝端点、丝间交点、snap 合并点
export interface GraphNode {
  id: number
  pos: Vec2
  // 汇聚到此节点的原始丝端点（wireId, 端序 0=首 1=尾）
  wireEnds: Array<{ wireId: string; end: 0 | 1 }>
}

export interface GraphHalfEdge {
  id: number
  from: number
  to: number
  twin: number
  face: number
  wireId: string
}

// 枚举得到的封闭面 = 一个填釉格
export interface EnclosedCell {
  id: number
  // 构成面边界的半边 id，逆时针
  halfEdges: number[]
  polygon: Vec2[]
  area: number
  centroid: Vec2
  isOuter: boolean
}

// 漏釉缺口：未围成封闭格的半边
export interface GapDefect {
  halfEdgeId: number
  from: number
  to: number
  pos: Vec2
  reason: 'dangling-end' | 'open-chain'
}

export interface CellBuildResult {
  nodes: GraphNode[]
  halfEdges: GraphHalfEdge[]
  cells: EnclosedCell[]
  gaps: GapDefect[]
}

// 丝工检测告警
export interface WireWarning {
  wireId: string
  type: 'min-radius' | 'oversize-cell'
  message: string
  radius?: number
  cellId?: number
  area?: number
}

// 釉料
export interface Glaze {
  id: string
  code: string
  name: string
  opaque: boolean
  // 基底色 RGB 0-255
  color: [number, number, number]
  // 透明釉折射率（影响反光强度），不透明釉忽略
  ior?: number
  remark: string
  createdAt: number
}

// 格内晕染停色点（最多三色）
export interface CellGlazeStop {
  glazeId: string
  // 格内位置权重 0-1，沿晕染方向
  offset: number
}

export interface CellGlazeConfig {
  // IndexedDB 主键，纯持久层字段
  id?: string
  cellId: number
  stops: CellGlazeStop[]
  // 晕染方向，弧度
  blendAngle: number
  // 过渡宽度 0-1
  blendWidth: number
  // 填釉遍数
  coats: number
}

// 胎型订单
export interface Order {
  id: string
  code: string
  customer: string
  bodyType: BodyType
  // 胎面直径，毫米
  diameter: number
  // 曲率：盘面取 0，瓶身取曲率半径倒数 1/mm
  curvature: number
  title: string
  // 客户原图，dataURL
  referenceImage: string | null
  // 瓶身展开：周长与高度，毫米
  unfoldWidth: number
  unfoldHeight: number
  createdAt: number
  updatedAt: number
}

// 烧制预览配置
export interface FiringConfig {
  orderId: string
  // 烧制遍数
  firings: number
  // 砂眼随机种子
  pinholeSeed: number
  // 单格面积上限，平方毫米
  maxCellArea: number
  // 最小弯曲半径，毫米
  minBendRadius: number
}

// 磨光镀金配置
export interface FinishConfig {
  orderId: string
  polished: boolean
  gilded: boolean
  // 透明釉下是否錾地纹
  groundPattern: boolean
}
