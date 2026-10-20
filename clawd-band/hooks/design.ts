// The bar's look: chips of a small uppercase label over a value, drawn as SVG so the type,
// spacing and colours are exact. Colours follow the light or dark scheme.

import { ADVANCE, FONT_FACES } from './claude-font'

export const BAR_HEIGHT = 40

const FONT = `'Claude Sans', 'Segoe UI', system-ui, sans-serif`

const STYLE =
  `<style>${FONT_FACES}` +
  `:root{--ink:#3D3D3A;--muted:#8F8E87;--track:rgba(31,30,29,.10);--accent:#D97757;--warn:#C9873A}` +
  `@media (prefers-color-scheme:dark){:root{--ink:#E8E6DC;--muted:#8F8E87;--track:rgba(250,249,245,.14)}}` +
  `text{font-family:${FONT};font-variant-numeric:tabular-nums}` +
  `.label{font-size:8.5px;font-weight:600;letter-spacing:.09em;fill:var(--muted)}` +
  `.value{font-size:13px;font-weight:600;fill:var(--ink)}` +
  `.soft{font-size:13px;font-weight:500;fill:var(--muted)}` +
  `.track{fill:var(--track)}.fill{fill:var(--ink)}.hot{fill:var(--accent)}.warm{fill:var(--warn)}` +
  `.dot{fill:var(--accent)}.idle{fill:var(--muted)}` +
  `</style>`

const LABEL_Y = 15
const VALUE_Y = 31
const CHIP_GAP = 22
const BAR_W = 34

// How wide `text` sets in Claude Sans, from the font's own advance widths.
function textWidth(text: string, size: number, tracking = 0, weight = 600): number {
  const table = ADVANCE[weight] ?? ADVANCE[600]
  let em = 0
  for (const ch of text) em += table[ch] ?? 0.55
  return em * size + tracking * size * [...text].length
}

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export type Svg = { source: string; width: number; height: number }

function svg(width: number, body: string): Svg {
  const w = Math.ceil(width)
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${BAR_HEIGHT}" width="${w}" height="${BAR_HEIGHT}">` +
      `${STYLE}${body}</svg>`,
    width: w,
    height: BAR_HEIGHT,
  }
}

type Chip = { label: string; value: string; bar?: number }

// Lays chips left to right; a chip with `bar` gets a hairline meter after its value.
function chips(list: Chip[], x0 = 0): { body: string; width: number } {
  let x = x0
  let body = ''
  for (const chip of list) {
    const labelW = textWidth(chip.label, 8.5, 0.09)
    const valueW = textWidth(chip.value, 13)
    body += `<text class="label" x="${x}" y="${LABEL_Y}">${esc(chip.label)}</text>`
    body += `<text class="value" x="${x}" y="${VALUE_Y}">${esc(chip.value)}</text>`
    let w = Math.max(labelW, valueW)
    if (chip.bar !== undefined) {
      const bx = x + valueW + 7
      const filled = Math.max(2, Math.round((BAR_W * Math.min(100, Math.max(0, chip.bar))) / 100))
      const tone = chip.bar >= 80 ? 'hot' : chip.bar >= 60 ? 'warm' : 'fill'
      body += `<rect class="track" x="${bx}" y="${VALUE_Y - 5}" width="${BAR_W}" height="3" rx="1.5"/>`
      body += `<rect class="${tone}" x="${bx}" y="${VALUE_Y - 5}" width="${filled}" height="3" rx="1.5"/>`
      w = Math.max(labelW, valueW + 7 + BAR_W)
    }
    x += w + CHIP_GAP
  }
  return { body, width: Math.max(0, x - x0 - CHIP_GAP) }
}

export type Stats = { cost?: string; limit?: number; context?: number; rtk?: string }

// The left cluster: session cost, plan limit, context fill, RTK savings.
export function statsSvg(stats: Stats): Svg | null {
  const list: Chip[] = []
  if (stats.cost) list.push({ label: 'SESSION', value: stats.cost })
  if (stats.limit !== undefined) list.push({ label: '5H LIMIT', value: `${stats.limit}%`, bar: stats.limit })
  if (stats.context !== undefined) list.push({ label: 'CONTEXT', value: `${Math.round(stats.context)}%`, bar: stats.context })
  if (stats.rtk) list.push({ label: 'RTK SAVED', value: stats.rtk })
  if (!list.length) return null
  // A hairline after the clock, then the chips.
  const { body, width } = chips(list, 15)
  return svg(15 + width + 1, `<rect class="track" x="0" y="8" width="1" height="24"/>${body}`)
}

// A digit that counts through 0..count-1 on its own, one step every `step` seconds, from `at`.
function countingText(x: number, count: number, step: number, at: number): string {
  const dur = count * step
  let out = ''
  for (let k = 0; k < count; k++) {
    const a = (k / count).toFixed(4)
    const b = ((k + 1) / count).toFixed(4)
    const anim =
      k === 0 ? `values="visible;hidden" keyTimes="0;${b}"` : `values="hidden;visible;hidden" keyTimes="0;${a};${b}"`
    out +=
      `<text class="value" x="${x}" y="${VALUE_Y}" visibility="${k === 0 ? 'visible' : 'hidden'}">` +
      `<animate attributeName="visibility" calcMode="discrete" ${anim} dur="${dur}s" begin="-${at.toFixed(2)}s" repeatCount="indefinite"/>` +
      `${k}</text>`
  }
  return out
}

// The right cluster: Claude's state as one word under a STATUS label with a dot that pulses
// while working, then how long the cache stays warm once idle.
export function statusSvg(state: string, working: boolean, cacheMinutes: number | null): Svg {
  const dot = working
    ? `<circle class="dot" cx="3" cy="${LABEL_Y - 3}" r="3">` +
      `<animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/></circle>`
    : `<circle class="idle" cx="3" cy="${LABEL_Y - 3}" r="3"/>`
  let body = dot
  body += `<text class="label" x="11" y="${LABEL_Y}">STATUS</text>`
  body += `<text class="value" x="0" y="${VALUE_Y}">${esc(state)}</text>`
  let w = Math.max(11 + textWidth('STATUS', 8.5, 0.09), textWidth(state, 13))

  if (!working && cacheMinutes !== null) {
    const cache = chips([{ label: 'CACHE', value: cacheMinutes <= 0 ? 'cold' : `${cacheMinutes}m warm` }], w + CHIP_GAP)
    body += cache.body
    w += CHIP_GAP + cache.width
  }
  return svg(w + 1, body)
}

// The turn's m:ss, counting up on its own from `elapsed` seconds. Built once per turn, so
// its markup stays the same while the turn runs and the app never reloads it.
export function turnTimerSvg(elapsed: number): Svg {
  const digit = 13 * 0.56
  let body = `<text class="label" x="0" y="${LABEL_Y}">TURN</text>`
  body += countingText(0, 10, 60, elapsed % 600)
  body += `<text class="value" x="${digit}" y="${VALUE_Y}">:</text>`
  body += countingText(digit + 4, 6, 10, elapsed % 60)
  body += countingText(digit * 2 + 4, 10, 1, elapsed % 10)
  return svg(Math.max(digit * 3 + 4, textWidth('TURN', 8.5, 0.09)) + 1, body)
}
