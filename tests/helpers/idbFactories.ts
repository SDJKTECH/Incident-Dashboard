// Test doubles for IDBFactory used to simulate IndexedDB failures.

/** An indexedDB whose open() always fails with the given event. */
export function brokenFactory(event: 'onerror' | 'onblocked' | 'throw'): IDBFactory {
  return {
    open: (): IDBOpenDBRequest => {
      if (event === 'throw') throw new Error('SecurityError')
      const req = { error: new Error('open failed') } as unknown as IDBOpenDBRequest
      setTimeout(() => {
        const handler = req[event]
        if (typeof handler === 'function') handler.call(req, new Event(event) as never)
      }, 0)
      return req
    },
  } as unknown as IDBFactory
}

/** Real fake-indexeddb, but every readwrite transaction throws (e.g. quota). */
export function readOnlyFactory(real: IDBFactory): IDBFactory {
  return {
    open: (name: string, version?: number): IDBOpenDBRequest => {
      const req = real.open(name, version)
      return new Proxy(req, {
        get(target, prop): unknown {
          if (prop === 'result') {
            const db = target.result
            return new Proxy(db, {
              get(dt, dp): unknown {
                if (dp === 'transaction') {
                  return (s: string, mode?: IDBTransactionMode): IDBTransaction => {
                    if (mode === 'readwrite') throw new DOMException('quota', 'QuotaExceededError')
                    return dt.transaction(s, mode)
                  }
                }
                const v: unknown = Reflect.get(dt, dp, dt)
                return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(dt) : v
              },
            })
          }
          return Reflect.get(target, prop, target)
        },
        set(target, prop, value): boolean {
          return Reflect.set(target, prop, value, target)
        },
      })
    },
  } as unknown as IDBFactory
}
