import { FORMS } from './clawd-frames'
import { DAY_PERIODS, crossfade, fade, forceDark, isNight, periodAt, statsSvg, statusSvg } from './design'
import { expect, mock, test } from 'claude-code/testing'

// Clawd's tests run only where its artwork has been generated (see tools/gen.py).
const withClawd: typeof test = FORMS.Idle ? test : ((() => {}) as any)
const withoutClawd: typeof test = FORMS.Idle ? ((() => {}) as any) : test

const pass = () => ({ type: 'Box', props: {}, children: [] }) as any

const band = (surface: 'desktop' | 'terminal', bodyColumns = 200) =>
  ({
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    props: { hasSurvey: false, maxRows: 10, bodyColumns },
  }) as any

// The band's own row.
const row = (tree: any) => tree

withClawd('desktop: Clawd idles on one looping drawing, and holds still asleep', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const [left, around] = row(tree).children
  const right = around.children[0]
  const clawd = right.children[right.children.length - 1]
  expect(clawd.props.alt).toBe('Clawd: Idle')
  expect(left.children[0].children[0].props.alt).toBe('Clock')
  // He looks around inside the drawing, so idling never swaps it.
  expect(FORMS.Idle).toContain('repeatCount="indefinite"')
  expect(FORMS.Still).not.toContain('<animate')
})

withClawd('desktop: a run of quick tools keeps one form', async ($, on) => {
  const seen: string[] = []
  on('ui.render', pass)
  on('tool.call', async () => {
    seen.push(/Clawd: (\w+)/.exec(JSON.stringify(await $.ui.render(band('desktop'))))![1]!)
    return { result: 'ok', text: 'ok' } as any
  })
  for (let i = 0; i < 4; i++) await $.tool.call({ tool: 'Read', file_path: 'a.txt' } as any)
  expect(new Set(seen).size).toBe(1)
})

withClawd('desktop: an Edit call plays Typing while it runs', async ($, on) => {
  let during = ''
  on('ui.render', pass)
  on('tool.call', async () => {
    during = JSON.stringify(await $.ui.render(band('desktop')))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'a.txt', old_string: 'a', new_string: 'b' } as any)
  expect(during).toContain('Clawd: Typing')
})

withClawd('desktop: a failed Bash call plays Oops', async ($, on) => {
  on('ui.render', pass)
  on('tool.call', () => ({ result: 'boom', text: 'boom', isError: true }) as any)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Clawd: Oops')
})

test('terminal: block Clawd above the prompt', async ($, on) => {
  on('ui.render', pass)
  expect(JSON.stringify(await $.ui.render(band('terminal')))).toContain('▝▜█████▛▘')
})

test('desktop: an Edit call shows the Editing status', async ($, on) => {
  let during = ''
  on('ui.render', pass)
  on('tool.call', async () => {
    during = JSON.stringify(await $.ui.render(band('desktop')))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'src/app/main.ts', old_string: 'a', new_string: 'b' } as any)
  expect(during).toContain('Status: Editing')
})

test("desktop: idle shows the period's own word, or Sleeping at night", async ($, on) => {
  on('ui.render', pass)
  const word = periodAt(Date.now())?.idle ?? 'Sleeping'
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain(`Status: ${word}`)
  expect(DAY_PERIODS.map(p => p.idle)).toEqual(['Stirring', 'Brewing', 'Ready', 'Lunching', 'Lounging', 'Basking', 'Unwinding', 'Drowsy'])
})

withClawd('desktop: Clawd is as tall as the chips', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const right = row(tree).children[1].children[0]
  const clawd = right.children[right.children.length - 1]
  expect(clawd.props.height).toBe(40)
})

test('desktop: the clock sits in a desk-clock casing', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const clock = row(tree).children[0].children[0].children[0]
  expect(clock.props.height).toBe(40)
  expect(clock.props.source).toContain('cb-case')
})

test('stats: the session chip and the bars do not overlap', async () => {
  const svg = statsSvg({ cost: '$1.00', limit: 50, working: false, cacheMinutes: null }).source
  const xs = [...svg.matchAll(/<text class="label" x="([\d.]+)"/g)].map(m => Number(m[1]))
  expect(new Set(xs).size).toBeGreaterThan(1)
})

withClawd('desktop: only the current form is mounted', async ($, on) => {
  let tree: any
  on('ui.render', pass)
  on('tool.call', async () => {
    tree = await $.ui.render(band('desktop'))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'a.txt', old_string: 'a', new_string: 'b' } as any)
  const forms = JSON.stringify(tree).match(/Clawd: \w+/g)
  expect(forms).toEqual(['Clawd: Typing'])
})

test('desktop: plan updates and memory writes get their own statuses', async ($, on) => {
  const seen: string[] = []
  on('ui.render', pass)
  on('tool.call', async () => {
    seen.push(JSON.stringify(await $.ui.render(band('desktop'))))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'TodoWrite', todos: [] } as any)
  await $.tool.call({ tool: 'Write', file_path: 'C:\\Users\\x\\memory\\a.md', content: 'x' } as any)
  expect(seen[0]).toContain('Status: Planning')
  expect(seen[1]).toContain('Status: Remembering')
})

