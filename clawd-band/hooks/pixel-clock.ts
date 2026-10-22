// A 3x5 pixel font, drawn in the same blocky style as Clawd.
const FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ':': ['.', '#', '.', '#', '.'],
  '.': ['.', '.', '.', '.', '#'],
}

// Glyphs drawn in a normal font instead of pixels.
const TYPED = new Set(['$'])

// How many font pixels wide a glyph is.
function glyphWidth(ch: string): number {
  return TYPED.has(ch) ? 3 : FONT[ch] ? FONT[ch][0].length : 0
}

// Size of one font pixel, in screen pixels: the hours and minutes, then the smaller seconds.
const PIXEL = 4
const SECONDS_PIXEL = 3
const INK = '#8A8983'

export function clockText(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// One glyph as rects at (x0, y0), `px` screen pixels per font pixel.
function glyph(ch: string, x0: number, y0: number, px: number): string {
  let out = ''
  if (TYPED.has(ch)) {
    return (
      `<text x="${x0 + 1.5 * px}" y="${y0 + 2.5 * px}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Segoe UI, system-ui, sans-serif" font-size="${5.5 * px}" font-weight="600">${ch}</text>`
    )
  }
  FONT[ch].forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === '#') out += `<rect x="${x0 + x * px}" y="${y0 + y * px}" width="${px}" height="${px}"/>`
    }),
  )
  return out
}

// A digit that counts through 0..count-1 on its own, one step every `step` seconds, starting at `at`.
function countingDigit(x0: number, y0: number, count: number, step: number, at: number, px = SECONDS_PIXEL): string {
  const dur = count * step
  let out = ''
  for (let k = 0; k < count; k++) {
    const a = (k / count).toFixed(4)
    const b = ((k + 1) / count).toFixed(4)
    const anim =
      k === 0
        ? `values="visible;hidden" keyTimes="0;${b}"`
        : `values="hidden;visible;hidden" keyTimes="0;${a};${b}"`
    out +=
      `<g visibility="${k === 0 ? 'visible' : 'hidden'}">` +
      `<animate attributeName="visibility" calcMode="discrete" ${anim} dur="${dur}s" begin="-${at.toFixed(2)}s" repeatCount="indefinite"/>` +
      glyph(String(k), x0, y0, px) +
      `</g>`
  }
  return out
}

// The desk clock's casing, screen and lit-segment colours, light and dark.
const CASE_STYLE =
  `<style>:root{--rim:#B9B6AD;--top:#F4F2EC;--bot:#CFCBC1;--screen:#2A2620;--lit:#F2A65A}` +
  `@media (prefers-color-scheme:dark){:root{--rim:#0E0D0C;--top:#4A4843;--bot:#2B2A27;--screen:#141210}}</style>`

const CASE_DEFS =
  `<defs>` +
  `<linearGradient id="cb-case" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--top)"/><stop offset="1" style="stop-color:var(--bot)"/></linearGradient>` +
  `<linearGradient id="cb-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
  `<filter id="cb-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `</defs>`

// HH:MM in the pixel font, lit amber on a recessed LCD
// inside a bevelled desk-clock casing, with the unlit segments faintly behind them.
export function clockSvg(ms: number): { source: string; width: number; height: number } {
  const text = clockText(ms)
  const dx = 10
  const dy = 10
  let x = 0
  let lit = ''
  let ghost = ''
  for (const ch of text) {
    lit += glyph(ch, dx + x, dy, PIXEL)
    if (ch !== ':') ghost += glyph('8', dx + x, dy, PIXEL)
    x += (FONT[ch][0].length + 1) * PIXEL
  }
  const width = dx + x - PIXEL + dx
  const height = 40
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
      CASE_STYLE + CASE_DEFS +
      // Casing: a bevelled body with a dark rim and a bright top edge.
      `<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="8" fill="url(#cb-case)" style="stroke:var(--rim)"/>` +
      `<rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="7" fill="none" stroke="#fff" stroke-opacity=".35"/>` +
      // Screen: recessed, with a shadowed top lip.
      `<rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="3.5" style="fill:var(--screen)"/>` +
      `<rect x="5" y="5" width="${width - 10}" height="2" rx="1" fill="#000" fill-opacity=".35"/>` +
      `<g shape-rendering="crispEdges" style="fill:var(--lit)" fill-opacity=".09">${ghost}</g>` +
      `<g shape-rendering="crispEdges" style="fill:var(--lit)" filter="url(#cb-glow)">${lit}</g>` +
      // Glass glare over the top half of the screen.
      `<rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="3.5" fill="url(#cb-glass)"/>` +
      `</svg>`,
    width,
    height,
  }
}

// Any text in the pixel font, `px` screen pixels per font pixel.
export function pixelText(text: string, px = PIXEL): { source: string; width: number; height: number } {
  let x = 0
  let rects = ''
  for (const ch of text) {
    if (!glyphWidth(ch)) continue
    rects += glyph(ch, x, 0, px)
    x += (glyphWidth(ch) + 1) * px
  }
  const width = Math.max(px, x)
  const height = 5 * px
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
      `shape-rendering="crispEdges"><g fill="${INK}">${rects}</g></svg>`,
    width,
    height,
  }
}

