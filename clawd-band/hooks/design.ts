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
  `.value{font-size:13px;font-weight:600;fill:var(--ink)}.pct{font-size:9.5px;font-weight:600;fill:var(--ink)}` +
  `.soft{font-size:13px;font-weight:500;fill:var(--muted)}.tick{font-size:7px;font-weight:600;fill:var(--muted)}` +
  `.track{fill:var(--track)}.fill{fill:var(--ink)}.hot{fill:var(--accent)}.warm{fill:var(--warn)}` +
  `.dot{fill:var(--accent)}.idle{fill:var(--muted)}` +
  `</style>`

const LABEL_Y = 15
const VALUE_Y = 31
const CHIP_GAP = 22

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

type Chip = { label: string; value: string }

// The title's tracking also follows its last letter, so centring it as set would nudge it left.
const TRACK_FIX = (0.09 * 8.5) / 2

// Lays chips left to right, each a small light title centred over its big dark value. The renderer
// centres both on the font it actually draws with, so they line up whatever the glyphs measure.
function chips(list: Chip[], x0 = 0): { body: string; width: number } {
  let x = x0
  let body = ''
  for (const { label, value } of list) {
    const w = Math.max(textWidth(label, 8.5, 0.09), textWidth(value, 13))
    body += centredLabel(x + w / 2, label) + centredValue(x + w / 2, value)
    x += w + CHIP_GAP
  }
  return { body, width: Math.max(0, x - x0 - CHIP_GAP) }
}

const centredLabel = (mid: number, label: string) =>
  `<text class="label" x="${(mid + TRACK_FIX).toFixed(2)}" y="${LABEL_Y}" text-anchor="middle">${esc(label)}</text>`
const centredValue = (mid: number, value: string) =>
  `<text class="value" x="${mid.toFixed(2)}" y="${VALUE_Y}" text-anchor="middle">${esc(value)}</text>`

// From this many minutes left frost starts settling on the cache's digits; at none they are frozen.
export const ICE_MINUTES = 10
// How long /keepwarm's effect plays, in seconds: the fire glow, or the thaw from chilling.
export const WARM_S = 2.6

export type Warm = { kind: 'glow' | 'thaw'; ago: number }

const EASE = 'calcMode="spline" keySplines=".42 0 .58 1;.42 0 .58 1"'

const ICE_DEFS =
  // Fire: embers that fade out on every side, and flame tongues hot and pale at the root, orange
  // further up, clear at the tip, their edges licked about by moving noise.
  `<radialGradient id="cb-ember"><stop offset="0" stop-color="#FF9F45" stop-opacity=".9"/>` +
  `<stop offset=".55" stop-color="#F2682B" stop-opacity=".45"/><stop offset="1" stop-color="#E0452A" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="cb-bloom"><stop offset="0" stop-color="#FFB45C" stop-opacity=".35"/><stop offset="1" stop-color="#FFB45C" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="cb-flame" cx=".5" cy=".82" r=".75" fx=".5" fy=".9">` +
  `<stop offset="0" stop-color="#FFF6CC" stop-opacity=".98"/><stop offset=".3" stop-color="#FFC75E" stop-opacity=".92"/>` +
  `<stop offset=".68" stop-color="#F26B2C" stop-opacity=".7"/><stop offset="1" stop-color="#D9402A" stop-opacity="0"/></radialGradient>` +
  `<filter id="cb-flicker" x="-60%" y="-30%" width="220%" height="160%">` +
  `<feTurbulence type="fractalNoise" baseFrequency=".18 .32" numOctaves="2" seed="4">` +
  `<animate attributeName="baseFrequency" values=".18 .32;.22 .42;.16 .3;.18 .32" dur=".9s" repeatCount="indefinite"/></feTurbulence>` +
  `<feDisplacementMap in="SourceGraphic" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>` +
  `<feGaussianBlur stdDeviation=".35"/></filter>` +
  `<filter id="cb-soft" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="1.3"/></filter>` +
  `<filter id="cb-bloomblur" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>`

const valueText = (mid: number, value: string, attrs = 'class="value"') =>
  `<text ${attrs} x="${mid.toFixed(2)}" y="${VALUE_Y}" text-anchor="middle">${esc(value)}</text>`

