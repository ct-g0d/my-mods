// The bar's look: chips of a small uppercase label over a value, drawn as SVG so the type,
// spacing and colours are exact. Colours follow the light or dark scheme.

import { ADVANCE, FONT_FACES } from './claude-font'

export const BAR_HEIGHT = 40

const FONT = `'Claude Sans', 'Segoe UI', system-ui, sans-serif`

const STYLE =
  `<style>${FONT_FACES}` +
  `:root{--ink:#3D3D3A;--muted:#8F8E87;--track:rgba(31,30,29,.10);--accent:#D97757}` +
  `@media (prefers-color-scheme:dark){:root{--ink:#E8E6DC;--muted:#8F8E87;--track:rgba(250,249,245,.14)}}` +
  `text{font-family:${FONT};font-variant-numeric:tabular-nums}` +
  `.label{font-size:8.5px;font-weight:600;letter-spacing:.09em;fill:var(--muted)}` +
  `.value{font-size:13px;font-weight:600;fill:var(--ink)}.pct{font-size:9.5px;font-weight:600;fill:var(--ink)}` +
  `.soft{font-size:13px;font-weight:500;fill:var(--muted)}.tick{font-size:7px;font-weight:600;fill:var(--muted)}` +
  `.track{fill:var(--track)}` +
  `.lvl-ok{fill:#43A85C}.lvl-mid{fill:var(--ink)}.lvl-high{fill:#E2A526}.lvl-max{fill:#DC4A3D}` +
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

function svg(width: number, body: string, height = BAR_HEIGHT): Svg {
  const w = Math.ceil(width)
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" width="${w}" height="${height}">` +
      `${STYLE}${body}</svg>`,
    width: w,
    height,
  }
}

// `widest` is the widest value the chip can hold, so it keeps one width as its value changes.
type Chip = { label: string; value: string; widest?: string }

// The title's tracking also follows its last letter, so centring it as set would nudge it left.
const TRACK_FIX = (0.09 * 8.5) / 2

