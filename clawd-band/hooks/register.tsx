import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import type { Part } from '../types'

import { DURATION_MS, FORMS, HEIGHT, WIDTH } from './clawd-frames'
import { BAR_HEIGHT, ICE_MINUTES, NIGHT_BG, SLEEP_W, WARM_S, fade, forceDark, forceLight, isNight, periodAt, sleepSvg, statsSvg } from './design'
import { clockSvg, clockText, costText, sleepyClock } from './pixel-clock'

// While idle, Clawd stands still and looks around once every this many milliseconds.
const IDLE_LOOK_MS = 45000
// A turn longer than this ends with a breakdance instead of a hop.
const BIG_TURN_MS = 60000
// How long the prompt cache stays warm after a reply (an hour on a subscription).
const CACHE_TTL_MS = 60 * 60 * 1000

const form = atom({ plugin: 'clawd-band', key: 'form' } as const, 'Idle')
// When the shown minute began being shown; the clock's markup is built from it alone.
const time = atom({ plugin: 'clawd-band', key: 'time' } as const, 0)
const cost = atom({ plugin: 'clawd-band', key: 'cost' } as const, '')
const doing = atom({ plugin: 'clawd-band', key: 'doing' } as const, '')
const limit = atom({ plugin: 'clawd-band', key: 'limit' } as const, -1)
const week = atom({ plugin: 'clawd-band', key: 'week' } as const, -1)
const context = atom({ plugin: 'clawd-band', key: 'context' } as const, -1)
const parts = atom({ plugin: 'clawd-band', key: 'parts' } as const, [] as Part[])
const hit = atom({ plugin: 'clawd-band', key: 'hit' } as const, -1)
const tps = atom({ plugin: 'clawd-band', key: 'tps' } as const, -1)
const lastReply = atom({ plugin: 'clawd-band', key: 'lastReply' } as const, 0)
const turnStart = atom({ plugin: 'clawd-band', key: 'turnStart' } as const, 0)
// When /keepwarm last warmed the cache; its effect plays for WARM_S seconds from then.
const warmed = atom({ plugin: 'clawd-band', key: 'warmed' } as const, 0)
// Which effect that /keepwarm plays: a fire glow when the cache was fine, a thaw when it was chilling.
const warmKind = atom({ plugin: 'clawd-band', key: 'warmKind' } as const, 'glow' as 'glow' | 'thaw')

// Clawd scaled to the chips' height so the row lines up.
const CLAWD_W = (WIDTH * BAR_HEIGHT) / HEIGHT

// The context bar's colours, by /context's row names; any other used row is grey.
const PART_COLOR: Record<string, string> = {
  Messages: '#4A7FE0',
  'System tools': '#E46F3A',
  'MCP tools': '#2FA36B',
}
const OTHER = '#8F8E87'
const BUFFER = '#C9C7BF'

const TEXT = [' ▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝']

// Which form a tool call plays, by tool name.
const toolForm = (tool: string): string => {
  if (/^(Edit|Write|NotebookEdit)$/.test(tool)) return 'Typing'
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) return 'Computer'
  if (/^(Read|Grep|Glob)$/.test(tool)) return 'Searching'
  if (/^(WebSearch|WebFetch)$/.test(tool) || /Browser|chrome/i.test(tool)) return 'Fetching'
  if (/^(Agent|SendMessage)$/.test(tool) || /start_session/.test(tool)) return 'Delegating'
  if (tool === 'AskUserQuestion') return 'Asking'
  if (tool === 'Skill') return 'Skill'
  return 'Busy'
}

const short = (text: string, max = 28) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const base = (path: string) => path.split(/[\\/]/).pop() ?? path

