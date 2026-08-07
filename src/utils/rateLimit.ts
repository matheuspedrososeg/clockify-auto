const MAX_CONCURRENT = 4
const MIN_INTERVAL_MS = 120

/** Days are inserted a few at a time so the row badges progress instead of all blinking at once. */
export const ROW_CONCURRENCY = 4

type Slot = (delay: number) => void

const queue: Slot[] = []
let active = 0
let lastStart = 0

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const slot = queue.shift()!
    active++
    const now = Date.now()
    // Reserving the start instant synchronously is what enforces the spacing: reading
    // lastStart after an await would let two slots pick the same instant and fire together.
    const start = Math.max(now, lastStart + MIN_INTERVAL_MS)
    lastStart = start
    slot(start - now)
  }
}

export function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(async delay => {
      if (delay > 0) await sleep(delay)
      try {
        resolve(await task())
      } catch (err) {
        reject(err)
      } finally {
        active--
        pump()
      }
    })
    pump()
  })
}

/** Pushes the whole queue forward, so a 429 slows every pending request and not just its own. */
export function penalize(ms: number) {
  lastStart = Math.max(lastStart, Date.now() + ms)
}

export async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
