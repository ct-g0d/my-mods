import { DAY_PERIODS, periodAt, periodStart } from './design'
import type { Tint } from './pixel-clock'
import { deskClock } from './pixel-clock'

// The band's clock. By day it is the desk clock, its colours drifting with the hour so the clock itself
// says what time of day it is; at night it is a red LED bedside clock.

type Time = { H: number; m: number; s: number; hr: string; mm: string; h1: string | null; h2: string; m1: string; m2: string }
type Glow = [string, number, number, number, number]

const r2 = (n: number) => Math.round(n * 100) / 100
const BLINK = '<animate attributeName="opacity" values="1;.12" keyTimes="0;.5" calcMode="discrete" dur="2s" repeatCount="indefinite"/>'

// A lit element's glow: a tight and a wide halo in `c`, under the element itself.
const glowF = (id: string, c: string, sd1: number, a1: number, sd2: number, a2: number) =>
  `<filter id="${id}" x="5" y="5" width="78" height="30" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur in="SourceAlpha" stdDeviation="${sd1}" result="b1"/><feGaussianBlur in="SourceAlpha" stdDeviation="${sd2}" result="b2"/>` +
  `<feFlood flood-color="${c}"/><feComposite in2="b1" operator="in"/><feComponentTransfer result="g1"><feFuncA type="linear" slope="${a1}"/></feComponentTransfer>` +
  `<feFlood flood-color="${c}"/><feComposite in2="b2" operator="in"/><feComponentTransfer result="g2"><feFuncA type="linear" slope="${a2}"/></feComponentTransfer>` +
  `<feMerge><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

// ---- the day: the desk clock, tinted. One tint at the start of each period and one at the end of the last ----
const TINTS: Tint[] = [
  { rim: '#C7A59F', top: '#FBEAE5', bot: '#E9C9C2', screen: '#2C2226', lit: '#FF8F8A' }, // dawn: rose
  { rim: '#C4AE92', top: '#FBF0E2', bot: '#E8D6BC', screen: '#2B2520', lit: '#F9A45C' }, // morning: warm
  { rim: '#B9B6AD', top: '#F4F2EC', bot: '#CFCBC1', screen: '#2A2620', lit: '#F2A65A' }, // late morning: the desk clock as it began
  { rim: '#B4B8B8', top: '#F7F8F6', bot: '#D3D7D6', screen: '#25282A', lit: '#FFC857' }, // midday: bright, cool white
  { rim: '#B9AC86', top: '#F6EFD6', bot: '#DDD0A4', screen: '#2A2619', lit: '#F7A93B' }, // afternoon: straw
  { rim: '#AB946A', top: '#F5E7C8', bot: '#DEC595', screen: '#2B2419', lit: '#E8B25C' }, // golden hour: soft gold
  { rim: '#C46A82', top: '#FBD3C4', bot: '#EE9F8E', screen: '#2A1A2C', lit: '#FF7F8E' }, // dusk: rose coral
  { rim: '#2B2A66', top: '#7E7BC4', bot: '#4D4A94', screen: '#17172E', lit: '#B7BEFF' }, // evening: violet
  { rim: '#1A1B38', top: '#5A5A8C', bot: '#363663', screen: '#101024', lit: '#8FB4FF' }, // nightfall
]

const mix = (a: string, b: string, f: number) =>
  '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')

// The tint at `ms`: its period's, easing towards the next period's as the period goes.
export function tintAt(ms: number): Tint {
  const period = periodAt(ms)
  const i = period ? DAY_PERIODS.indexOf(period) : TINTS.length - 2
  const d = new Date(ms), minutes = d.getHours() * 60 + d.getMinutes()
  const f = Math.min(1, Math.max(0, (minutes - periodStart(i)) / (periodStart(i + 1) - periodStart(i))))
  const a = TINTS[i]!, b = TINTS[i + 1]!
  return { rim: mix(a.rim, b.rim, f), top: mix(a.top, b.top, f), bot: mix(a.bot, b.bot, f), screen: mix(a.screen, b.screen, f), lit: mix(a.lit, b.lit, f) }
}

// ---- the night: a red seven-segment bedside clock, 12-hour, in the desk clock's casing ----
function time(ms: number): Time {
  const d = new Date(ms), H = d.getHours(), m = d.getMinutes()
  const hr = String(H % 12 || 12), mm = String(m).padStart(2, '0')
  return { H, m, s: d.getSeconds(), hr, mm, h1: hr.length > 1 ? hr[0]! : null, h2: hr.at(-1)!, m1: mm[0]!, m2: mm[1]! }
}
// Four digit cells of width w, gaps sp and a colon gap cg, centred in the screen: each cell's x and the colon's.
const row = (w: number, sp: number, cg: number, extra = 0) => {
  const x0 = 44 - (4 * w + 2 * sp + cg + extra) / 2
  return { xs: [0, w + sp, 2 * w + sp + cg, 3 * w + 2 * sp + cg].map(x => x0 + x), cx: x0 + 2 * w + sp + cg / 2 }
}
const SEG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }
// Seven segments with real gaps and mitred ends, in a w by h cell with segments th thick.
function segs(w: number, h: number, t: number, g: number) {
  const k = t / 2, L = k, R = w - k, T = k, M = h / 2, B = h - k
  const H = (y: number) => [[L + g, y], [L + g + k, y - k], [R - g - k, y - k], [R - g, y], [R - g - k, y + k], [L + g + k, y + k]]
  const V = (x: number, a: number, b: number) => [[x, a + g], [x + k, a + g + k], [x + k, b - g - k], [x, b - g], [x - k, b - g - k], [x - k, a + g + k]]
  return { a: H(T), g: H(M), d: H(B), f: V(L, T, M), b: V(R, T, M), e: V(L, M, B), c: V(R, M, B) } as Record<string, number[][]>
}
function bedsideDigits(t: Time) {
  const w = 11.2, h = 20, th = 2.6, g = 0.3, sl = 8, sp = 3.6, cg = 7.5, cy = 20
  const c = '#FF4A30', gc = '#FF2A14', glow: Glow = ['#FF1E0A', 0.6, 1.1, 2, 0.75]
  const s = Math.tan((sl * Math.PI) / 180), S = segs(w, h, th, g), { xs, cx } = row(w, sp, cg, h * s), y0 = cy - h / 2
  const P = (x: number, y: number) => [r2(x + (h - y) * s), r2(y0 + y)]
  let lit = '', off = ''
  ;[t.h1, t.h2, t.m1, t.m2].forEach((n, i) => {
    for (const k in S) {
      const p = `<polygon points="${S[k]!.map(([x, y]) => P(x! + xs[i]!, y!).join(',')).join(' ')}"/>`
      if (n != null && SEG[n]!.includes(k)) lit += p
      else off += p
    }
  })
  const dots = [h * 0.3, h * 0.7].map(y => { const [X, Y] = P(cx, y); return `<circle cx="${X}" cy="${Y}" r="${th * 0.55}"/>` }).join('')
  return glowF('lg', ...glow) + `<g fill="${gc}" fill-opacity=".1">${off}${dots}</g>` +
    `<g fill="${c}" filter="url(#lg)">${lit}<g>${dots}${BLINK}</g></g>`
}
function bedsideClock(ms: number): { source: string; width: number; height: number } {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 40" width="88" height="40"><defs>' +
    '<linearGradient id="cb-case" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4843"/><stop offset="1" stop-color="#2B2A27"/></linearGradient>' +
    '<linearGradient id="cb-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<clipPath id="sc"><rect x="5" y="5" width="78" height="30" rx="3.5"/></clipPath></defs>' +
    '<rect x=".5" y=".5" width="87" height="39" rx="8" fill="url(#cb-case)" stroke="#0E0D0C"/>' +
    '<rect x="1.5" y="1.5" width="85" height="37" rx="7" fill="none" stroke="#fff" stroke-opacity=".35"/>' +
    '<rect x="5" y="5" width="78" height="30" rx="3.5" fill="#141210"/>' +
    `<g clip-path="url(#sc)">${bedsideDigits(time(ms))}</g>` +
    '<rect x="5" y="5" width="78" height="2" rx="1" fill="#000" fill-opacity=".35"/>' +
    '<rect x="5" y="5" width="78" height="30" rx="3.5" fill="url(#cb-glass)"/></svg>'
  return { source, width: 88, height: 40 }
}

export type ClockLook = 'desk' | 'bedside'

// How long one clock takes to fade across into the other, in seconds.
export const CLOCK_FADE_S = 3

// One clock changing into another: both drawn together, the new one fading in over the old, which stays whole
// beneath it, so it is a true crossfade with no dip. The change began `ago` seconds back, so a redraw carries on
// from where it was. Each keeps its own ids.
export function crossfadeClock(from: string, to: string, ago: number): string {
  const inner = (source: string, p: string) =>
    source.replace(/^<svg [^>]*>/, '').replace(/<\/svg>$/, '').replace(/ id="([^"]+)"/g, ` id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 40" width="88" height="40">' +
    `<g>${inner(from, 'a')}</g>` +
    `<g opacity="1">${inner(to, 'b')}<animate attributeName="opacity" values="0;1" dur="${CLOCK_FADE_S}s" begin="-${ago.toFixed(2)}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".42 0 .58 1"/></g>` +
    '</svg>'
  )
}

// The look at `ms`: the desk clock by day, the bedside clock at night.
export function lookAt(ms: number): ClockLook {
  return periodAt(ms) ? 'desk' : 'bedside'
}

// The time `shown`, drawn in the look and tint of the hour `now` falls in.
export function clockSvg(shown: number, now = shown): { source: string; width: number; height: number; look: ClockLook } {
  const look = lookAt(now)
  return { ...(look === 'desk' ? deskClock(shown, tintAt(now)) : bedsideClock(shown)), look }
}