// What a tool call is doing, as "Verb|target".
const toolLabel = (tool: string, input: Record<string, unknown>): string => {
  const str = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '')
  const path = str('file_path')
  if ((tool === 'Edit' || tool === 'Write') && /[\\/]memory[\\/]/.test(path)) return `Remembering|${base(path)}`
  if (/update_plan$/.test(tool) || /^(TodoWrite|EnterPlanMode|ExitPlanMode)$/.test(tool)) return 'Planning|'
  if (/wrap_up$/.test(tool)) return 'Wrapping up|'
  if (/start_session$|hand_off_to_session$/.test(tool)) return 'Spawning|a session'
  if (/Browser|chrome/i.test(tool)) return 'Browsing|'
  if (/^Artifact/.test(tool)) return 'Publishing|'
  if (/^(CronCreate|CronDelete|ScheduleWakeup)$/.test(tool) || /scheduled.tasks/.test(tool)) return 'Scheduling|'
  if (tool === 'SendMessage' || /send_message$/.test(tool)) return 'Messaging|'
  if (tool === 'Monitor') return 'Watching|'
  if (tool === 'ToolSearch') return 'Loading tools|'
  if (tool === 'Edit' || tool === 'NotebookEdit') return `Editing|${base(str('file_path') || str('notebook_path'))}`
  if (tool === 'Write') return `Writing|${base(str('file_path'))}`
  if (tool === 'Read') return `Reading|${base(str('file_path'))}`
  if (tool === 'Bash' || tool === 'PowerShell') return `Running|${short(str('command').split('\n')[0], 26)}`
  if (tool === 'Grep') return `Searching|${short(str('pattern'), 24)}`
  if (tool === 'Glob') return `Finding|${short(str('pattern'), 24)}`
  if (tool === 'WebSearch') return `Searching|${short(str('query'), 24)}`
  if (tool === 'WebFetch') return `Fetching|${short(str('url').replace(/^https?:\/\//, ''), 26)}`
  if (tool === 'Agent') return `Delegating|${short(str('description'), 24)}`
  if (tool === 'AskUserQuestion') return 'Asking|you a question'
  if (tool === 'Skill') return `Using|${str('skill')}`
  return `Using|${short(tool.replace(/^mcp__[^_]+__/, ''), 26)}`
}

let isWorking = false
let tools = 0
// Stats measured during a turn, shown once it ends: each change reloads the stats drawing and
// its fonts, which flickers if it happens mid-turn.
let pending: { cost?: string; limit?: number; week?: number; context?: number; hit?: number; tps?: number } = {}
// Mid-turn, stats still show up this often at most, which keeps the redraw flicker down.
const LIVE_MS = 4000
let lastFlush = 0
// Whether Clawd was asleep at the last drawing, and when that last changed, so the dimming fades.
let wasAsleep: boolean | undefined
let sleepChangedAt = 0

// This session's key in the store: its first launch, which stays the same when it is resumed.
let sessionKey = ''

type Saved = { lastReply?: number; hit?: number; tps?: number }

// Keeps what only a reply can tell, so a resumed session opens with it instead of blanks: this
// session's last reply and speed, and the account's limits.
async function save($: Engine) {
  const [l, w] = [await read($, limit), await read($, week)]
  if (l >= 0 || w >= 0) await $.store.set('limits', { limit: l, week: w })
  if (!sessionKey) return
  const saved: Saved = { lastReply: await read($, lastReply), hit: await read($, hit), tps: await read($, tps) }
  await $.store.set(sessionKey, saved)
}

async function restore($: Engine, startedAt: number) {
  sessionKey = `s:${startedAt}`
  const limits = (await $.store.get('limits')) as { limit?: number; week?: number } | undefined
  if (limits?.limit !== undefined && (await read($, limit)) < 0) await update($, limit, () => limits.limit!)
  if (limits?.week !== undefined && (await read($, week)) < 0) await update($, week, () => limits.week!)
  const saved = (await $.store.get(sessionKey)) as Saved | undefined
  if (saved?.lastReply && !(await read($, lastReply))) await update($, lastReply, () => saved.lastReply!)
  if (saved?.hit !== undefined && (await read($, hit)) < 0) await update($, hit, () => saved.hit!)
  if (saved?.tps !== undefined && (await read($, tps)) < 0) await update($, tps, () => saved.tps!)
}

