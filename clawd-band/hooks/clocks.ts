import { DAY_PERIODS, periodAt } from './design'

// The band's clock: one fixed look for each stage of the day, all in the same 88 by 40 casing.
// Each is one standalone SVG: a casing (material, bevel, rim), a recessed screen (inner shadow, glass glare) and a digit style.

type Stop = [number, string, number?]
type Time = { H: number; m: number; s: number; pm: boolean; hr: string; mm: string; h1: string | null; h2: string; m1: string; m2: string }
type Glow = [string, number, number, number, number]
type Material = { base: Stop[]; rim: string; hi: number; lo: number; tex?: string }
type Screen = { base: Stop[]; sh: number; glare: number; edge?: number }
type Look = { mat: Material; scr: Screen; fmt: '12' | '24'; draw: (t: Time) => string }

const r2 = (n: number) => Math.round(n * 100) / 100
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
const BODY = 'x=".5" y=".5" width="87" height="39" rx="8"'
const SCREEN = 'x="5" y="5" width="78" height="30" rx="3.5"'
const RING = rr(3.5, 3.5, 81, 33, 5) + rr(5, 5, 78, 30, 3.5)
const FU = 'filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"'
const SCR_F = `x="5" y="5" width="78" height="30" ${FU}`
const stops = (s: Stop[]) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('')
const lin = (id: string, s: Stop[], x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`
const rad = (id: string, s: Stop[], cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`
const BLINK = '<animate attributeName="opacity" values="1;.12" keyTimes="0;.5" calcMode="discrete" dur="2s" repeatCount="indefinite"/>'

// A lit element's glow: a tight and a wide halo in `c`, under the element itself.
const glowF = (id: string, c: string, sd1: number, a1: number, sd2: number, a2: number) =>
  `<filter id="${id}" ${SCR_F}>` +
  `<feGaussianBlur in="SourceAlpha" stdDeviation="${sd1}" result="b1"/><feGaussianBlur in="SourceAlpha" stdDeviation="${sd2}" result="b2"/>` +
  `<feFlood flood-color="${c}"/><feComposite in2="b1" operator="in"/><feComponentTransfer result="g1"><feFuncA type="linear" slope="${a1}"/></feComponentTransfer>` +
  `<feFlood flood-color="${c}"/><feComposite in2="b2" operator="in"/><feComponentTransfer result="g2"><feFuncA type="linear" slope="${a2}"/></feComponentTransfer>` +
  `<feMerge><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

// ---- textures: a noise field turned into dark grains (where high) and light grains (where low) ----
const grainF = (id: string, turb: string, k: number, kl = k) =>
  `<filter id="${id}" x="0" y="0" width="88" height="40" ${FU}>${turb.replace('/>', ' result="n"/>')}` +
  `<feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${k} 0 0 0 ${-k / 2}" result="d"/>` +
  `<feColorMatrix in="n" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${-kl} 0 0 0 ${kl / 2}" result="l"/>` +
  `<feMerge><feMergeNode in="d"/><feMergeNode in="l"/></feMerge></filter><rect width="88" height="40" filter="url(#${id})"/>`
const turb = (f: string, o: number, seed: number) => `<feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="${o}" seed="${seed}"/>`

// ---- sheens over the casing ----
const satin = (a: number) =>
  `<radialGradient id="sa" cx=".28" cy="-.15" r=".95"><stop offset="0" stop-color="#fff" stop-opacity="${a}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><rect ${BODY} fill="url(#sa)"/>`
const gloss = (a: number) =>
  lin('gs', [[0, '#fff', a], [1, '#fff', a * 0.25]]) + `<path clip-path="url(#bc)" d="M0 0H88V11.5C63 9.2 25 9.6 0 13.6Z" fill="url(#gs)"/>`

// ---- casings: base is the vertical gradient; hi and lo the bevel's light on top and shade below; rim the outer edge ----
const MAT: Record<'cream' | 'graphite' | 'piano' | 'carbon' | 'mint', Material> = {
  cream: { base: [[0, '#FAF7F0'], [0.55, '#ECE7DB'], [1, '#D2CBBB']], rim: '#9F988A', hi: 0.95, lo: 0.2, tex: grainF('pl', turb('.9', 1, 2), 0.1) + satin(0.5) },
  graphite: { base: [[0, '#55534E'], [0.5, '#3D3C38'], [1, '#2A2926']], rim: '#0C0B0A', hi: 0.32, lo: 0.4, tex: grainF('gr', turb('1.1', 1, 4), 0.28, 0.18) + satin(0.16) },
  piano: { base: [[0, '#2E2E33'], [0.45, '#121214'], [1, '#050506']], rim: '#000', hi: 0.5, lo: 0.4, tex: gloss(0.2) + satin(0.08) },
  carbon: {
    base: [[0, '#1D1E20'], [1, '#0B0B0C']], rim: '#000', hi: 0.4, lo: 0.5,
    tex: lin('ch', [[0, '#050505'], [0.5, '#3B3C40'], [1, '#050505']]) + lin('cv', [[0, '#050505'], [0.5, '#2A2B2E'], [1, '#050505']], 1, 0) +
      '<pattern id="cw" width="4.4" height="4.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="2.2" fill="url(#ch)"/><rect x="2.2" y="2.2" width="2.2" height="2.2" fill="url(#ch)"/><rect x="2.2" width="2.2" height="2.2" fill="url(#cv)"/><rect y="2.2" width="2.2" height="2.2" fill="url(#cv)"/></pattern>' +
      '<rect width="88" height="40" fill="url(#cw)" opacity=".85"/>' + gloss(0.14) + satin(0.1),
  },
  mint: { base: [[0, '#DDF4EA'], [0.5, '#B6E1CE'], [1, '#90C6AE']], rim: '#5A917C', hi: 0.9, lo: 0.25, tex: gloss(0.5) },
}

// ---- screens: base gradient, inner shadow strength, glass glare ----
const SCR: Record<'amber' | 'red' | 'vfd' | 'jet' | 'lcd', Screen> = {
  amber: { base: [[0, '#16130F'], [1, '#262119']], sh: 0.8, glare: 0.1 },
  red: { base: [[0, '#170504'], [1, '#2A0906']], sh: 0.8, glare: 0.11 },
  vfd: { base: [[0, '#020807'], [1, '#081614']], sh: 0.85, glare: 0.12 },
  jet: { base: [[0, '#020203'], [1, '#0C0C0E']], sh: 0.85, glare: 0.14 },
  lcd: { base: [[0, '#C6D1B1'], [1, '#AAB893']], sh: 0.45, glare: 0.18, edge: 0.45 },
}

// ---- time ----
function time(ms: number, fmt: '12' | '24'): Time {
  const d = new Date(ms), H = d.getHours(), m = d.getMinutes()
  const hr = fmt === '12' ? String(H % 12 || 12) : String(H).padStart(2, '0'), mm = String(m).padStart(2, '0')
  return { H, m, s: d.getSeconds(), pm: H >= 12, hr, mm, h1: hr.length > 1 ? hr[0]! : null, h2: hr.at(-1)!, m1: mm[0]!, m2: mm[1]! }
}
const digits = (t: Time) => [t.h1, t.h2, t.m1, t.m2]
// Four digit cells of width w, gaps sp and a colon gap cg, centred in the screen: each cell's x and the colon's.
const row = (w: number, sp: number, cg: number, extra = 0) => {
  const x0 = 44 - (4 * w + 2 * sp + cg + extra) / 2
  return { xs: [0, w + sp, 2 * w + sp + cg, 3 * w + 2 * sp + cg].map(x => x0 + x), cx: x0 + 2 * w + sp + cg / 2 }
}

// ---- seven segments, with real gaps and mitred ends ----
const SEG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }
type Seven = { w?: number; h?: number; th?: number; g?: number; sl?: number; sp?: number; cg?: number; cy?: number; dot?: number; c: string; gc?: string; op?: number; ghost?: number; glow?: Glow; lcd?: string; pm?: (t: Time) => string; over?: string }
function segs(w: number, h: number, t: number, g: number) {
  const k = t / 2, L = k, R = w - k, T = k, M = h / 2, B = h - k
  const H = (y: number) => [[L + g, y], [L + g + k, y - k], [R - g - k, y - k], [R - g, y], [R - g - k, y + k], [L + g + k, y + k]]
  const V = (x: number, a: number, b: number) => [[x, a + g], [x + k, a + g + k], [x + k, b - g - k], [x, b - g], [x - k, b - g - k], [x - k, a + g + k]]
  return { a: H(T), g: H(M), d: H(B), f: V(L, T, M), b: V(R, T, M), e: V(L, M, B), c: V(R, M, B) } as Record<string, number[][]>
}
const seg7 = (o: Seven) => (t: Time) => {
  const { w = 11, h = 19, th = 2.4, g = 0.3, sl = 0, sp = 3.6, cg = 7.5, cy = 20 } = o, s = Math.tan((sl * Math.PI) / 180)
  const S = segs(w, h, th, g), { xs, cx } = row(w, sp, cg, h * s), y0 = cy - h / 2
  const P = (x: number, y: number) => [r2(x + (h - y) * s), r2(y0 + y)]
  let lit = '', off = ''
  digits(t).forEach((n, i) => {
    for (const k in S) {
      const p = `<polygon points="${S[k]!.map(([x, y]) => P(x! + xs[i]!, y!).join(',')).join(' ')}"/>`
      if (n != null && SEG[n]!.includes(k)) lit += p
      else off += p
    }
  })
  const dots = [h * 0.3, h * 0.7].map(y => { const [X, Y] = P(cx, y); return `<circle cx="${X}" cy="${Y}" r="${o.dot ?? th * 0.55}"/>` }).join('')
  const colon = `<g>${dots}${BLINK}</g>`
  const ghost = `<g fill="${o.gc ?? o.c}" fill-opacity="${o.ghost ?? 0.08}">${off}${dots}</g>`
  const shadow = o.lcd ? `<g fill="#000" fill-opacity=".2" transform="translate(${o.lcd})">${lit}${colon}</g>` : ''
  const g1 = o.glow
  return (g1 ? glowF('lg', ...g1) : '') + ghost + shadow +
    `<g fill="${o.c}"${o.op ? ` fill-opacity="${o.op}"` : ''}${g1 ? ' filter="url(#lg)"' : ''}>${lit}${colon}${o.pm ? o.pm(t) : ''}</g>` + (o.over ?? '')
}

