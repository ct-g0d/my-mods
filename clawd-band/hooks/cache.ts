// Prompt cache prices and the arithmetic the cold-send guard shows. The table is
// cache-tax's (Karan Bansal, MIT): $ per million tokens, [cache read, 1h cache write, output],
// list prices October 2026, more specific families first.
const PRICES: Array<[string | RegExp, number, number, number]> = [
  ['fable-5-1', 0.25, 20, 50],
  ['mythos-5-1', 0.25, 20, 50],
  ['fable-5', 1, 20, 50],
  ['mythos-5', 1, 20, 50],
  ['opus-5-5', 0.2, 8, 20],
  ['opus-5', 0.5, 10, 25],
  // Opus 4 and 4.1 in every spelling, never Opus 4.5 and later.
  [/opus-4(?:-[01])?(?:$|[^-\d]|-20\d{6})/, 1.5, 30, 75],
  ['opus-4', 0.5, 10, 25],
  ['sonnet-5-5', 0.1, 4, 10],
  ['sonnet-5', 0.2, 4, 10],
  ['sonnet', 0.3, 6, 15],
  ['haiku-5-5', 0.01, 0.2, 0.5],
  ['3-5-haiku', 0.08, 1.6, 4],
  ['haiku-3-5', 0.08, 1.6, 4],
  ['haiku', 0.1, 2, 5],
]
// Haiku 5.5 charges more for a prompt over 100k tokens.
const LONG_PROMPT_TOKENS = 100000
const LONG_PRICES: Array<[string, number, number, number]> = [['haiku-5-5', 0.05, 1, 2.5]]

export type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export function priceOf(model: string, promptTokens: number): [number, number, number] | null {
  const m = model.toLowerCase().replace(/[\s.]+/g, '-')
  if (promptTokens > LONG_PROMPT_TOKENS) for (const [family, ...p] of LONG_PRICES) if (m.includes(family)) return p
  for (const [family, ...p] of PRICES) if (typeof family === 'string' ? m.includes(family) : family.test(m)) return p
  return null
}

/** What a cold send pays to write `tokens` back into the cache. */
export function coldUsd(model: string, tokens: number): number | null {
  const p = priceOf(model, tokens)
  return p ? (tokens * p[1]) / 1e6 : null
}

export const usd = (n: number | null) => (n === null ? '$?' : `$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`)
export const tok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60000))
  return total >= 60 ? `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}m` : `${total}m`
}
