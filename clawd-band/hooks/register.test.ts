import { FORMS } from './clawd-frames'
import { fade, forceDark, isNight, statsSvg } from './design'
import { expect, mock, test } from 'claude-code/testing'

// Clawd's tests run only where its artwork has been generated (see tools/gen.py).
const withClawd: typeof test = FORMS.Idle ? test : ((() => {}) as any)
const withoutClawd: typeof test = FORMS.Idle ? ((() => {}) as any) : test

const pass = () => ({ type: 'Box', props: {}, children: [] }) as any

const band = (surface: 'desktop' | 'terminal') =>
  ({
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    props: { hasSurvey: false, maxRows: 10, bodyColumns: 80 },
  }) as any

withClawd('desktop: Clawd stands still when idle', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const [left, right] = tree.children
  const clawd = right.children[right.children.length - 1].children[0]
  expect(clawd.props.alt).toBe('Clawd: Idle')
  expect(clawd.props.source).not.toContain('<animate')
  expect(left.children[0].props.alt).toBe('Clock')
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

test('desktop: idle shows the Idle status', async ($, on) => {
  on('ui.render', pass)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Status: Idle')
})

withClawd('desktop: Clawd is as tall as the chips', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const right = tree.children[1]
  const clawd = right.children[right.children.length - 1].children[0]
  expect(clawd.props.height).toBe(40)
})

test('desktop: the clock sits in a desk-clock casing', async ($, on) => {
  on('ui.render', pass)
  const tree: any = await $.ui.render(band('desktop'))
  const clock = tree.children[0].children[0]
  expect(clock.props.height).toBe(40)
  expect(clock.props.source).toContain('cb-case')
})

test('stats: the session chip and the bars do not overlap', async () => {
  const svg = statsSvg({ cost: '$1.00', limit: 50, state: 'Idle', working: false, cacheMinutes: null }).source
  const xs = [...svg.matchAll(/<text class="label" x="([\d.]+)"/g)].map(m => Number(m[1]))
  expect(new Set(xs).size).toBeGreaterThan(1)
})

withClawd('desktop: a form change keeps the earlier form mounted, hidden', async ($, on) => {
  let tree: any
  on('ui.render', pass)
  on('tool.call', async () => {
    tree = await $.ui.render(band('desktop'))
    return { result: 'ok', text: 'ok' } as any
  })
  await $.tool.call({ tool: 'Edit', file_path: 'a.txt', old_string: 'a', new_string: 'b' } as any)
  const forms = tree.children[1].children.filter((c: any) => String(c.key ?? c.props?.key ?? '').startsWith('clawd-'))
  const shown = forms.filter((b: any) => b.props.display === 'flex').map((b: any) => b.children[0].props.alt)
  expect(forms.length).toBeGreaterThan(1)
  expect(shown).toEqual(['Clawd: Typing'])
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
  const svg = statsSvg({ state: 'Thinking', working: true, elapsed: 42, cacheMinutes: 30 }).source
  expect(svg).toContain('<g opacity=".4">')
  expect(svg).toContain('>30m<')
  expect(svg).toContain('class="tick"')
  const idle = statsSvg({ state: 'Idle', working: false, cacheMinutes: 30 }).source
  expect(idle).not.toContain('<g opacity=".4">')
  expect(idle).not.toContain('class="tick"')
})

test('stats: the cache chills near the end, freezes at none, and /keepwarm glows or thaws', async () => {
  const at = (cacheMinutes: number, warm?: any) => statsSvg({ state: 'Idle', working: false, cacheMinutes, warm }).source
  const warm = at(45)
  expect(warm).not.toContain('filter="url(#cb-rime)"')
  expect(warm.indexOf('>CACHE<')).toBeLessThan(warm.indexOf('>STATUS<'))
  expect(at(6)).toContain('filter="url(#cb-rime)"')
  // More ice the closer it gets to cold.
  const level = (m: number) => Number(/filter="url\(#cb-rime\)" opacity="([\d.]+)"/.exec(at(m))![1])
  expect(level(2)).toBeGreaterThan(level(9))
  expect(at(0)).toContain('filter="url(#cb-rime)"')
  const glow = at(60, { kind: 'glow', ago: 0.5 })
  expect(glow).toContain('filter="url(#cb-flicker)"')
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
  const dark = forceDark(statsSvg({ state: 'Idle', working: false, cacheMinutes: null }).source)
  expect(dark).toContain('@media all')
  expect(dark).not.toContain('prefers-color-scheme')
})

test('night: dimming fades in once, then holds', async () => {
  const svg = '<svg xmlns="x" width="1"><rect/></svg>'
  expect(fade(svg, 1, 0.6, 0.2)).toContain('<animate attributeName="opacity" values="1;0.6"')
  expect(fade(svg, 1, 0.6, 5)).toBe('<svg opacity="0.6" xmlns="x" width="1"><rect/></svg>')
  expect(fade(svg, 0.6, 1, 5)).toBe(svg)
})
