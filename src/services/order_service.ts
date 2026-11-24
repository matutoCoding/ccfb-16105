import { db, genId } from '@/db/database'
import type { BodyType, Order } from '@/core/types'
import { dayjs } from '@/libs'

export interface OrderInput {
  customer: string
  bodyType: BodyType
  diameter: number
  curvature: number
  title: string
  referenceImage: string | null
  unfoldWidth: number
  unfoldHeight: number
}

export const listOrders = () => db.orders.orderBy('createdAt').reverse().toArray()

export const getOrder = (id: string) => db.orders.get(id)

export const createOrder = async (input: OrderInput): Promise<Order> => {
  const now = Date.now()
  const order: Order = {
    id: genId('ord'),
    code: `PO-${dayjs(now).format('YYYYMMDD')}-${now.toString(36).slice(-4).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    ...input,
  }
  await db.orders.add(order)
  return order
}

export const updateOrder = async (
  id: string,
  patch: Partial<OrderInput>,
): Promise<void> => {
  await db.orders.update(id, { ...patch, updatedAt: Date.now() })
}

export const deleteOrder = async (id: string): Promise<void> => {
  await db.transaction(
    'rw',
    [db.orders, db.wires, db.cellConfigs, db.firingConfigs, db.finishConfigs],
    async () => {
      await db.wires.where('orderId').equals(id).delete()
      await db.cellConfigs.where('orderId').equals(id).delete()
      await db.firingConfigs.where('orderId').equals(id).delete()
      await db.finishConfigs.where('orderId').equals(id).delete()
      await db.orders.delete(id)
    },
  )
}

// 图片压缩到 dataURL，控制 IndexedDB 单条体积
export const fileToDataUrl = (file: File, maxSize = 1600): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
