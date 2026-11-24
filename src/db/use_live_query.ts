import { liveQuery, type Subscription } from 'dexie'
import {
  shallowRef,
  onScopeDispose,
  getCurrentScope,
  type ShallowRef,
} from 'vue'

// Dexie liveQuery -> Vue shallowRef，组件作用域内自动退订
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
): ShallowRef<T | undefined> {
  const data = shallowRef<T>()
  const observable = liveQuery(querier)
  const subscription: Subscription = observable.subscribe({
    next: (value) => {
      data.value = value
    },
    error: (err) => {
      throw err
    },
  })
  if (getCurrentScope()) {
    onScopeDispose(() => subscription.unsubscribe())
  }
  return data
}