// Frost that lives on the glyphs alone, as on a number left in a freezer: an icy blue body,
// paler at the top, fine ice crystals inside the strokes and a white rime tracing their outline.
// Every layer is cut to the glyphs' own shape, so nothing reaches past the letters.
const ICE_BLUE = '#4FA8FF'

const FROST_DEFS =
  `<linearGradient id="cb-icetext" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#EAFBFF"/><stop offset=".35" stop-color="#7FDBFF"/><stop offset=".72" stop-color="#4C9BFF"/><stop offset="1" stop-color="#7A74F5"/></linearGradient>` +
  // A soft cyan aura hugging the frozen digits.
  `<filter id="cb-aura" x="-20%" y="-40%" width="140%" height="180%">` +
  `<feGaussianBlur in="SourceAlpha" stdDeviation=".9" result="b"/><feFlood flood-color="#7FD8FF" flood-opacity=".8"/>` +
  `<feComposite in2="b" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  // Only the frost's own light: sparse crystals inside the strokes, and a highlight along their
  // top edges where light catches the ice. Drawn over the digits, cut to their shape.
  `<filter id="cb-rime" x="-10%" y="-20%" width="120%" height="140%">` +
  `<feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="11" result="n"/>` +
  `<feColorMatrix in="n" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.6 -1.55" result="specks"/>` +
  `<feComposite in="specks" in2="SourceAlpha" operator="in" result="crystals"/>` +
  `<feOffset in="SourceAlpha" dy=".8" result="below"/>` +
  `<feComposite in="SourceAlpha" in2="below" operator="out" result="tops"/>` +
  `<feFlood flood-color="#fff" flood-opacity=".85"/><feComposite in2="tops" operator="in" result="shine"/>` +
  `<feMerge><feMergeNode in="crystals"/><feMergeNode in="shine"/></feMerge></filter>`

const rime = (mid: number, value: string, attrs = '') => valueText(mid, value, `class="value" style="fill:#000" filter="url(#cb-rime)" ${attrs}`)

// A four-point sparkle at (x, y) that twinkles in turn, `delay` seconds into a 2.8s cycle.
const sparkle = (x: number, y: number, r: number, delay: number) =>
  `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><path d="M0 ${-r}Q${r * 0.16} ${-r * 0.16} ${r} 0Q${r * 0.16} ${r * 0.16} 0 ${r}Q${-r * 0.16} ${r * 0.16} ${-r} 0Q${-r * 0.16} ${-r * 0.16} 0 ${-r}Z" fill="#fff" transform="scale(0)">` +
  `<animateTransform attributeName="transform" type="scale" values="0;0;1;0;0" keyTimes="0;.1;.2;.32;1" dur="2.8s" begin="${delay}s" repeatCount="indefinite"/></path></g>`

// Frozen through, as in a fairy tale: luminous digits, ice-white at the top through cyan to a
// periwinkle base, a soft cyan aura, light catching their top edges, and sparkles twinkling on them.
function frostText(mid: number, value: string): string {
  const tw = textWidth(value, 13)
  const left = mid - tw / 2
  return (
    valueText(mid, value, 'class="value" style="fill:url(#cb-icetext)" filter="url(#cb-aura)"') +
    rime(mid, value) +
    sparkle(left + tw * 0.22, VALUE_Y - 8.5, 2.6, 0) +
    sparkle(left + tw * 0.78, VALUE_Y - 4, 2.2, -0.95) +
    sparkle(left + tw * 0.5, VALUE_Y - 1.5, 1.8, -1.9)
  )
}

// How thick the frost is, 0 to 1, with `minutes` left of ICE_MINUTES: a light dusting at first,
// nearly frozen through by the last minute.
const frostAt = (minutes: number) => 0.55 + (0.4 * (ICE_MINUTES - Math.max(1, minutes))) / (ICE_MINUTES - 1)