test('stats: while working, the cache greys out and the status carries the turn time', async () => {
  const svg = statsSvg({ working: true, cacheMinutes: 30 }).source
  expect(svg).toContain('<g opacity=".4">')
  expect(svg).toContain('>30m<')
  expect(statusSvg('Thinking', true, 42).source).toContain('class="tick"')
  expect(statsSvg({ working: false, cacheMinutes: 30 }).source).not.toContain('<g opacity=".4">')
  expect(statusSvg('Idle', false).source).not.toContain('class="tick"')
})

test('desktop: the status is its own drawing, so a new word leaves the stats as they were', async ($, on) => {
  const stats: string[] = []
  on('ui.render', pass)
  on('tool.call', async () => {
    const left = row(await $.ui.render(band('desktop'))).children[0]
    stats.push(left.children[1].children[0].props.source)
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'a.txt', old_string: 'a', new_string: 'b' } as any)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
  expect(stats[0]).toBe(stats[1])
})

test('stats: the cache chills near the end, freezes at none, and /keepwarm glows or thaws', async () => {
  const at = (cacheMinutes: number, warm?: any) => statsSvg({ working: false, cacheMinutes, warm }).source
  const warm = at(45)
  expect(warm).not.toContain('filter="url(#cb-rime)"')
  expect(at(6)).toContain('filter="url(#cb-rime)"')
  // More ice the closer it gets to cold.
  const level = (m: number) => Number(/filter="url\(#cb-rime\)" opacity="([\d.]+)"/.exec(at(m))![1])
  expect(level(2)).toBeGreaterThan(level(9))
  expect(at(0)).toContain('filter="url(#cb-rime)"')
  const glow = at(60, { kind: 'glow', ago: 0.5 })
  expect(glow).toContain('url(#cb-flicker)')
  expect(glow).not.toContain('filter="url(#cb-rime)"')
  expect(at(60, { kind: 'thaw', ago: 0.5 })).toContain('filter="url(#cb-rime)"')
})

test('desktop: a resumed session opens with the last limits it saw, not blanks', async ($, on) => {
  mock.store(on, { limits: { limit: 40, week: 9 } })
  on('ui.render', pass)
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register' as any, async () => ({ value: undefined }) as any)
  on('session.usage' as any, async () => ({ value: { startedAt: 1, context: { window: 1000000 }, rateLimits: [] } }) as any)
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as any)
  const json = JSON.stringify(await $.ui.render(band('desktop')))
  expect(json).toContain('>5H<')
  expect(json).toContain('>40%<')
  expect(json).toContain('>9%<')
})

withoutClawd('desktop: without the Clawd artwork the bar still draws, with no Clawd', async ($, on) => {
  on('ui.render', pass)
  const json = JSON.stringify(await $.ui.render(band('desktop')))
  expect(json).toContain('Session stats')
  expect(json).not.toContain('Clawd:')
})

test('night: 23:15 to 05:30, and its drawings go dark whatever the scheme', async () => {
  const at = (h: number, m: number) => new Date(2026, 0, 1, h, m).getTime()
  expect(isNight(at(23, 14))).toBe(false)
  expect(isNight(at(23, 15))).toBe(true)
  expect(isNight(at(3, 0))).toBe(true)
  expect(isNight(at(5, 29))).toBe(true)
  expect(isNight(at(5, 30))).toBe(false)
  const dark = forceDark(statsSvg({ working: false, cacheMinutes: null }).source)
  expect(dark).toContain('@media all')
  expect(dark).not.toContain('prefers-color-scheme')
})

test('night: dimming fades in once, then holds', async () => {
  const svg = '<svg xmlns="x" width="1"><rect/></svg>'
  expect(fade(svg, 1, 0.6, 0.2)).toContain('<animate attributeName="opacity" values="1;0.6"')
  expect(fade(svg, 1, 0.6, 5)).toBe('<svg opacity="0.6" xmlns="x" width="1"><rect/></svg>')
  expect(fade(svg, 0.6, 1, 5)).toBe(svg)
})

test('desktop: CTX shows before the first reply, estimated from the breakdown', async ($, on) => {
  mock.store(on, {})
  on('ui.render', pass)
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register' as any, async () => ({ value: undefined }) as any)
  const breakdown = { rawMaxTokens: 200000, categories: [{ name: 'System prompt', kind: 'used', tokens: 20000 }] }
  on('session.usage' as any, async () => ({ value: { startedAt: 1, context: { window: 1000000, breakdown }, rateLimits: [] } }) as any)
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as any)
  await new Promise(r => setTimeout(r, 50))
  const json = JSON.stringify(await $.ui.render(band('desktop')))
  expect(json).toContain('>CTX<')
})