// ---- a 3 by 5 pixel font, each pixel a rounded square, with the unlit ones faintly showing ----
const F3: Record<string, string[]> = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
}
const pixel = (o: { pitch: number; size: number; rx: number; sp: number; cg: number; c: string; ghost: number; glow: Glow }) => (t: Time) => {
  const cw = 3 * o.pitch, { xs, cx } = row(cw - (o.pitch - o.size), o.sp, o.cg), y0 = 20 - (5 * o.pitch - (o.pitch - o.size)) / 2
  const cell = (x: number, y: number) => `<rect x="${r2(x)}" y="${r2(y)}" width="${o.size}" height="${o.size}" rx="${o.rx}"/>`
  let lit = '', off = ''
  digits(t).forEach((n, i) => F3['8']!.forEach((r, y) => [...r].forEach((_, c) => {
    const e = cell(xs[i]! + c * o.pitch, y0 + y * o.pitch)
    if (n != null && F3[n]![y]![c] === '#') lit += e
    else off += e
  })))
  const colon = [1, 3].map(r => cell(cx - o.size / 2, y0 + r * o.pitch)).join('')
  return glowF('lg', ...o.glow) + `<g fill="${o.c}" fill-opacity="${o.ghost}">${off}${colon}</g><g fill="${o.c}" filter="url(#lg)">${lit}<g>${colon}${BLINK}</g></g>`
}

