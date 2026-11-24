import { db } from '@/db/database'
import type {
  CellGlazeConfig,
  FinishConfig,
  FiringConfig,
} from '@/core/types'
import { genId } from '@/db/database'

export const listCellConfigs = (orderId: string) =>
  db.cellConfigs.where('orderId').equals(orderId).toArray()

export const getCellConfig = async (
  orderId: string,
  cellId: number,
): Promise<CellGlazeConfig | undefined> =>
  db.cellConfigs.get([orderId, cellId])

export const upsertCellConfig = async (
  config: Omit<CellGlazeConfig, never> & { orderId: string },
): Promise<void> => {
  const existing = await db.cellConfigs.get([config.orderId, config.cellId])
  if (existing) {
    await db.cellConfigs.put({ ...existing, ...config })
    return
  }
  await db.cellConfigs.add({ ...config, id: genId('cfg') })
}

const defaultFiring = (orderId: string): FiringConfig => ({
  orderId,
  firings: 3,
  pinholeSeed: 20260101,
  maxCellArea: 1500,
  minBendRadius: 2,
})

export const getFiringConfig = async (
  orderId: string,
): Promise<FiringConfig> => {
  const cfg = await db.firingConfigs.get(orderId)
  return cfg ?? defaultFiring(orderId)
}

export const saveFiringConfig = async (cfg: FiringConfig): Promise<void> => {
  await db.firingConfigs.put(cfg)
}

const defaultFinish = (orderId: string): FinishConfig => ({
  orderId,
  polished: false,
  gilded: false,
  groundPattern: false,
})

export const getFinishConfig = async (
  orderId: string,
): Promise<FinishConfig> => {
  const cfg = await db.finishConfigs.get(orderId)
  return cfg ?? defaultFinish(orderId)
}

export const saveFinishConfig = async (cfg: FinishConfig): Promise<void> => {
  await db.finishConfigs.put(cfg)
}