// Getting cold: azure seeping into the ink digits and frost settling on them, breathing clearly
// between much lighter and `amount`. `melt` fades it all off instead, from `amount` to none, from then.
function frosting(mid: number, value: string, amount: number, melt?: string): string {
  const lo = Math.max(0.06, amount - 0.48).toFixed(2)
  const hi = amount.toFixed(2)
  const anim = melt
    ? `<animate attributeName="opacity" values="${hi};0" dur="1.6s" begin="${melt}" fill="freeze" calcMode="spline" keySplines=".42 0 .58 1"/>`
    : `<animate attributeName="opacity" values="${lo};${hi};${lo}" dur="3.6s" repeatCount="indefinite" ${EASE}/>`
  const start = melt ? hi : lo
  return (
    valueText(mid, value) +
    valueText(mid, value, `class="value" style="fill:${ICE_BLUE}" opacity="${start}"`).replace('</text>', `${anim}</text>`) +
    rime(mid, value, `opacity="${start}"`).replace('</text>', `${anim}</text>`)
  )
}

// One flame tongue standing on (0, 0), `h` tall with a round root of radius `r`: pointed at the tip,
// never flat at the bottom.
const tongue = (h: number, r: number) =>
  `M0 ${-h}C${0.55 * r} ${-0.6 * h},${r} ${-0.25 * h},${r} 0A${r} ${r} 0 0 1 ${-r} 0C${-r} ${-0.25 * h},${-0.55 * r} ${-0.6 * h},0 ${-h}Z`

// /keepwarm while warm: embers kindle under the number and warm light blooms up around it, while
// flame tongues rise from the embers one after another, each flickering, stretching thin and letting
// go as it climbs. `ago` is how far in it already is, in seconds.
function fire(mid: number, tw: number, ago: number): string {
  const at = (delay: number) => `${(delay - ago).toFixed(2)}s`
  const life = (values: string, times: string) =>
    `<animate attributeName="opacity" values="${values}" keyTimes="${times}" dur="${WARM_S}s" begin="${at(0)}" fill="freeze"/>`
  const base = VALUE_Y + 2
  let out =
    `<ellipse cx="${mid.toFixed(2)}" cy="${VALUE_Y - 5}" rx="${(tw * 0.9 + 4).toFixed(2)}" ry="13" fill="url(#cb-bloom)" filter="url(#cb-bloomblur)" opacity="0">` +
    life('0;1;1;0', '0;.2;.6;1') +
    `</ellipse>` +
    `<ellipse cx="${mid.toFixed(2)}" cy="${base + 1}" rx="${(tw * 0.55 + 2).toFixed(2)}" ry="3.6" fill="url(#cb-ember)" filter="url(#cb-soft)" opacity="0">` +
    life('0;1;.85;1;0', '0;.12;.4;.65;1') +
    `</ellipse>`
  const flames: [number, number, number, number][] = [
    [-0.3, 9, 2.4, 0.05],
    [0.04, 13, 3.1, 0.18],
    [0.32, 8, 2.2, 0.32],
    [-0.08, 10, 2.6, 0.6],
  ]
  out += `<g filter="url(#cb-flicker)">`
  for (const [dx, h, r, delay] of flames) {
    const x = (mid + tw * dx).toFixed(2)
    const rise = (0.75 + h * 0.02).toFixed(2)
    const repeat = `repeatDur="${(WARM_S - 0.7 - delay).toFixed(2)}s"`
    out +=
      `<g transform="translate(${x} ${base})"><path d="${tongue(h, r)}" fill="url(#cb-flame)" opacity="0">` +
      `<animate attributeName="opacity" values="0;.95;.85;0" keyTimes="0;.18;.6;1" dur="${rise}s" begin="${at(delay)}" ${repeat}/>` +
      `<animateTransform attributeName="transform" type="scale" values=".9 .5;1 1;.55 1.35" dur="${rise}s" begin="${at(delay)}" ${repeat}/>` +
      `<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -1.5;0 -6" dur="${rise}s" begin="${at(delay)}" ${repeat}/>` +
      `</path></g>`
  }
  return out + `</g>`
}

// The number shimmering in the heat while the fire burns, then still again.
function hazeValue(mid: number, value: string, ago: number): string {
  return (
    `<filter id="cb-haze" x="-20%" y="-40%" width="140%" height="180%">` +
    `<feTurbulence type="fractalNoise" baseFrequency=".05 .25" numOctaves="1" seed="9">` +
    `<animate attributeName="baseFrequency" values=".05 .25;.07 .32;.05 .25" dur=".7s" repeatCount="indefinite"/></feTurbulence>` +
    `<feDisplacementMap in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G">` +
    `<animate attributeName="scale" values="0;1.8;1.8;0" keyTimes="0;.2;.6;1" dur="${WARM_S}s" begin="${(-ago).toFixed(2)}s" fill="freeze"/>` +
    `</feDisplacementMap></filter>` +
    valueText(mid, value, 'class="value" filter="url(#cb-haze)"')
  )
}