// ---- hand-drawn single-stroke figures in a 10 by 16 box ----
const G: Record<string, string> = {
  0: 'M5 0C2.2 0 .6 3 .6 8S2.2 16 5 16 9.4 13 9.4 8 7.8 0 5 0Z',
  1: 'M2.6 3 6 0V16',
  2: 'M.9 3.8C1.2 1.4 2.9 0 5.1 0 7.6 0 9.2 1.7 9.2 4.1 9.2 6.2 8 7.6 6 9.4L.7 16H9.4',
  3: 'M1 0H9L4.7 6.2C7.6 6 9.4 7.9 9.4 10.8 9.4 14 7.4 16 4.8 16 2.9 16 1.4 15.1.6 13.6',
  4: 'M7.2 16V0L.5 10.8H9.5',
  5: 'M8.9 0H2L1.2 6.9C2.2 6.1 3.5 5.7 4.8 5.7 7.6 5.7 9.4 7.7 9.4 10.7 9.4 14 7.3 16 4.7 16 2.8 16 1.3 15.1.6 13.6',
  6: 'M8.2.9C7.4.3 6.4 0 5.4 0 2.6 0 .6 2.9.6 8.6.6 13.2 2.2 16 5.1 16 7.7 16 9.4 14 9.4 11.1 9.4 8.2 7.7 6.3 5.1 6.3 3 6.3 1.3 7.6.7 9.7',
  7: 'M.6 0H9.4L3.6 16',
  8: 'M5 7.3C2.9 7.3 1.3 6 1.3 3.7 1.3 1.4 2.9 0 5 0S8.7 1.4 8.7 3.7 7.1 7.3 5 7.3C2.4 7.3.6 9 .6 11.6S2.4 16 5 16 9.4 14.2 9.4 11.6 7.6 7.3 5 7.3Z',
  9: 'M1.8 15.1C2.6 15.7 3.6 16 4.6 16 7.4 16 9.4 13.1 9.4 7.4 9.4 2.8 7.8 0 4.9 0 2.3 0 .6 2 .6 4.9.6 7.8 2.3 9.7 4.9 9.7 7 9.7 8.7 8.4 9.3 6.3',
}
const figure = (n: string | null, x: number, y: number, sc: number) => (n == null ? '' : `<path transform="translate(${r2(x)} ${r2(y)}) scale(${sc})" d="${G[n]}"/>`)
const thin = (o: { sc: number; sp: number; cg: number; sw: number; cy: number; c: string; cc: string; dot: number; glow: Glow; over: (t: Time) => string }) => (t: Time) => {
  // with no leading hour digit, the figures are centred as they stand
  const w = 10 * o.sc, h = 16 * o.sc, { xs, cx } = row(w, o.sp, o.cg), y0 = o.cy - h / 2, sh = t.h1 == null ? (w + o.sp) / 2 : 0
  const body = digits(t).map((n, i) => figure(n, xs[i]! - sh, y0, o.sc)).join('')
  const dots = [0.32, 0.74].map(f => `<circle cx="${r2(cx - sh)}" cy="${r2(y0 + f * h)}" r="${o.dot}"/>`).join('')
  return glowF('lg', ...o.glow) +
    `<g filter="url(#lg)"><g fill="none" stroke="${o.c}" stroke-width="${r2(o.sw / o.sc)}" stroke-linecap="round" stroke-linejoin="round">${body}</g><g fill="${o.cc}">${dots}${BLINK}</g></g>` + o.over(t)
}

