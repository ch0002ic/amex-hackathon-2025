type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  clear(): void {
    this.store.clear()
  }
}