// /keepwarm while getting cold: flames under the number while the frost fades off its digits.
function thaw(mid: number, value: string, ago: number): string {
  return fire(mid, textWidth(value, 13), ago) + frosting(mid, value, 0.75, `${(-ago).toFixed(2)}s`)
}

// The cache's minutes left. It chills from ICE_MINUTES, is frozen in ice at none, plays /keepwarm's
// glow or thaw while `warm` lasts, and greys out while a turn is refreshing it anyway.
function cacheChip(x0: number, minutes: number, working: boolean, warm?: Warm): { body: string; width: number } {
  const value = `${Math.max(0, minutes)}m`
  const tw = textWidth(value, 13)
  const w = Math.max(textWidth('CACHE', 8.5, 0.09), tw)
  const mid = x0 + w / 2
  let body = centredLabel(mid, 'CACHE')
  if (warm) {
    body = warm.kind === 'thaw' ? thaw(mid, value, warm.ago) + body : fire(mid, tw, warm.ago) + body + hazeValue(mid, value, warm.ago)
    return { body, width: w }
  }
  body += minutes <= 0 ? frostText(mid, value) : minutes <= ICE_MINUTES ? frosting(mid, value, frostAt(minutes)) : valueText(mid, value)
  return { body: working ? `<g opacity=".4">${body}</g>` : body, width: w }
}

const LIGHT_R = 3
const LIGHT_LEAD = 2 * LIGHT_R + 5
const TICK_Y = 40
const TICK_DIGIT = 7 * 0.6

// Claude's state, last since its width changes: the title, the light and the word, and the turn's
// time counting up in small grey type just under the word. Set from the left, so the title holds
// still as the word changes.
function statusChip(x0: number, state: string, working: boolean, elapsed?: number): { body: string; width: number } {
  let body = `<text class="label" x="${x0}" y="${LABEL_Y}">STATUS</text>`
  body += working
    ? `<circle class="dot" cx="${x0 + LIGHT_R}" cy="${VALUE_Y - 4.5}" r="${LIGHT_R}">` +
      `<animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/></circle>`
    : `<circle class="idle" cx="${x0 + LIGHT_R}" cy="${VALUE_Y - 4.5}" r="${LIGHT_R}"/>`
  body += `<text class="value" x="${x0 + LIGHT_LEAD}" y="${VALUE_Y}">${esc(state)}</text>`
  if (elapsed !== undefined) body += timerText(x0 + LIGHT_LEAD, elapsed)
  const w = Math.max(textWidth('STATUS', 8.5, 0.09), LIGHT_LEAD + textWidth(state, 13), LIGHT_LEAD + TICK_DIGIT * 3 + 3)
  return { body, width: w }
}

const METER_W = 60

// One bevelled bar, toned by how full it is.
function bar(x: number, y: number, w: number, h: number, percent: number): string {
  const p = Math.min(100, Math.max(0, percent))
  const filled = Math.max(h, Math.round((w * p) / 100))
  const tone = p >= 80 ? 'hot' : p >= 60 ? 'warm' : 'fill'
  return (
    `<rect class="track" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#cb-inset)"/>` +
    `<rect class="${tone}" x="${x}" y="${y}" width="${filled}" height="${h}" rx="${h / 2}"/>` +
    `<rect x="${x}" y="${y}" width="${filled}" height="${h}" rx="${h / 2}" fill="url(#cb-sheen)"/>`
  )
}

const ROW_H = 6
const ROW_Y = [9, 25]

// One slice of the context bar: its colour and its share of the window, 0 to 1.
export type Part = { color: string; share: number }