async function flushStats($: Engine) {
  lastFlush = Date.now()
  const { cost: c, limit: l, week: w, context: x } = pending
  if (c !== undefined && (await read($, cost)) !== c) await update($, cost, () => c)
  if (l !== undefined && (await read($, limit)) !== l) await update($, limit, () => l)
  if (w !== undefined && (await read($, week)) !== w) await update($, week, () => w)
  if (x !== undefined && (await read($, context)) !== x) await update($, context, () => x)
  const { hit: h, tps: t } = pending
  if (h !== undefined && (await read($, hit)) !== h) await update($, hit, () => h)
  if (t !== undefined && (await read($, tps)) !== t) await update($, tps, () => t)
  pending = {}
  await refreshParts($)
}

// Reads the context window by category, estimated locally, as slices of the CTX bar.
async function refreshParts($: Engine) {
  const breakdown = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  if (!breakdown || !breakdown.rawMaxTokens) return
  const used = breakdown.categories.filter(c => c.kind === 'used')
  const buffer = breakdown.categories.filter(c => c.kind === 'buffer')
  const next: Part[] = [
    ...used.map(c => ({ color: PART_COLOR[c.name] ?? OTHER, share: c.tokens / breakdown.rawMaxTokens })),
    ...buffer.map(c => ({ color: BUFFER, share: c.tokens / breakdown.rawMaxTokens })),
  ]
  if (JSON.stringify(await read($, parts)) !== JSON.stringify(next)) await update($, parts, () => next)
  // The API's percent is absent until the window's first reply; estimate it meanwhile so CTX shows.
  if ((await read($, context)) < 0) {
    const estimate = Math.round((100 * used.reduce((sum, c) => sum + c.tokens, 0)) / breakdown.rawMaxTokens)
    await update($, context, () => estimate)
  }
}

function show($: Engine, name: string) {
  return update($, form, () => name)
}

// Plays `name` once, then goes back to whatever fits the current state.
async function react($: Engine, name: string) {
  await show($, name)
  $.clock.after(DURATION_MS[name] ?? 3000, async () => {
    if ((await read($, form)) === name) {
      show($, isWorking ? (tools > 0 ? 'Busy' : 'Thinking') : 'Idle')
    }
  })
}

