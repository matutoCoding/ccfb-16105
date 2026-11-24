import Dexie, { type Table } from 'dexie'
import type {
  CellGlazeConfig,
  FinishConfig,
  FiringConfig,
  Glaze,
  Order,
  WirePath,
} from '@/core/types'

export class AppDatabase extends Dexie {
  orders!: Table<Order, string>
  wires!: Table<WirePath, string>
  glazes!: Table<Glaze, string>
  cellConfigs!: Table<CellGlazeConfig, string>
  firingConfigs!: Table<FiringConfig, string>
  finishConfigs!: Table<FinishConfig, string>

  constructor() {
    super('cloisonne-workbench')
    this.version(1).stores({
      orders: 'id, code, bodyType, createdAt',
      wires: 'id, orderId, isOutline, updatedAt',
      glazes: 'id, code, opaque',
      // 复合主键用 orderId+cellId
      cellConfigs: '[orderId+cellId], orderId',
      firingConfigs: 'orderId',
      finishConfigs: 'orderId',
    })
  }
}

export const db = new AppDatabase()

// 时间序 id，避免依赖随机数
export const genId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