// Lays chips left to right, each a small light title centred over its big dark value. The renderer
// centres both on the font it actually draws with, so they line up whatever the glyphs measure.
function chips(list: Chip[], x0 = 0): { body: string; width: number } {
  let x = x0
  let body = ''
  for (const { label, value, widest = '' } of list) {
    const w = Math.max(textWidth(label, 8.5, 0.09), textWidth(value, 13), textWidth(widest, 13))
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
const CACHE_WIDEST = '60m'

// Labelled AUTO while /keepwarm's window keeps it warm on its own.
function cacheChip(x0: number, minutes: number, working: boolean, warm?: Warm, auto?: boolean): { body: string; width: number } {
  const value = `${Math.max(0, minutes)}m`
  const tw = textWidth(value, 13)
  const w = Math.max(textWidth('CACHE', 8.5, 0.09), tw, textWidth(CACHE_WIDEST, 13))
  const mid = x0 + w / 2
  let body = centredLabel(mid, auto ? 'AUTO' : 'CACHE')
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

// How full a limit is, as the class that colours its bar and percent: green under 40%, ink to 70%,
// yellow to 90%, red to 95%, and red pulsing past that.
const level = (p: number) => (p < 40 ? 'lvl-ok' : p < 70 ? 'lvl-mid' : p < 90 ? 'lvl-high' : 'lvl-max')
const pulse = (p: number) => (p >= 95 ? `<animate attributeName="opacity" values="1;.35;1" dur="1s" repeatCount="indefinite"/>` : '')

// One bevelled bar with a soft glow, toned by how full it is.
function bar(x: number, y: number, w: number, h: number, percent: number): string {
  const p = Math.min(100, Math.max(0, percent))
  const filled = Math.max(h, Math.round((w * p) / 100))
  return (
    `<rect class="track" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#cb-inset)"/>` +
    `<g>${pulse(p)}<rect class="${level(p)}" x="${x}" y="${y}" width="${filled}" height="${h}" rx="${h / 2}" filter="url(#cb-barglow)"/>` +
    `<rect x="${x}" y="${y}" width="${filled}" height="${h}" rx="${h / 2}" fill="url(#cb-sheen)"/></g>`
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
      // NaN is a percent not measured yet: an empty bar and a dash.
      const known = !Number.isNaN(percent)
      body += parts ? segmented(x0 + tagW, y, barW, ROW_H, parts) : bar(x0 + tagW, y, barW, ROW_H, known ? percent : 0)
      // A limit's percent takes its bar's colour and pulse.
      const tone = known && !parts ? ` ${level(percent)}` : ''
      if (!bare) body += `<text class="pct${tone}" x="${x0 + tagW + barW + 6}" y="${text}">${known ? `${Math.round(percent)}%` : '—'}${known && !parts ? pulse(percent) : ''}</text>`
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
  `<filter id="cb-barglow" x="-20%" y="-150%" width="140%" height="400%"><feGaussianBlur stdDeviation=".9" result="b"/>` +
  `<feComponentTransfer in="b" result="g"><feFuncA type="linear" slope=".7"/></feComponentTransfer>` +
  `<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `</defs>`

export type Stats = {
  cost?: string
  limit?: number
  week?: number
  context?: number
  parts?: Part[]
  hit?: number
  tps?: number
  working: boolean
  cacheMinutes: number | null
  // /keepwarm's glow or thaw, while it plays.
  warm?: Warm
  // Whether /keepwarm's auto window is on.
  auto?: boolean
  // How many pieces are left out to fit a narrow band, in this order: HIT, TOK/S, CACHE, the session pair,
  // then the limits.
  drop?: number
}

// The left cluster: the 5-hour bar over the 7-day one, session cost over the context bar, then
// cache hit and tokens a second and the cache's minutes left. The status is its own drawing, so a
// new word redraws only it.
export function statsSvg(stats: Stats): Svg {
  // Every piece shows from the start, blank until measured, so the band never shifts as values arrive.
  const limits: Row[] = [
    { tag: '5H', percent: stats.limit ?? NaN },
    { tag: '7D', percent: stats.week ?? NaN },
  ]
  // The context bar runs from its tag to the right edge of the cost's slot above it.
  const session: Row[] = [
    { tag: 'SESSION', value: stats.cost ?? '$0.00', slot: COST_W },
    { tag: 'CTX', percent: stats.context ?? 0, barW: tagWidth('SESSION') + COST_W - tagWidth('CTX'), bare: true, parts: stats.parts },
  ]
  // Shown from the start, a dash until the first response measures them.
  const speed: Chip[] = [
    { label: 'HIT', value: stats.hit !== undefined ? `${stats.hit}%` : '—', widest: '100%' },
    { label: 'TOK/S', value: stats.tps !== undefined ? String(stats.tps) : '—', widest: '000' },
  ]
  const drop = stats.drop ?? 0
  const kept = speed.slice(Math.min(drop, speed.length))
  // A hairline after the clock, then the pieces left to right.
  let x = 15
  let body = `<rect class="track" x="0" y="8" width="1" height="24"/>`
  for (const draw of [
    drop < 5 && ((at: number) => stacked(limits, at)),
    drop < 4 && ((at: number) => stacked(session, at)),
    kept.length > 0 && ((at: number) => chips(kept, at)),
    drop < 3 && ((at: number) => (stats.cacheMinutes !== null ? cacheChip(at, stats.cacheMinutes, stats.working, stats.warm, stats.auto) : chips([{ label: 'CACHE', value: '—', widest: CACHE_WIDEST }], at))),
  ]) {
    if (!draw) continue
    const part = draw(x)
    body += part.body
    x += part.width + CHIP_GAP
  }
  return svg(Math.max(1, x - CHIP_GAP + 1), METER_DEFS.replace('</defs>', `${ICE_DEFS}${FROST_DEFS}</defs>`) + body)
}

// Claude's status, drawn right after the stats, a chip's gap from them.
export function statusSvg(state: string, working: boolean, elapsed?: number): Svg {
  const part = statusChip(CHIP_GAP - 1, state, working, elapsed)
  return svg(CHIP_GAP + part.width, part.body)
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
// A drawing's light colours, applied whatever the system's scheme.
export const forceLight = (source: string) => source.replace('@media (prefers-color-scheme:dark)', '@media not all')

// How long dimming for sleep, or brightening on waking, takes, in seconds.
export const FADE_S = 0.8

// How long a changed word or number takes to fade out and the new one in, in seconds.
export const SWAP_S = 0.3

const TEXT_EL = /<text\b([^>]*)>([\s\S]*?)<\/text>/g
// A text's place in the drawing, so the same chip's value is found again after a change. Only the first
// class counts, so a percent that changes colour with its level is still the same percent.
const placeOf = (attrs: string) => ['x', 'y', 'class'].map(a => new RegExp(`\\b${a}="([^" ]*)`).exec(attrs)?.[1] ?? '').join('|')
const words = (inner: string) => inner.replace(/<[^>]*>/g, '')
// The old text fades out over the first half of SWAP_S and the new one in over the second. Each rests at
// its end state, so without animation the new text simply shows.
const fadeOut = (el: string) => `<g opacity="0"><animate attributeName="opacity" values="1;0;0" keyTimes="0;.5;1" dur="${SWAP_S}s" fill="freeze"/>${el}</g>`
const fadeIn = (el: string) => `<g><animate attributeName="opacity" values="0;0;1" keyTimes="0;.5;1" dur="${SWAP_S}s" fill="freeze"/>${el}</g>`

// How long a changed number rolls to its new value, in seconds. It slows gently into place.
export const ROLL_S = 0.9
const SIZE: Record<string, number> = { value: 13, pct: 9.5, soft: 13, tick: 7 }
const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'
const amount = (w: string) => parseFloat(w.replace(/[^\d.]/g, '')) || 0
const ease = (name: string, from: number, to: number) =>
  `<animate attributeName="${name}" values="${from.toFixed(2)};${to.toFixed(2)}" dur="${ROLL_S}s" keyTimes="0;1" calcMode="spline" keySplines=".15 .85 .3 1" fill="freeze"/>`
const slide = (from: number, to: number) => ease('y', from, to)

const RECT_EL = /<rect\b([^>]*?)\/>/g
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]
// A bar piece's identity across drawings: its row, then its colour, glow or class. A context slice is known
// by its colour alone, as it slides along when the slices before it change; any other piece stays where it starts.
const rectKey = (attrs: string) => {
  const fill = attr(attrs, 'fill')
  return `${attr(attrs, 'y')}|${fill ?? attr(attrs, 'filter') ?? attr(attrs, 'class')}|${fill?.startsWith('#') ? '' : attr(attrs, 'x')}`
}

// `next` with each bar piece that moved easing from where it was in `prev`, over the same gentle ROLL_S as
// the numbers, so a bar fills or empties smoothly. A context slice that is new grows in from nothing.
function stretch(prev: string, next: string): string {
  const before = new Map<string, string>()
  for (const m of prev.matchAll(RECT_EL)) before.set(rectKey(m[1]!), m[1]!)
  return next.replace(RECT_EL, (el, attrs: string) => {
    const old = before.get(rectKey(attrs))
    const [x, w] = [Number(attr(attrs, 'x')), Number(attr(attrs, 'width'))]
    if (!old) return attr(attrs, 'fill')?.startsWith('#') ? `<rect${attrs}>${ease('width', 0, w)}</rect>` : el
    const [ox, ow] = [Number(attr(old, 'x')), Number(attr(old, 'width'))]
    if (ox === x && ow === w) return el
    return `<rect${attrs}>${ox !== x ? ease('x', ox, x) : ''}${ow !== w ? ease('width', ow, w) : ''}</rect>`
  })
}

// The new number rolled in like an odometer, inside its own line: each changed digit runs through the
// digits between, up when the number grew and down when it shrank, so 59 rolls on into 60. The digits
// are tabular, so every layer sets the same; a number that changed shape (9% to 10%) rolls in whole.
function roll(attrs: string, from: string, to: string, id: string): string {
  const y = Number(/\by="([^"]*)"/.exec(attrs)?.[1] ?? 0)
  const size = SIZE[/\bclass="(\w+)/.exec(attrs)?.[1] ?? ''] ?? 13
  const h = size * 1.25, dir = amount(to) >= amount(from) ? 1 : -1
  const text = (body: string, at = y) => `<text${attrs.replace(/\by="[^"]*"/, `y="${at.toFixed(2)}"`)}>${body}</text>`
  const a = [...from], b = [...to]
  const hidden = (c: string) => `<tspan fill-opacity="0">${c}</tspan>`
  let layers: string
  if (a.length !== b.length || a.some((c, k) => (isDigit(c) ? !isDigit(b[k]) : c !== b[k]))) {
    layers = text(slide(y, y - dir * h) + from) + text(slide(y + dir * h, y) + to)
  } else {
    const steps = a.map((c, k) => (isDigit(c) ? (dir * (Number(b[k]) - Number(c)) + 10) % 10 : 0))
    // Every layer is the whole number with all but one digit see-through, so it sets exactly as the plain
    // number and each digit stays in its column. (A tspan with its own y starts a new chunk, centred alone.)
    layers = text(b.map((c, k) => (steps[k] ? hidden(c) : c)).join(''))
    a.forEach((c, k) => {
      const s = steps[k]!
      for (let j = 0; s && j <= s; j++) {
        const digit = String((Number(c) + dir * j + 10) % 10)
        layers += text(slide(y + dir * j * h, y + dir * (j - s) * h) + b.map((d, i) => (i === k ? digit : hidden(d))).join(''), y + dir * j * h)
      }
    })
  }
  return `<clipPath id="${id}"><rect x="-999" y="${(y - size).toFixed(2)}" width="9999" height="${(size * 1.3).toFixed(2)}"/></clipPath>` +
    `<g clip-path="url(#${id})">${layers}</g>`
}

// `next` with each text whose words differ from `prev` at its place changing over: a number rolls to its new
// value, anything else fades, the old out and then the new in. Texts that kept their words stay as they are.
// Bars ease to their new length.
export function crossfade(prev: string, next: string): string {
  next = stretch(prev, next)
  const before = new Map<string, { el: string; words: string }>()
  for (const m of prev.matchAll(TEXT_EL)) before.set(placeOf(m[1]), { el: m[0], words: words(m[2]) })
  const seen = new Set<string>()
  let rolls = 0
  const out = next.replace(TEXT_EL, (el, attrs: string, inner: string) => {
    const place = placeOf(attrs)
    seen.add(place)
    const old = before.get(place)
    if (old?.words === words(inner)) return el
    if (old && /\d/.test(old.words) && /\d/.test(words(inner))) return roll(attrs, old.words, words(inner), `cb-roll${rolls++}`)
    return (old ? fadeOut(old.el) : '') + fadeIn(el)
  })
  const gone = [...before].filter(([place]) => !seen.has(place)).map(([, old]) => fadeOut(old.el)).join('')
  return gone ? out.replace(/<\/svg>\s*$/, `${gone}</svg>`) : out
}

// The drawing's top-level elements, its style and defs among them, each with what it holds.
function pieces(source: string): string[] {
  const body = source.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const out: string[] = []
  let depth = 0
  let start = 0
  for (const m of body.matchAll(/<(\/?)[a-zA-Z][^>]*?(\/?)>/g)) {
    if (m[1]) depth--
    else if (!m[2]) depth++
    if (depth === 0) {
      out.push(body.slice(start, m.index + m[0].length))
      start = m.index + m[0].length
    }
  }
  return out
}
const widthOf = (source: string) => Number(/^<svg[^>]*?\bwidth="([\d.]+)"/.exec(source)?.[1] ?? 0)
const BOOKKEEPING = /^<(style|defs|clipPath)\b/

// `next` after its pieces changed, as when the band left one out or took one back: whatever stays put stays,
// what went fades out and what came fades in. It is as wide as the wider of the two while that plays.
export function regroup(prev: string, next: string): string {
  const before = pieces(prev)
  const after = pieces(next)
  const had = new Set(before)
  const has = new Set(after)
  const kept = (p: string) => had.has(p) || BOOKKEEPING.test(p)
  const body =
    after.map(p => (kept(p) ? p : fadeIn(p))).join('') +
    before.filter(p => !has.has(p)).map(p => (BOOKKEEPING.test(p) ? p : fadeOut(p))).join('')
  const w = Math.max(widthOf(prev), widthOf(next))
  const open = /^<svg[^>]*>/.exec(next)![0].replace(/viewBox="0 0 [\d.]+ /, `viewBox="0 0 ${w} `).replace(/\bwidth="[\d.]+"/, `width="${w}"`)
  return `${open}${body}</svg>`
}

// A whole drawing coming or going: fading in, or out.
export function fadeAll(source: string, appearing: boolean): string {
  const [, open, body] = /^(<svg[^>]*>)([\s\S]*)<\/svg>\s*$/.exec(source)!
  return `${open}${(appearing ? fadeIn : fadeOut)(body!)}</svg>`
}

// The width a drawing's markup gives itself.
export const drawnWidth = widthOf

// A drawing at `to` opacity, easing there from `from` when it changed `ago` seconds back.
export function fade(source: string, from: number, to: number, ago: number): string {
  if (ago >= FADE_S) return to === 1 ? source : source.replace('<svg ', `<svg opacity="${to}" `)
  return source.replace(/<svg [^>]*>/, tag =>
    `${tag.replace('<svg ', `<svg opacity="${to}" `)}` +
    `<animate attributeName="opacity" values="${from};${to}" dur="${FADE_S}s" begin="${(-ago).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines=".42 0 .58 1"/>`)
}

// A glowing crescent moon with twinkling stars by it and comets gliding past now and then, top left
// to bottom right, then three z's drifting up from a sleeping Clawd and fading, one after another.
export const SLEEP_W = 64
export function sleepSvg(): Svg {
  const z = (x: number, size: number, delay: number) =>
    `<text x="${x}" y="32" font-size="${size}" opacity="0">z` +
    `<animate attributeName="opacity" values="0;.95;0" dur="3s" begin="${delay}s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;6 -18" dur="3s" begin="${delay}s" repeatCount="indefinite"/></text>`
  // A four-pointed star at x, y, twinkling between dim and bright.
  const star = (x: number, y: number, r: number, delay: number) =>
    `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#F5E7B8" opacity=".9">` +
    `<animate attributeName="opacity" values=".9;.25;.9" dur="${2.4 + r}s" begin="${delay}s" repeatCount="indefinite"/></path>`
  // Seeded randomness: the same on every drawing, so a redraw does not reload the frame.
  let seed = 20261021
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // A comet gliding down and to the right at its own angle, making three passes every `dur` seconds,
  // each from a random place, after a random wait, over a random distance and speed, so the sky never
  // shows the same pass twice in a row. A bright nucleus in a fuzzy coma, a broad curved dust tail
  // made grainy and foggy by noise, and a fainter bluish ion tail running straight back.
  const comet = (dur: number, at: number) => {
    const angle = 22 + rand() * 16
    const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)]
    const moves: [number, string][] = []
    const fades: [number, number][] = []
    for (let k = 0; k < 3; k++) {
      const [s0, s1] = [k / 3, (k + 1) / 3]
      const travel = (0.35 + rand() * 0.2) / 3
      const a = s0 + rand() * (s1 - s0 - travel - 0.01)
      const b = a + travel
      const [x, y, dist] = [-2 + rand() * 40, -2 + rand() * 12, 20 + rand() * 10]
      const [from, to] = [`${x.toFixed(1)} ${y.toFixed(1)}`, `${(x + dist * cos).toFixed(1)} ${(y + dist * sin).toFixed(1)}`]
      moves.push([s0, from], [a, from], [b, to], [s1, to])
      fades.push([s0, 0], [a, 0], [a + travel * 0.15, 1], [b - travel * 0.2, 1], [b, 0], [s1, 0])
    }
    const times = (list: [number, unknown][]) => list.map(([t]) => t.toFixed(4)).join(';')
    const values = (list: [number, unknown][]) => list.map(([, v]) => v).join(';')
    return (
      `<g opacity="0">` +
      `<animate attributeName="opacity" values="${values(fades)}" keyTimes="${times(fades)}" dur="${dur}s" begin="${at}s" repeatCount="indefinite"/>` +
      `<animateTransform attributeName="transform" type="translate" values="${values(moves)}" keyTimes="${times(moves)}" dur="${dur}s" begin="${at}s" repeatCount="indefinite"/>` +
      `<g transform="rotate(${angle.toFixed(1)})"><g filter="url(#cb-soft)">`
    ) +
    `<path d="M0 -.8C-5 -1.4 -10 -1.6 -16 -1L-16 3.4C-10 2.4 -5 1.4 0 .8Z" fill="url(#cb-dust)" filter="url(#cb-fog)">` +
    `<animate attributeName="opacity" values=".75;1;.75" dur=".9s" repeatCount="indefinite"/></path>` +
    `<path d="M0 0L-20 -.6" stroke="url(#cb-ion)" stroke-width="1" stroke-linecap="round"/></g>` +
    `<circle r="2.2" fill="url(#cb-coma)"/><circle r=".55" fill="#FFFFFF" filter="url(#cb-moon)"/></g></g>`
  }
  return {
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SLEEP_W} ${BAR_HEIGHT}" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
      `<defs><filter id="cb-moon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>` +
      `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
      `<mask id="cb-crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
      `<rect width="${SLEEP_W}" height="${BAR_HEIGHT}" fill="#fff"/><circle cx="16" cy="15" r="8" fill="#000"/></mask>` +
      `<linearGradient id="cb-dust" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-16" y2="0"><stop offset="0" stop-color="#FFF6E0" stop-opacity=".9"/>` +
      `<stop offset=".35" stop-color="#F5E7B8" stop-opacity=".45"/><stop offset="1" stop-color="#E8DCC0" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="cb-ion" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-20" y2="0"><stop offset="0" stop-color="#DCE8FF" stop-opacity=".55"/>` +
      `<stop offset="1" stop-color="#B9C8F5" stop-opacity="0"/></linearGradient>` +
      `<radialGradient id="cb-coma"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".45" stop-color="#F5E7B8" stop-opacity=".4"/>` +
      `<stop offset="1" stop-color="#F5E7B8" stop-opacity="0"/></radialGradient>` +
      // Noise pushes the dust tail's edges about and mottles it, then a blur softens it into haze.
      `<filter id="cb-fog" x="-50%" y="-150%" width="200%" height="400%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feGaussianBlur in="d" stdDeviation=".55" result="b"/>` +
      `<feComposite in="b" in2="n" operator="arithmetic" k1="1.3" k2=".3"/></filter>` +
      `<filter id="cb-soft" x="-50%" y="-150%" width="200%" height="400%"><feGaussianBlur stdDeviation=".6"/></filter>` +
      // Comets fade out toward every edge of the drawing instead of being cut off by it.
      `<linearGradient id="cb-fx"><stop offset="0" stop-color="#000"/><stop offset=".18" stop-color="#fff"/>` +
      `<stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
      `<linearGradient id="cb-fy" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".25" stop-color="#fff"/>` +
      `<stop offset=".75" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
      `<mask id="cb-ex" maskUnits="userSpaceOnUse" x="0" y="0" width="${SLEEP_W}" height="${BAR_HEIGHT}"><rect width="${SLEEP_W}" height="${BAR_HEIGHT}" fill="url(#cb-fx)"/></mask>` +
      `<mask id="cb-ey" maskUnits="userSpaceOnUse" x="0" y="0" width="${SLEEP_W}" height="${BAR_HEIGHT}"><rect width="${SLEEP_W}" height="${BAR_HEIGHT}" fill="url(#cb-fy)"/></mask></defs>` +
      `<circle cx="12" cy="20" r="9" fill="#F5E7B8" mask="url(#cb-crescent)" filter="url(#cb-moon)"/>` +
      star(24, 8, 2, 0) + star(4, 34, 1.5, -1.2) + star(33, 3, 1.2, -0.6) + star(56, 9, 1.4, -1.8) + star(26, 33, 1, -2.4) +
      `<g mask="url(#cb-ex)"><g mask="url(#cb-ey)">` +
      comet(23, 0) + comet(29, -7) + comet(31, -13) + comet(37, -19) +
      `</g></g>` +
      `<style>text{font-family:${FONT};font-weight:700;fill:#B9C8F5}</style>${z(30, 11, 0)}${z(38, 14, 1)}${z(46, 17, 2)}</svg>`,
    width: SLEEP_W,
    height: BAR_HEIGHT,
  }
}

// The day, from the end of night at 05:30 to its start at 23:15, in eight even periods of 2h13m.
// Each is drawn in the night's style. The sun crosses the drawing on one arc as the day goes, rising
// out of a soft haze low on the left at dawn, highest in the middle at midday and sinking into haze
// low on the right at dusk, glowing as the night's moon does; then the evening's full moon rises low
// on the left, before the night's crescent stands higher there. Things cross the sky as the night's
// comets do, fading at the edges: clouds lit for the hour, birds in the morning and heading home at
// golden hour, a plane's contrail at midday, the last stars at dawn and the first at dusk, and the
// first z's in the evening. A `dark` period draws the band dark.
const DAY_START = 5 * 60 + 30
const PERIOD_MIN = (23 * 60 + 15 - DAY_START) / 8

// `idle` is what the status says while Clawd waits in that period.
export type DayPeriod = { name: string; idle: string; bg: string; dark?: boolean; art: () => Svg }

// Where the sun is at step i of 0 to 6 across the day: along an arc from low left to low right.
const HORIZON = 28
const arc = (i: number) => {
  const t = i / 6
  return { cx: 10 + 44 * t, cy: HORIZON - 17 * Math.sin(Math.PI * t) }
}

// The sky body: a disc with the moon's glow. `sinking` has it low in a soft haze at the horizon, its
// lower part fading out rather than cut off.
const body = (cx: number, cy: number, r: number, fill: string, sinking = false) => {
  const disc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" filter="url(#cb-glow)"/>`
  if (!sinking) return disc
  return (
    `<linearGradient id="cb-sink" gradientUnits="userSpaceOnUse" x1="0" y1="${HORIZON - 7}" x2="0" y2="${HORIZON + 1}">` +
    `<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<mask id="cb-horizon" maskUnits="userSpaceOnUse" x="0" y="0" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
    `<rect width="${SLEEP_W}" height="${BAR_HEIGHT}" fill="url(#cb-sink)"/></mask>` +
    `<ellipse cx="${cx}" cy="${HORIZON}" rx="10" ry="3" fill="${fill}" opacity=".45" filter="url(#cb-haze)">` +
    `<animate attributeName="opacity" values=".3;.55;.3" dur="5s" repeatCount="indefinite"/></ellipse>` +
    `<g mask="url(#cb-horizon)">${disc}</g>`
  )
}

// Small stars at `at` [x, y, delay]; `fading` has them twinkle out, as the night leaves at dawn,
// otherwise they twinkle in, as it comes at dusk.
const stars = (fill: string, at: number[][], fading = false) =>
  at
    .map(([x, y, delay]) =>
      `<circle cx="${x}" cy="${y}" r="1.1" fill="${fill}" filter="url(#cb-glow)" opacity="${fading ? 0.9 : 0.2}">` +
      `<animate attributeName="opacity" values="${fading ? '.9;.1;.9' : '.15;1;.15'}" dur="4s" begin="${delay}s" repeatCount="indefinite"/></circle>`)
    .join('')

// z's drifting up and fading as the night's do, starting at x0 and a size of size0.
const snooze = (count: number, fill: string, peak: number, x0: number, size0: number) =>
  `<style>text{font-family:${FONT};font-weight:700;fill:${fill}}</style>` +
  Array.from({ length: count }, (_, i) =>
    `<text x="${x0 + 7 * i}" y="32" font-size="${size0 + 3 * i}" opacity="0">z` +
    `<animate attributeName="opacity" values="0;${peak};0" dur="3s" begin="${(3 * i) / count}s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;6 -18" dur="3s" begin="${(3 * i) / count}s" repeatCount="indefinite"/></text>`).join('')

// Something crossing the sky left to right at height y every `dur` seconds, from `at` into it.
const crossing = (y: number, dur: number, at: number, inner: string) =>
  `<g><animateTransform attributeName="transform" type="translate" values="-24 ${y};${SLEEP_W + 8} ${y}" dur="${dur}s" begin="${at}s" repeatCount="indefinite"/>${inner}</g>`

// A soft flat cloud at scale s, its underside shaded.
const cloud = (s: number, fill: string, shade: string) => {
  const puffs = (dy: number) =>
    `<circle cx="${4 * s}" cy="${(4 + dy) * s}" r="${3.6 * s}"/><circle cx="${9.5 * s}" cy="${(2.6 + dy) * s}" r="${4.6 * s}"/>` +
    `<circle cx="${15 * s}" cy="${(4.4 + dy) * s}" r="${3.2 * s}"/><rect x="${1 * s}" y="${(4 + dy) * s}" width="${17 * s}" height="${3.6 * s}" rx="${1.8 * s}"/>`
  return `<g filter="url(#cb-fluff)"><g fill="${shade}">${puffs(1.1)}</g><g fill="${fill}">${puffs(0)}</g></g>`
}

// A bird flapping as it flies, at scale s.
const bird = (s: number, stroke: string, begin = 0) => {
  const up = `M${-3 * s} 0Q${-1.5 * s} ${-2 * s} 0 0Q${1.5 * s} ${-2 * s} ${3 * s} 0`
  const down = `M${-3 * s} ${-0.8 * s}Q${-1.5 * s} ${0.8 * s} 0 0Q${1.5 * s} ${0.8 * s} ${3 * s} ${-0.8 * s}`
  return (
    `<path d="${up}" fill="none" stroke="${stroke}" stroke-width="${0.9 * s}" stroke-linecap="round" stroke-linejoin="round">` +
    `<animate attributeName="d" values="${up};${down};${up}" dur=".7s" begin="${begin}s" repeatCount="indefinite"/></path>`
  )
}

// A plane, a bright glint drawing a long contrail that fades behind it: the day's comet.
const plane =
  `<path d="M0 0L-26 1.6" stroke="url(#cb-trail)" stroke-width="1.1" stroke-linecap="round" filter="url(#cb-haze-soft)"/>` +
  `<circle r=".9" fill="#FFFFFF" filter="url(#cb-glow)"/>`

// Each hour's own visitor, on top of its clouds.
const EASE2 = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"'

// Dawn: a hot-air balloon rising slowly, swaying as it goes.
const balloon =
  `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.8;1" dur="26s" begin="-9s" repeatCount="indefinite"/>` +
  `<animateTransform attributeName="transform" type="translate" values="46 38;43 20;47 -6" dur="26s" begin="-9s" repeatCount="indefinite" ${EASE2}/>` +
  `<g><animateTransform attributeName="transform" type="rotate" values="-4;4;-4" dur="5s" repeatCount="indefinite" ${EASE2}/>` +
  `<path d="M0 -6C3.8 -6 4.8 -2.4 3.2 .8L1.2 3.4H-1.2L-3.2 .8C-4.8 -2.4 -3.8 -6 0 -6Z" fill="#E9785A"/>` +
  `<path d="M0 -6C1.4 -6 1.8 -2.4 1.2 .8L.5 3.4H-.5L-1.2 .8C-1.8 -2.4 -1.4 -6 0 -6Z" fill="#F7C08A"/>` +
  `<path d="M-1.1 3.4L-.8 5.2M1.1 3.4L.8 5.2" stroke="#8A6F62" stroke-width=".3"/>` +
  `<rect x="-1" y="5.1" width="2" height="1.5" rx=".3" fill="#8A6F62"/></g></g>`

// Morning: a paper plane gliding through with a loop in its flight.
const paperPlane =
  `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="11s" begin="-2s" repeatCount="indefinite"/>` +
  `<animateMotion path="M-6 24C8 18 18 10 28 14S36 28 28 26S30 12 44 12S60 16 70 12" dur="11s" begin="-2s" repeatCount="indefinite" rotate="auto"/>` +
  `<path d="M3 0L-3 -2.2L-1.4 0Z" fill="#FFFFFF" stroke="#C8B8AA" stroke-width=".25" stroke-linejoin="round"/>` +
  `<path d="M3 0L-3 1.6L-1.4 0Z" fill="#E6DCD2" stroke="#C8B8AA" stroke-width=".25" stroke-linejoin="round"/></g>`

// Late morning: a kite on a string Clawd holds, swaying, its tail rippling.
const kite =
  `<g><animateTransform attributeName="transform" type="rotate" values="-5 66 42;4 66 42;-5 66 42" dur="5s" repeatCount="indefinite" ${EASE2}/>` +
  `<path d="M66 42Q56 30 47 15" fill="none" stroke="#B9AFA2" stroke-width=".35"/>` +
  `<g transform="translate(47 11)"><g><animateTransform attributeName="transform" type="rotate" values="-8 0 4;8 0 4;-8 0 4" dur="2.4s" repeatCount="indefinite" ${EASE2}/>` +
  `<path d="M0 -4L3 0L0 4L-3 0Z" fill="#E46F3A"/><path d="M0 -4L3 0L0 4Z" fill="#F59D72"/>` +
  `<path d="M0 4q-1.5 1.5 0 3t0 3" fill="none" stroke="#4A7FE0" stroke-width=".6" stroke-linecap="round">` +
  `<animate attributeName="d" values="M0 4q-1.5 1.5 0 3t0 3;M0 4q1.5 1.5 0 3t0 3;M0 4q-1.5 1.5 0 3t0 3" dur="1.2s" repeatCount="indefinite"/></path></g></g></g>`

// Midday: a monarch butterfly wandering past, seen three-quarters from the side and banking with
// its path. Its wings rise and fall about its body, the far pair smaller and darker behind it and a
// beat behind the near pair, each shaded from a light root to a deep tip, edged black and spotted
// white; they beat twice, fast on the downstroke, then glide. The body is rounded with a highlight.
const monarchWings = (fill: string) =>
  `<path d="M.4 0C.8 -2 2.4 -5 4.2 -5.6C4.8 -4.2 3.4 -1.4 .9 0Z" fill="${fill}" stroke="#2E2420" stroke-width=".4" stroke-linejoin="round"/>` +
  `<path d="M0 0C-.6 -1.6 -2.6 -3.6 -3.8 -3.4C-4 -2 -2.2 -.4 0 0Z" fill="${fill}" stroke="#2E2420" stroke-width=".4" stroke-linejoin="round"/>` +
  `<path d="M.6 0L3.6 -4.8M.7 0L3.8 -2.6M0 0L-3 -2.8M0 0L-2.4 -1.2" stroke="#2E2420" stroke-width=".2"/>` +
  `<g fill="#FFFFFF"><circle cx="4" cy="-5.2" r=".22"/><circle cx="4.4" cy="-4.4" r=".18"/><circle cx="-3.4" cy="-3.1" r=".2"/><circle cx="-3.7" cy="-2.4" r=".16"/></g>`
// Two beats with the wings swinging from up over the back to down under the body, then a glide.
const beat = (up: number, down: number, begin = 0) =>
  `<animateTransform attributeName="transform" type="scale" values="1 ${up};1 ${down};1 ${up};1 ${down};1 ${up};1 ${up}" keyTimes="0;.1;.24;.34;.48;1" dur="1.2s" begin="${begin}s" repeatCount="indefinite"/>`
const butterfly =
  `<g><animateMotion path="M-6 30C6 22 12 32 22 24S34 14 42 22S56 30 70 20" dur="15s" begin="-4s" repeatCount="indefinite" rotate="auto"/>` +
  `<g transform="scale(.55)">` +
  `<g transform="translate(-.6 -.4) scale(.88)"><g>${beat(0.9, -0.2, -0.06)}${monarchWings('url(#cb-wing-far)')}</g></g>` +
  `<path d="M-.5 .7L-1 2M.6 .8L.4 2.1M1.3 .7L1.7 1.9" stroke="#2E2420" stroke-width=".18" stroke-linecap="round"/>` +
  `<ellipse cx="-1.4" cy=".25" rx="2.6" ry=".7" fill="url(#cb-body)"/><ellipse cx="1" cy="0" rx="1" ry=".85" fill="url(#cb-body)"/>` +
  `<circle cx="2.3" cy="-.2" r=".62" fill="url(#cb-body)"/>` +
  `<path d="M2.6 -.7Q3.6 -2.4 4.6 -2.8M2.4 -.8Q3 -2.6 3.6 -3.2" fill="none" stroke="#2E2420" stroke-width=".18" stroke-linecap="round"/>` +
  `<circle cx="4.6" cy="-2.8" r=".2" fill="#2E2420"/><circle cx="3.6" cy="-3.2" r=".2" fill="#2E2420"/>` +
  `<g>${beat(1, -0.35)}${monarchWings('url(#cb-wing)')}</g></g></g>`

// Afternoon: dandelion seeds drifting on the breeze, turning as they go.
const seed = (path: string, dur: number, begin: number) =>
  `<g><animateMotion path="${path}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
  `<g><animateTransform attributeName="transform" type="rotate" values="-20;20;-20" dur="3s" repeatCount="indefinite" ${EASE2}/>` +
  `<path d="M0 2V0M0 0L-1.6 -1.2M0 0L-.8 -1.8M0 0L0 -2M0 0L.8 -1.8M0 0L1.6 -1.2" stroke="#B7AD9C" stroke-width=".3" stroke-linecap="round"/>` +
  `<circle cy="2.2" r=".35" fill="#9C8F7A"/></g></g>`
const seeds =
  seed('M-4 30C10 26 18 32 30 24S48 18 70 14', 16, 0) + seed('M-4 22C8 26 20 16 32 20S50 10 70 8', 19, -7) + seed('M-4 34C14 30 24 36 38 28S56 26 70 22', 22, -13)

// Golden hour: geese in a V heading home, each beating its wings in its own time.
const geese = [[0, 0, 0.85, 0], [-4.5, -2.4, 0.7, -0.2], [-4.5, 2.4, 0.7, -0.35], [-9, -4.6, 0.6, -0.15], [-9, 4.6, 0.6, -0.5]]
  .map(([dx, dy, s, begin]) => `<g transform="translate(${dx} ${dy})">${bird(s, '#9A5E3E', begin)}</g>`)
  .join('')

// Dusk: paper sky lanterns drifting up, lit from within, their flames flickering.
const lantern = (x: number, dur: number, begin: number, s: number) =>
  `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.75;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
  `<animateTransform attributeName="transform" type="translate" values="${x} 40;${x + 4} 22;${x + 1} 2" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" ${EASE2}/>` +
  `<g transform="scale(${s})"><g><animateTransform attributeName="transform" type="rotate" values="-5;5;-5" dur="4s" repeatCount="indefinite" ${EASE2}/>` +
  `<path d="M-2.4 -3.2Q0 -3.8 2.4 -3.2L1.8 2.6Q0 3 -1.8 2.6Z" fill="url(#cb-paper)" filter="url(#cb-glow)"/>` +
  `<ellipse cy="2.7" rx="1.8" ry=".4" fill="#B5603A" opacity=".6"/>` +
  `<circle cy="2" r=".6" fill="#FFF6D0"><animate attributeName="opacity" values="1;.55;1" dur=".5s" repeatCount="indefinite"/></circle></g></g></g>`
const lanterns = lantern(28, 18, 0, 0.9) + lantern(40, 22, -9, 0.7) + lantern(20, 20, -14, 0.6)

const dayScene = (content: string, sky = ''): Svg => ({
  width: SLEEP_W,
  height: BAR_HEIGHT,
  source:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SLEEP_W} ${BAR_HEIGHT}" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
    `<defs><filter id="cb-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="cb-haze" x="-50%" y="-150%" width="200%" height="400%"><feGaussianBlur stdDeviation="1.8"/></filter>` +
    `<filter id="cb-haze-soft" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation=".5"/></filter>` +
    // Noise roughens a cloud's outline and a blur softens it, so its edges read as fluff.
    `<filter id="cb-fluff" x="-20%" y="-30%" width="140%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation=".45"/></filter>` +
    `<radialGradient id="cb-wing" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="6"><stop offset="0" stop-color="#FBC07A"/>` +
    `<stop offset=".55" stop-color="#EE8A38"/><stop offset="1" stop-color="#C9561C"/></radialGradient>` +
    `<radialGradient id="cb-wing-far" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="6"><stop offset="0" stop-color="#D99A5C"/>` +
    `<stop offset="1" stop-color="#9C4518"/></radialGradient>` +
    `<radialGradient id="cb-body" cx=".38" cy=".3" r=".7"><stop offset="0" stop-color="#7A6150"/><stop offset="1" stop-color="#1E1712"/></radialGradient>` +
    `<linearGradient id="cb-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9874E"/><stop offset="1" stop-color="#FFE2A0"/></linearGradient>` +
    `<linearGradient id="cb-trail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-26" y2="0"><stop offset="0" stop-color="#FFFFFF"/>` +
    `<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>` +
    // What crosses the sky fades out toward the left and right edges instead of being cut off.
    `<linearGradient id="cb-fx"><stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#fff"/>` +
    `<stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<mask id="cb-edges" maskUnits="userSpaceOnUse" x="0" y="0" width="${SLEEP_W}" height="${BAR_HEIGHT}">` +
    `<rect width="${SLEEP_W}" height="${BAR_HEIGHT}" fill="url(#cb-fx)"/></mask></defs>` +
    `${content}<g mask="url(#cb-edges)">${sky}</g></svg>`,
})

const sun = (i: number, r: number, fill: string) => {
  const { cx, cy } = arc(i)
  return body(cx, i === 0 ? cy - 1 : i === 6 ? cy + 2 : cy, r, fill, i === 0 || i === 6)
}

export const DAY_PERIODS: DayPeriod[] = [
  {
    // The sun rising out of a warm haze low on the left, a pink cloud, and the night's last stars.
    name: 'Dawn',
    idle: 'Stirring',
    bg: '#F8E1D3',
    art: () =>
      dayScene(
        sun(0, 8.5, '#F6A27C') + stars('#FFF6EE', [[40, 6, 0], [54, 12, -1.3], [30, 3, -2.6]], true),
        crossing(15, 46, -20, cloud(0.8, '#F7CBBA', '#EBAA96')) + balloon,
      ),
  },
  {
    // The sun up, white clouds, and two birds out.
    name: 'Morning',
    idle: 'Brewing',
    bg: '#F9EBE0',
    art: () =>
      dayScene(
        sun(1, 7.5, '#F9B95C'),
        crossing(22, 40, -8, cloud(0.9, '#FFFFFF', '#EED9C8')) +
          crossing(9, 14, -3, bird(0.9, '#8A6F62') + `<g transform="translate(-6 3)">${bird(0.7, '#8A6F62', -0.3)}</g>`) +
          paperPlane,
      ),
  },
  {
    // The sun climbing, and clouds drifting at two depths.
    name: 'Late morning',
    idle: 'Ready',
    bg: '#FAF3EC',
    art: () =>
      dayScene(
        sun(2, 8, '#F8C34E'),
        `<g opacity=".8">${crossing(6, 60, -40, cloud(0.6, '#FFFFFF', '#E7DFD3'))}</g>` +
          crossing(23, 36, -10, cloud(1, '#FFFFFF', '#E7DFD3')) +
          kite,
      ),
  },
  {
    // The sun at its height, and a plane's contrail drawn slowly across the clear sky.
    name: 'Midday',
    idle: 'Lunching',
    bg: '#FAF9F5',
    art: () =>
      dayScene(
        sun(3, 8.5, '#F8C843'),
        `<g><animateTransform attributeName="transform" type="translate" values="-6 30;${SLEEP_W + 30} 22" dur="16s" begin="-5s" repeatCount="indefinite"/>` +
          `<g transform="rotate(-6)">${plane.replace(/#FFFFFF/g, '#C9C2B6')}</g></g>` +
          crossing(27, 52, -30, cloud(0.55, '#FFFFFF', '#E6E0D4')) +
          butterfly,
      ),
  },
  {
    // The sun past its height, and fat clouds drifting by.
    name: 'Afternoon',
    idle: 'Lounging',
    bg: '#FAF4DE',
    art: () =>
      dayScene(
        sun(4, 8, '#F6B04A'),
        crossing(5, 44, -6, cloud(0.75, '#FFFFFF', '#EADFC4')) +
          crossing(24, 38, -22, cloud(1.05, '#FFFFFF', '#EADFC4')) +
          `<g opacity=".85">${crossing(15, 50, -38, cloud(0.6, '#FFFFFF', '#EADFC4'))}</g>` +
          seeds,
      ),
  },
  {
    // The sun low on the right and deep orange, gold-lit clouds, and a V of geese heading home.
    name: 'Golden hour',
    idle: 'Basking',
    bg: '#F8E3BC',
    art: () =>
      dayScene(
        sun(5, 8.5, '#F2954A'),
        crossing(25, 42, -14, cloud(0.85, '#FBD7A3', '#EDB277')) + crossing(10, 20, -6, geese),
      ),
  },
  {
    // The sun sinking into haze low on the right, a rose cloud, the first stars coming out, and sky
    // lanterns rising.
    name: 'Dusk',
    idle: 'Unwinding',
    bg: '#F2C9A0',
    art: () =>
      dayScene(
        sun(6, 8.5, '#EC7E62') + stars('#FFFBF2', [[8, 6, 0], [20, 12, -1.5], [30, 4, -2.8], [14, 20, -0.8]]),
        crossing(14, 48, -26, cloud(0.8, '#E8A8A0', '#CF8786')) + lanterns,
      ),
  },
  {
    // The full moon rising low on the left before the night's crescent, stars, and the first z's.
    name: 'Evening',
    idle: 'Drowsy',
    bg: '#3D4466',
    dark: true,
    art: () =>
      dayScene(
        body(8, 27, 7.5, '#F5E7B8') + stars('#F5E7B8', [[24, 7, 0], [40, 4, -1.6], [56, 10, -2.9]]) + snooze(2, '#B9C8F5', 0.6, 30, 11),
      ),
  },
]

// The day period `ms` falls in; night has none.
export function periodAt(ms: number): DayPeriod | undefined {
  if (isNight(ms)) return undefined
  const d = new Date(ms)
  return DAY_PERIODS[Math.min(7, Math.floor((d.getHours() * 60 + d.getMinutes() - DAY_START) / PERIOD_MIN))]
}

// When each period starts, as minutes after midnight.
export const periodStart = (i: number) => DAY_START + i * PERIOD_MIN

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