export function costText(usd: number): string {
  return `$${usd.toFixed(2)}`
}

// A m:ss stopwatch that counts up on its own from `elapsed` seconds, in the small font.
export function timerSvg(elapsed: number): { source: string; width: number; height: number } {
  const px = SECONDS_PIXEL
  const step = 4 * px
  let x = 0
  const minutes = countingDigit(x, 0, 10, 60, elapsed % 600, px)
  x += step
  const colon = glyph(':', x, 0, px)
  x += 2 * px
  const tens = countingDigit(x, 0, 6, 10, elapsed % 60, px)
  x += step
  const ones = countingDigit(x, 0, 10, 1, elapsed % 10, px)
  const width = x + step
  const height = 5 * px
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
      `shape-rendering="crispEdges"><g fill="${INK}">${minutes}${colon}${tens}${ones}</g></svg>`,
    width,
    height,
  }
}

// A ten-block pixel bar, `percent` full.
export function meterSvg(percent: number): { source: string; width: number; height: number } {
  const filled = Math.round(Math.min(100, Math.max(0, percent)) / 10)
  const fill = percent >= 80 ? '#D97757' : INK
  let blocks = ''
  for (let i = 0; i < 10; i++) {
    blocks += `<rect x="${i * 4}" y="0" width="3" height="6" fill="${i < filled ? fill : INK}" fill-opacity="${i < filled ? 1 : 0.25}"/>`
  }
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 6" width="39" height="6" shape-rendering="crispEdges">${blocks}</svg>`,
    width: 39,
    height: 6,
  }
}

// The night clock: a hotel-room alarm clock, red seven-segment digits glowing on black in a dark casing,
// the unlit segments faintly showing and the colon blinking each second. Its hour tens stay dark below ten.
const LED = '#ff2a1a'
const SEGMENTS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }
const T = 10
const hSeg = (x1: number, x2: number, y: number) =>
  `${x1 + T / 2},${y} ${x1 + T},${y - T / 2} ${x2 - T},${y - T / 2} ${x2 - T / 2},${y} ${x2 - T},${y + T / 2} ${x1 + T},${y + T / 2}`
const vSeg = (x: number, y1: number, y2: number) =>
  `${x},${y1 + T / 2} ${x + T / 2},${y1 + T} ${x + T / 2},${y2 - T} ${x},${y2 - T / 2} ${x - T / 2},${y2 - T} ${x - T / 2},${y1 + T}`
const SHAPE: Record<string, string> = { a: hSeg(5, 55, 5), g: hSeg(5, 55, 55), d: hSeg(5, 55, 105), f: vSeg(5, 5, 55), b: vSeg(55, 5, 55), e: vSeg(5, 55, 105), c: vSeg(55, 55, 105) }
const lit = (on: boolean) => (on ? `fill="${LED}" filter="url(#cb-led)"` : `fill="${LED}" opacity=".07"`)
const segDigit = (n: string | null, x: number) =>
  `<g transform="translate(${x} 0) skewX(-6)">` +
  Object.entries(SHAPE).map(([k, pts]) => `<polygon points="${pts}" ${lit(n !== null && SEGMENTS[n]!.includes(k))}/>`).join('') +
  `</g>`

export function bedsideClock(ms: number): { source: string; width: number; height: number } {
  const d = new Date(ms)
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes()
  // The digits are drawn 288 by 122, as on the bedside clock, and set into the band's 88 by 40.
  const digits =
    segDigit(h >= 10 ? '1' : null, 0) + segDigit(String(h % 10), 66) +
    [35, 75].map(y => `<circle cx="141" cy="${y}" r="6" fill="${LED}" filter="url(#cb-led)"><animate attributeName="opacity" values="1;.07" keyTimes="0;.5" calcMode="discrete" dur="2s" repeatCount="indefinite"/></circle>`).join('') +
    segDigit(String(Math.floor(m / 10)), 160) + segDigit(String(m % 10), 226)
  // The same casing as the desk clock, in its dark colours.
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 40" width="88" height="40">` +
    `<style>:root{--rim:#0E0D0C;--top:#4A4843;--bot:#2B2A27;--screen:#141210}</style>` + CASE_DEFS +
    `<defs><filter id="cb-led" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<rect x=".5" y=".5" width="87" height="39" rx="8" fill="url(#cb-case)" style="stroke:var(--rim)"/>` +
    `<rect x="1.5" y="1.5" width="85" height="37" rx="7" fill="none" stroke="#fff" stroke-opacity=".35"/>` +
    `<rect x="5" y="5" width="78" height="30" rx="3.5" style="fill:var(--screen)"/>` +
    `<rect x="5" y="5" width="78" height="2" rx="1" fill="#000" fill-opacity=".35"/>` +
    `<g transform="translate(10.1 7) scale(.235)">${digits}</g>` +
    `<rect x="5" y="5" width="78" height="30" rx="3.5" fill="url(#cb-glass)"/>` +
    `</svg>`
  return { source, width: 88, height: 40 }
}