// ---- small extras inside a screen: a PM mark in the pixel font, a bar that fills over the minute, a fine mesh ----
const PM = { P: ['###', '#.#', '###', '#..', '#..'], M: ['#.#', '###', '###', '#.#', '#.#'] } as Record<string, string[]>
const pmMark = (x: number, y: number, c: string, dim: number) => (t: Time) => {
  const px = 0.62
  const rects = [...'PM'].map((ch, i) => PM[ch]!.map((r, yy) => [...r].map((cell, xx) => (cell === '#' ? `<rect x="${r2(x + (i * 4 + xx) * px)}" y="${r2(y - 3.1 + yy * px)}" width="${px}" height="${px}"/>` : '')).join('')).join('')).join('')
  return `<g fill="${c}" fill-opacity="${t.pm ? 1 : dim}" shape-rendering="crispEdges">${rects}</g>`
}
// Its start is left to settle(), which times every loop to the steady clock.
const secBar = (c: string) => () =>
  `<rect x="18" y="31" width="52" height=".7" rx=".35" fill="#fff" fill-opacity=".1"/>` +
  `<rect x="18" y="31" width="0" height=".7" rx=".35" fill="${c}"><animate attributeName="width" values="0;52" dur="60s" repeatCount="indefinite"/></rect>`
const MESH = '<pattern id="vm" width="1.1" height="1.1" patternUnits="userSpaceOnUse"><path d="M0 .05H1.1M.05 0V1.1" stroke="#000" stroke-width=".22" stroke-opacity=".55"/></pattern><rect x="5" y="5" width="78" height="30" fill="url(#vm)"/>'

