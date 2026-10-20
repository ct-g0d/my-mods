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
const GAP = 3
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

// HH:MM in the big font, then the seconds in a smaller one that tick inside the drawing itself.
export function clockSvg(ms: number): { source: string; width: number; height: number } {
  const text = clockText(ms)
  let x = 0
  let rects = ''
  for (const ch of text) {
    rects += glyph(ch, x, 0, PIXEL)
    x += (FONT[ch][0].length + 1) * PIXEL
  }
  x += GAP - PIXEL
  const height = 5 * PIXEL
  const y = height - 5 * SECONDS_PIXEL
  const seconds = (ms / 1000) % 60
  const tens = countingDigit(x, y, 6, 10, seconds)
  const ones = countingDigit(x + 4 * SECONDS_PIXEL, y, 10, 1, seconds % 10)
  // A spare font pixel on the right, so the last column is never clipped.
  const width = x + 8 * SECONDS_PIXEL
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
      `shape-rendering="crispEdges"><g fill="${INK}">${rects}${tens}${ones}</g></svg>`,
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
  return `$${usd < 10 ? usd.toFixed(2) : usd < 100 ? usd.toFixed(1) : Math.round(usd)}`
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