// A flat bar split into the window's categories, as /context draws it, each slice 1px apart.
function segmented(x: number, y: number, w: number, h: number, parts: Part[]): string {
  let out = `<clipPath id="cb-ctx"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/></clipPath>`
  out += `<g clip-path="url(#cb-ctx)"><rect class="track" x="${x}" y="${y}" width="${w}" height="${h}"/>`
  let at = x
  for (const { color, share } of parts) {
    const sw = share * w
    if (sw >= 0.5) out += `<rect x="${at.toFixed(2)}" y="${y}" width="${Math.max(0.5, sw - 1).toFixed(2)}" height="${h}" fill="${color}"/>`
    at += sw
  }
  return out + `</g>`
}

// A row's value is centred in `slot` when given; a row with `bare` leaves out its percent; one
// with `parts` draws its bar split by category.
type Row = { tag: string; percent?: number; value?: string; barW?: number; slot?: number; bare?: boolean; parts?: Part[] }

const tagWidth = (tag: string) => Math.max(18, textWidth(tag, 8.5, 0.09) + 6)

// The widest a cost can set, $xxx.xx, from the widest digit in the font.
const WIDEST_DIGIT = Math.max(...'0123456789'.split('').map(d => textWidth(d, 9.5)))
const COST_W = textWidth('$.', 9.5) + 5 * WIDEST_DIGIT

// Up to two rows stacked top and bottom, each a tag then, right after it, a bar and percent or a value.
function stacked(list: Row[], x0: number): { body: string; width: number } {
  let body = ''
  let width = 0
  list.forEach(({ tag, percent, value, barW = METER_W, slot, bare, parts }, i) => {
    const y = ROW_Y[i]
    const text = y + ROW_H / 2 + 3.2
    const tagW = tagWidth(tag)
    body += `<text class="label" x="${x0}" y="${text}">${tag}</text>`
    if (percent !== undefined) {
      body += parts ? segmented(x0 + tagW, y, barW, ROW_H, parts) : bar(x0 + tagW, y, barW, ROW_H, percent)
      if (!bare) body += `<text class="pct" x="${x0 + tagW + barW + 6}" y="${text}">${Math.round(percent)}%</text>`
      width = Math.max(width, tagW + barW + (bare ? 0 : 6 + 24))
    } else {
      const w = slot ?? textWidth(value ?? '', 9.5)
      body += `<text class="pct" x="${x0 + tagW + w / 2}" y="${text}" text-anchor="middle">${esc(value ?? '')}</text>`
      width = Math.max(width, tagW + w)
    }
  })
  return { body, width }
}

const METER_DEFS =
  `<defs>` +
  `<linearGradient id="cb-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>` +
  `<linearGradient id="cb-inset" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".4" stop-color="#000" stop-opacity="0"/></linearGradient>` +
  `</defs>`

export type Stats = {
  cost?: string
  limit?: number
  week?: number
  context?: number
  parts?: Part[]
  hit?: number
  tps?: number
  state: string
  working: boolean
  // Seconds into the turn when the drawing is built; absent when idle.
  elapsed?: number
  cacheMinutes: number | null
  // /keepwarm's glow or thaw, while it plays.
  warm?: Warm
}

// The left cluster: the 5-hour bar over the 7-day one, session cost over the context bar, then
// cache hit and tokens a second, the cache's minutes left, and Claude's status last.
export function statsSvg(stats: Stats): Svg {
  const limits: Row[] = []
  if (stats.limit !== undefined) limits.push({ tag: '5H', percent: stats.limit })
  if (stats.week !== undefined) limits.push({ tag: '7D', percent: stats.week })
  // The context bar runs from its tag to the right edge of the cost's slot above it.
  const session: Row[] = []
  if (stats.cost) session.push({ tag: 'SESSION', value: stats.cost, slot: COST_W })
  if (stats.context !== undefined) {
    const barW = stats.cost ? tagWidth('SESSION') + COST_W - tagWidth('CTX') : 36
    session.push({ tag: 'CTX', percent: stats.context, barW, bare: true, parts: stats.parts })
  }
  // Shown from the start, a dash until the first response measures them.
  const speed: Chip[] = [
    { label: 'HIT', value: stats.hit !== undefined ? `${stats.hit}%` : '—' },
    { label: 'TOK/S', value: stats.tps !== undefined ? String(stats.tps) : '—' },
  ]
  // A hairline after the clock, then the pieces left to right.
  let x = 15
  let body = `<rect class="track" x="0" y="8" width="1" height="24"/>`
  for (const draw of [
    limits.length ? (at: number) => stacked(limits, at) : null,
    session.length ? (at: number) => stacked(session, at) : null,
    (at: number) => chips(speed, at),
    stats.cacheMinutes !== null ? (at: number) => cacheChip(at, stats.cacheMinutes!, stats.working, stats.warm) : null,
    (at: number) => statusChip(at, stats.state, stats.working, stats.elapsed),
  ]) {
    if (!draw) continue
    const part = draw(x)
    body += part.body
    x += part.width + CHIP_GAP
  }
  return svg(x - CHIP_GAP + 1, METER_DEFS.replace('</defs>', `${ICE_DEFS}${FROST_DEFS}</defs>`) + body)
}