export const register: Register = on => {
  isWorking = false
  tools = 0
  pending = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ctxdebug', description: 'TEMP: show what the session reports about context' })
    await $.command.register({ name: 'keepwarm', description: 'Re-send this conversation so the prompt cache stays warm for another hour' })
    show($, 'Idle')
    await update($, doing, () => '')
    await update($, time, () => Date.now())
    const usage = await $.session.usage()
    if (usage.cost) {
      await update($, cost, () => costText(usage.cost!.usd))
    }
    const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
    if (fiveHour) {
      await update($, limit, () => Math.round(fiveHour.percentUsed))
    }
    const sevenDay = usage.rateLimits.find(r => r.kind === 'seven_day')
    if (sevenDay) {
      await update($, week, () => Math.round(sevenDay.percentUsed))
    }
    if (usage.context.percent !== undefined) {
      await update($, context, () => Math.round(usage.context.percent!))
    }
    await restore($, usage.startedAt)
    refreshParts($)
    $.clock.every(1000, async () => {
      const now = Date.now()
      if (clockText(await read($, time)) !== clockText(now)) {
        await update($, time, () => now)
      }
    })
    $.clock.every(IDLE_LOOK_MS, async () => {
      if (!isWorking && !isNight(Date.now()) && (await read($, form)) === 'Idle') {
        react($, 'LookAround')
      }
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost && e.changed.includes('cost')) pending.cost = costText(e.cost.usd)
    const fiveHour = e.rateLimits.find(r => r.kind === 'five_hour')
    if (fiveHour) pending.limit = Math.round(fiveHour.percentUsed)
    const sevenDay = e.rateLimits.find(r => r.kind === 'seven_day')
    if (sevenDay) pending.week = Math.round(sevenDay.percentUsed)
    if (e.context.percent !== undefined) pending.context = Math.round(e.context.percent)
    if (!isWorking || Date.now() - lastFlush > LIVE_MS) await flushStats($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    isWorking = true
    tools = 0
    await update($, turnStart, () => Date.now())
    await update($, doing, () => 'Thinking|')
    await show($, 'Thinking')

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const started = Date.now()
    // While the response streams: thinking, replying, or drafting a tool call's arguments.
    const stream = next(e)
    let step = await stream.next()
    while (!step.done) {
      const kind = step.value.kind
      const label = kind === 'thinking' ? 'Thinking|' : kind === 'text' ? 'Replying|' : kind === 'tool' ? 'Drafting|' : null
      if (label && e.agentId === undefined && isWorking && tools === 0 && (await read($, doing)) !== label) {
        await update($, doing, () => label)
      }
      yield step.value
      step = await stream.next()
    }
    const result = step.value
    const u = result.usage
    if (e.agentId === undefined && u) {
      const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      if (input) pending.hit = Math.round((100 * u.cache_read_input_tokens) / input)
      const seconds = (Date.now() - started) / 1000
      if (u.output_tokens && seconds > 0) pending.tps = Math.round(u.output_tokens / seconds)
      if (Date.now() - lastFlush > LIVE_MS) await flushStats($)
    }

    return result
  })

  // Re-sends the conversation as the main thread last sent it, which the API serves from the
  // prompt cache and so keeps warm for another hour. Once the cache has gone cold there is nothing to
  // keep: warming would pay for the same rebuild the next message pays anyway, so it declines.
  on('command.run', { command: 'keepwarm' }, async $ => {
    const repliedAt = await read($, lastReply)
    const left = repliedAt ? Math.ceil((repliedAt + CACHE_TTL_MS - Date.now()) / 60000) : null
    if (left !== null && left <= 0) {
      return { text: 'The cache has already gone cold. Your next message rebuilds it anyway, so warming it now would only pay for that rebuild early.' }
    }
    const r = await $.model.fork({ prompt: 'Reply with just: ok' })
    if (!r.isAnswered && r.reason === 'nothing-to-fork') return { text: 'Nothing to keep warm yet: no reply in this conversation.' }
    if (!r.isAnswered && r.reason === 'api-error') return { text: `Could not warm the cache: API error ${r.status}.` }
    const now = Date.now()
    await update($, warmKind, () => (left !== null && left <= ICE_MINUTES ? 'thaw' : 'glow'))
    await update($, lastReply, () => now)
    await update($, warmed, () => now)
    await save($)
    $.clock.after(WARM_S * 1000 + 100, async () => {
      if ((await read($, warmed)) === now) await update($, warmed, () => 0)
    })
    const kept = r.usage ? Math.round(r.usage.cache_read_input_tokens / 1000) : 0
    return { text: `Cache kept warm: ${kept}k tokens, good for another 60m.` }
  })

  on('command.run', { command: 'ctxdebug' }, async $ => {
    const u = await $.session.usage({ breakdown: 'summary' })
    const b = u.context.breakdown
    return { text: JSON.stringify({ tokens: u.context.tokens, window: u.context.window, percent: u.context.percent, atom: await read($, context), raw: b?.rawMaxTokens, cats: b?.categories.map(c => `${c.name}:${c.kind}:${c.tokens}`) }) }
  })

  on('session.compact', async ($, e, next) => {
    const before = await read($, doing)
    await update($, doing, () => 'Compacting|')
    try {
      return await next(e)
    } finally {
      await update($, doing, () => before)
    }
  })

  on('tool.call', async ($, e, next) => {
    tools += 1
    const label = toolLabel(e.tool, e as unknown as Record<string, unknown>)
    if ((await read($, doing)) !== label) await update($, doing, () => label)
    await show($, toolForm(e.tool))

    const result = await next(e)

    tools = Math.max(0, tools - 1)
    try {
      if (result.deny === undefined && result.isError === true) {
        await react($, 'Oops')
      } else if (isWorking && tools === 0) {
        await update($, doing, () => 'Thinking|')
        await show($, 'Thinking')
      }
    } catch {
      // Clawd's mood never gets in the way of a tool's result.
    }

    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      isWorking = false
      tools = 0
      await update($, doing, () => '')
      await update($, turnStart, () => 0)
      await update($, lastReply, () => Date.now())
      react($, e.isAborted ? 'Sad' : e.durationMs > BIG_TURN_MS ? 'BigDone' : 'Done')
      await flushStats($)
      await save($)
      }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The bar draws through surveys too, so they no longer take it away.
    if (e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      try {
      const name = await read($, form)
      const now = Date.now()
      const clock = clockSvg((await read($, time)) || now)
      const spent = await read($, cost)
      const used = await read($, limit)
      const weekly = await read($, week)
      const filled = await read($, context)
      const slices = await read($, parts)
      const rate = await read($, hit)
      const speed = await read($, tps)
      const repliedAt = await read($, lastReply)
      const warmedAt = await read($, warmed)
      const warmedKind = await read($, warmKind)
      const startedAt = await read($, turnStart)
      const label = await read($, doing)

      const cacheLeft = repliedAt ? Math.ceil((repliedAt + CACHE_TTL_MS - now) / 60000) : null
      const verb = label.split('|')[0]
      const working = Boolean(label)
      const night = isNight(now)
      const asleep = night && !working && name === 'Idle'
      // The first drawing just shows the state; later changes fade into it.
      if (wasAsleep !== undefined && asleep !== wasAsleep) sleepChangedAt = now
      wasAsleep = asleep
      const ago = (now - sleepChangedAt) / 1000
      const dim = (source: string, to: number) => fade(source, asleep ? 1 : to, asleep ? to : 1, ago)
      const stats = statsSvg({
        state: label ? verb : isNight(now) ? 'Sleeping' : 'Idle',
        working,
        elapsed: startedAt && working ? Math.floor((now - startedAt) / 1000) : undefined,
        cacheMinutes: cacheLeft,
        warm: warmedAt && now - warmedAt < WARM_S * 1000 ? { kind: warmedKind, ago: (now - warmedAt) / 1000 } : undefined,
        cost: spent || undefined,
        limit: used >= 0 ? used : undefined,
        week: weekly >= 0 ? weekly : undefined,
        context: filled >= 0 ? filled : undefined,
        parts: slices.length ? slices : undefined,
        hit: rate >= 0 ? rate : undefined,
        tps: speed >= 0 ? speed : undefined,
      })

      // By day the band takes the hour's tint and sky; its drawings keep the colours that suit the tint.
      const period = periodAt(now)
      const tone = period?.dark ? forceDark : forceLight
      const bg = period?.bg ?? NIGHT_BG

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" backgroundColor={bg} borderStyle="round" borderColor={bg} padding="xs">
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Svg source={night ? sleepyClock(forceDark(clock.source)) : tone(clock.source)} alt="Clock" width={clock.width} height={clock.height} />
            <Svg source={night ? dim(forceDark(stats.source), 0.6) : tone(stats.source)} alt={`Session stats. Status: ${label ? verb : 'Idle'}`} width={stats.width} height={stats.height} />
          </Box>
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Svg source={period ? period.art().source : sleepSvg().source} alt={period ? `The sky: ${period.name}` : 'Clawd is asleep'} width={SLEEP_W} height={BAR_HEIGHT} />
            {/* Only the current form is mounted: each is an animated sandboxed frame, and keeping every
                form seen mounted and hidden piled them up until the desktop stopped repainting the band. */}
            <Svg source={night ? dim(FORMS[name] ?? FORMS.Idle, 0.8) : (FORMS[name] ?? FORMS.Idle)} alt={`Clawd: ${name}`} width={CLAWD_W} height={BAR_HEIGHT} isInteractive />
          </Box>
        </Box>
      )
      } catch (err) {
        // A failed drawing must not take the bar away: keep a plain Clawd and note why.
        await $.store.set('lastRenderError', `${new Date().toISOString()} ${String(err)}`).catch(() => {})
        return (
          <Box flexDirection="row" justifyContent="flex-end" paddingRight={2}>
            <Svg source={FORMS.Idle} alt="Clawd" width={CLAWD_W} height={BAR_HEIGHT} />
          </Box>
        )
      }
    }

    if (e.surface !== 'terminal' || e.props.maxRows < TEXT.length) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {TEXT.map((row, i) => (
          <Text key={`clawd-${i}`} color="claude">
            {row}
          </Text>
        ))}
      </Box>
    )
  })
}
