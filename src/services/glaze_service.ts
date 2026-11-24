import { db, genId } from '@/db/database'
import type { Glaze } from '@/core/types'

export const listGlazes = () => db.glazes.orderBy('code').toArray()

export const createGlaze = async (input: Omit<Glaze, 'id' | 'createdAt'>): Promise<Glaze> => {
  const glaze: Glaze = { ...input, id: genId('glz'), createdAt: Date.now() }
  await db.glazes.add(glaze)
  return glaze
}

export const updateGlaze = async (id: string, patch: Partial<Glaze>): Promise<void> => {
  await db.glazes.update(id, patch)
}

export const deleteGlaze = async (id: string): Promise<void> => {
  await db.glazes.delete(id)
}

// 首次使用时的种子釉料，覆盖常见珐琅色
export const seedGlazesIfEmpty = async (): Promise<void> => {
  const count = await db.glazes.count()
  if (count > 0) return
  const now = Date.now()
  const seeds: Array<Omit<Glaze, 'id' | 'createdAt'>> = [
    { code: 'OP-01', name: '霁蓝', opaque: true, color: [28, 58, 112], remark: '不透明主色' },
    { code: 'OP-02', name: '矾红', opaque: true, color: [168, 42, 38], remark: '不透明主色' },
    { code: 'OP-03', name: '娇黄', opaque: true, color: [224, 178, 67], remark: '不透明主色' },
    { code: 'OP-04', name: '松绿', opaque: true, color: [58, 124, 92], remark: '不透明主色' },
    { code: 'OP-05', name: '月白', opaque: true, color: [238, 236, 228], remark: '不透明底' },
    { code: 'TR-01', name: '水晶透', opaque: false, color: [210, 226, 235], ior: 1.52, remark: '透明罩釉' },
    { code: 'TR-02', name: '琥珀透', opaque: false, color: [196, 138, 62], ior: 1.5, remark: '透明暖色' },
    { code: 'TR-03', name: '湖蓝透', opaque: false, color: [96, 158, 178], ior: 1.49, remark: '透明冷色' },
  ]
  await db.glazes.bulkAdd(seeds.map((s) => ({ ...s, id: genId('glz'), createdAt: now })))
}