// Night runs from 23:15 to 05:30: the band goes dark whatever the system's theme, and Clawd sleeps.
export function isNight(ms: number): boolean {
  const d = new Date(ms)
  const m = d.getHours() * 60 + d.getMinutes()
  return m >= 23 * 60 + 15 || m < 5 * 60 + 30
}

export const NIGHT_BG = '#262624'

// A drawing's dark colours, applied whatever the system's scheme.
export const forceDark = (source: string) => source.replace('@media (prefers-color-scheme:dark)', '@media all')

// How long dimming for sleep, or brightening on waking, takes, in seconds.
export const FADE_S = 0.8

// A drawing at `to` opacity, easing there from `from` when it changed `ago` seconds back.
export function fade(source: string, from: number, to: number, ago: number): string {
  if (ago >= FADE_S) return to === 1 ? source : source.replace('<svg ', `<svg opacity="${to}" `)
  return source.replace(/<svg [^>]*>/, tag =>
    `${tag.replace('<svg ', `<svg opacity="${to}" `)}` +
    `<animate attributeName="opacity" values="${from};${to}" dur="${FADE_S}s" begin="${(-ago).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines=".42 0 .58 1"/>`)
}

// A glowing crescent moon with two stars by it, then three z's drifting up from a
// sleeping Clawd and fading, one after another.
export const SLEEP_W = 64
export function sleepSvg(): Svg {
  const z = (x: number, size: number, delay: number) =>
    `<text x="${x}" y="32" font-size="${size}" opacity="0">z` +
    `<animate attributeName="opacity" values="0;.95;0" dur="3s" begin="${delay}s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;6 -18" dur="3s" begin="${delay}s" repeatCount="indefinite"/></text>`
  const star = (x: number, y: number, delay: number) =>
    `<circle cx="${x}" cy="${y}" r="1.2" fill="#F5E7B8" opacity="${delay ? 0.5 : 0.9}"/>`
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SLEEP_W} ${BAR_HEIGHT}" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
      `<defs><filter id="cb-moon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      `<mask id="cb-crescent"><rect width="30" height="40" fill="#fff"/><circle cx="16" cy="15" r="8" fill="#000"/></mask></defs>` +
      `<circle cx="12" cy="20" r="9" fill="#F5E7B8" mask="url(#cb-crescent)" filter="url(#cb-moon)"/>` +
      star(24, 8, 0) + star(4, 34, -1.2) +
      `<style>text{font-family:${FONT};font-weight:700;fill:#B9C8F5}</style>${z(30, 11, 0)}${z(38, 14, 1)}${z(46, 17, 2)}</svg>`,
    width: SLEEP_W,
    height: BAR_HEIGHT,
  }
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
      `<text class="tick" x="${x.toFixed(2)}" y="${TICK_Y}" visibility="${k === 0 ? 'visible' : 'hidden'}">` +
      `<animate attributeName="visibility" calcMode="discrete" ${anim} dur="${dur}s" begin="-${at.toFixed(2)}s" repeatCount="indefinite"/>` +
      `${k}</text>`
  }
  return out
}

// The turn's m:ss in small grey type at `x`, counting up on its own from `elapsed` seconds.
function timerText(x: number, elapsed: number): string {
  return (
    countingText(x, 10, 60, elapsed % 600) +
    `<text class="tick" x="${(x + TICK_DIGIT).toFixed(2)}" y="${TICK_Y}">:</text>` +
    countingText(x + TICK_DIGIT + 2.5, 6, 10, elapsed % 60) +
    countingText(x + TICK_DIGIT * 2 + 2.5, 10, 1, elapsed % 10)
  )
}