// The cold-send guard, against a mocked model and context.
const guardSetup = (on: any, tokens = 100000, store: any = {}) => {
  mock.store(on, store)
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register' as any, async () => ({ value: undefined }) as any)
  on('ui.render', pass)
  on('session.model' as any, async () => ({ value: 'claude-opus-5-5' }) as any)
  on('session.usage' as any, async () => ({ value: { startedAt: 1, context: { window: 1000000, tokens }, rateLimits: [] } }) as any)
}

test('guard: a cold send is stopped once with its price, the resend goes through', async ($, on) => {
  // The session resumes with its last reply two hours ago.
  guardSetup(on, 100000, { 's:1': { lastReply: Date.now() - 2 * 60 * 60 * 1000 } })
  on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as any)
  const first: any = await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as any)
  expect(first.drop).toContain('re-writes about 100k tokens for $0.80')
  const second: any = await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as any)
  expect(second.drop).toBeUndefined()
})

test('stats: usage is read mid-turn, not only when the turn ends', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, {})
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  on('command.register' as any, async () => ({ value: undefined }) as any)
  on('ui.render', pass)
  on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
  let usd = 1
  on('session.usage' as any, async () => ({ value: { startedAt: 1, context: { window: 1000000 }, rateLimits: [], cost: { usd } } }) as any)
  await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as any)
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as any)
  await $.ui.render(band('desktop'))
  usd = 4.2
  await clock.advance(2000)
  const json = JSON.stringify(await $.ui.render(band('desktop')))
  // The cost rolls from $1.00 to $4.20: its 1 on up to 4.
  expect(json).toContain('4</tspan>')
  expect(json).toContain('keySplines')
})

// A turn ends with the cache back at 60m: CACHE glows, or thaws when it was chilling.
for (const [ago, kind] of [[30, 'glow'], [55, 'thaw']] as const) {
  test(`stats: a turn's end ${kind}s CACHE when it began ${ago}m after the last reply`, async ($, on) => {
    guardSetup(on, 1000, { 's:1': { lastReply: Date.now() - ago * 60000 } })
    on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))
    mock.clock(on)
    on('turn.complete' as any, async () => ({ text: '' }))
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as any)
    await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as any)
    await ($ as any).turn.complete({ answer: 'ok', turnId: 't', reason: 'answer', isAborted: false, durationMs: 1000 })
    const json = JSON.stringify(await $.ui.render(band('desktop')))
    expect(json).toContain('url(#cb-flicker)')
    expect(json.includes('filter=\\"url(#cb-rime)\\"')).toBe(kind === 'thaw')
  })
}

test('desktop: a narrowing band leaves out the status, then HIT, TOK/S, CACHE, SESSION and the limits', async ($, on) => {
  on('ui.render', pass)
  const order: string[] = []
  let faded = false
  for (let columns = 200; columns >= 10; columns -= 2) {
    const drawn = JSON.stringify(await $.ui.render(band('desktop', columns)))
    if (drawn.includes('1;0;0')) faded = true
    // A piece just left out is still fading away; what counts is what stays.
    const json = drawn.replace(/<g opacity=\\"0\\">.*?<\/g>/g, '')
    // The sky and Clawd stay whatever the width.
    expect(json).toContain('Clawd:')
    for (const [name, mark] of [['status', '>STATUS<'], ['hit', '>HIT<'], ['tps', '>TOK/S<'], ['cache', '>CACHE<'], ['session', '>SESSION<'], ['limits', '>5H<']]) {
      if (!json.includes(mark!) && !order.includes(name!)) order.push(name!)
    }
  }
  expect(order).toEqual(['status', 'hit', 'tps', 'cache', 'session', 'limits'])
  // Each piece fades out as it goes, rather than popping.
  expect(faded).toBe(true)
})

test('stats: a changed number rolls, a changed word fades; the rest stays put', async () => {
  const a = statsSvg({ working: false, cacheMinutes: 45, cost: '$1.00' }).source
  const b = statsSvg({ working: false, cacheMinutes: 45, cost: '$2.00' }).source
  expect(crossfade(a, a)).toBe(a)
  const rolled = crossfade(a, b)
  // Only the cost's first digit rolls, one step up: 1 then 2, the rest of $1.00 holding still.
  expect(rolled.match(/attributeName="y"/g)!.length).toBe(2)
  expect(rolled).not.toContain('values="1;0;0"')
  const nine = statsSvg({ working: false, cacheMinutes: 45, cost: '$0.59' }).source
  const sixty = crossfade(nine, statsSvg({ working: false, cacheMinutes: 45, cost: '$0.60' }).source)
  // 59 rolls on into 60: the 5 to 6, and the 9 through to 0.
  expect(sixty.match(/attributeName="y"/g)!.length).toBe(4)
  // A bar eases from its old length to the new one: the fill and its sheen.
  const low = statsSvg({ working: false, cacheMinutes: 45, limit: 20 }).source
  const filled = crossfade(low, statsSvg({ working: false, cacheMinutes: 45, limit: 60 }).source)
  expect(filled.match(/attributeName="width"/g)!.length).toBe(2)
  expect(crossfade(statusSvg('Reading', true).source, statusSvg('Editing', true).source)).toContain('values="0;0;1"')
})