// ---- the five looks ----
export type ClockLook = 'lcd' | 'desk' | 'carbon' | 'vfd' | 'bedside'
const LOOKS: Record<ClockLook, Look> = {
  // mint enamel and a reflective LCD
  lcd: { mat: MAT.mint, scr: SCR.lcd, fmt: '12', draw: seg7({ w: 11, h: 19, th: 2.5, sl: 4, c: '#18210F', op: 0.88, ghost: 0.06, lcd: '.55 .8', pm: pmMark(8.6, 9.6, '#18210F', 0) }) },
  // cream plastic and amber pixels on a dark LCD
  desk: { mat: MAT.cream, scr: SCR.amber, fmt: '24', draw: pixel({ pitch: 4, size: 3.45, rx: 0.45, sp: 4, cg: 9, c: '#F6AC60', ghost: 0.08, glow: ['#FF8A2A', 0.7, 0.9, 2, 0.6] }) },
  // carbon fibre and thin white figures with a seconds bar
  carbon: { mat: MAT.carbon, scr: SCR.jet, fmt: '24', draw: thin({ sc: 1.06, sp: 3.6, cg: 7, sw: 1.25, cy: 19, c: '#F4F7FA', cc: '#FF3B30', dot: 0.85, glow: ['#BFD8FF', 0.5, 0.7, 1.6, 0.35], over: secBar('#FF3B30') }) },
  // piano black and teal vacuum-fluorescent digits
  vfd: { mat: MAT.piano, scr: SCR.vfd, fmt: '12', draw: seg7({ w: 11, h: 18.5, th: 2.1, g: 0.35, sl: 5, cy: 20.8, c: '#7CFBE4', gc: '#58B9AA', ghost: 0.16, glow: ['#22E3C2', 0.6, 1.2, 2.2, 0.8], pm: pmMark(8.5, 9.6, '#7CFBE4', 0.15), over: MESH }) },
  // graphite and red slanted seven-segment: the bedside clock
  bedside: { mat: MAT.graphite, scr: SCR.red, fmt: '12', draw: seg7({ w: 11.2, h: 20, th: 2.6, sl: 8, c: '#FF4A30', gc: '#FF2A14', ghost: 0.1, glow: ['#FF1E0A', 0.6, 1.1, 2, 0.75], pm: t => (t.pm ? '<circle cx="9.6" cy="9.3" r=".9"/>' : '') }) },
}

// The look for each of the day's eight periods, then the night's.
export const STAGE_LOOKS: ClockLook[] = ['lcd', 'desk', 'desk', 'desk', 'desk', 'desk', 'carbon', 'vfd', 'bedside']

// The look at `ms`: its period's, or the night's.
export function lookAt(ms: number): ClockLook {
  const period = periodAt(ms)
  return STAGE_LOOKS[period ? DAY_PERIODS.indexOf(period) : STAGE_LOOKS.length - 1]!
}

// The time `shown`, drawn in the look of the stage `now` falls in.
export function clockSvg(shown: number, now = shown): { source: string; width: number; height: number; look: ClockLook } {
  const look = lookAt(now), { mat: m, scr: s, fmt, draw } = LOOKS[look]
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 40" width="88" height="40"><defs>' +
    lin('bd', m.base) + lin('bv', [[0, '#fff', m.hi], [0.3, '#fff', 0], [0.7, '#000', 0], [1, '#000', m.lo]]) +
    lin('rc', [[0, '#000', 0.5], [0.45, '#000', 0], [0.55, '#fff', 0], [1, '#fff', 0.45]]) + lin('sf', s.base) +
    lin('gl', [[0, '#fff', s.glare], [1, '#fff', s.glare * 0.15]]) +
    `<clipPath id="bc"><rect ${BODY}/></clipPath><clipPath id="sc"><rect ${SCREEN}/></clipPath>` +
    `<filter id="is" x="0" y="0" width="88" height="40" ${FU}><feGaussianBlur stdDeviation=".9"/></filter></defs>` +
    `<rect ${BODY} fill="url(#bd)"/>` + (m.tex ? `<g clip-path="url(#bc)">${m.tex}</g>` : '') +
    '<rect x="1.25" y="1.25" width="85.5" height="37.5" rx="7.25" fill="none" stroke="url(#bv)" stroke-width="1.5"/>' +
    `<rect ${BODY} fill="none" stroke="${m.rim}"/>` +
    `<path d="${RING}" fill="url(#rc)" fill-rule="evenodd"/><rect ${SCREEN} fill="url(#sf)"/>` +
    `<g clip-path="url(#sc)">${draw(time(shown, fmt))}` +
    `<rect ${SCREEN} fill="none" stroke="#000" stroke-opacity="${s.sh}" stroke-width="3" filter="url(#is)" transform="translate(0 .8)"/>` +
    '<path d="M5 5H83V14.6C62 12.2 28 12.6 5 17.2Z" fill="url(#gl)"/></g>' +
    `<rect ${SCREEN} fill="none" stroke="#000" stroke-opacity="${s.edge ?? 0.6}" stroke-width=".5"/></svg>`
  return { source, width: 88, height: 40, look }
}
