import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import { DURATION_MS, FORMS, HEIGHT, WIDTH } from './clawd-frames'
import { statsSvg, statusSvg, turnTimerSvg } from './design'
import { clockSvg, clockText, costText } from './pixel-clock'

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
const context = atom({ plugin: 'clawd-band', key: 'context' } as const, -1)
const rtk = atom({ plugin: 'clawd-band', key: 'rtk' } as const, '')
const lastReply = atom({ plugin: 'clawd-band', key: 'lastReply' } as const, 0)
const turnStart = atom({ plugin: 'clawd-band', key: 'turnStart' } as const, 0)

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

// Reads the tokens RTK has saved from `rtk gain`; leaves the figure as it was if RTK is missing.
async function refreshRtk($: Engine) {
  try {
    const { exitCode, stdout } = await $.process.run(['rtk', 'gain'])
    const saved = exitCode === 0 ? /Tokens saved:\s+([\d.]+[KMB]?)/.exec(stdout) : null
    if (saved) {
      await update($, rtk, () => saved[1])
    }
  } catch {
    // No RTK on this machine: the bar leaves it out.
  }
}

export const register: Register = on => {
  isWorking = false
  tools = 0

  on('session.start', async ($, e, next) => {
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
    if (usage.context.percent !== undefined) {
      await update($, context, () => Math.round(usage.context.percent!))
    }
    refreshRtk($)
    $.clock.every(1000, async () => {
      const now = Date.now()
      if (clockText(await read($, time)) !== clockText(now)) {
        await update($, time, () => now)
      }
    })
    $.clock.every(IDLE_LOOK_MS, async () => {
      if (!isWorking && (await read($, form)) === 'Idle') {
        react($, 'LookAround')
      }
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.cost && e.changed.includes('cost')) {
      const text = costText(e.cost.usd)
      if ((await read($, cost)) !== text) await update($, cost, () => text)
    }
    const fiveHour = e.rateLimits.find(r => r.kind === 'five_hour')
    if (fiveHour) {
      const used = Math.round(fiveHour.percentUsed)
      if ((await read($, limit)) !== used) await update($, limit, () => used)
    }
    if (e.context.percent !== undefined) {
      const percent = Math.round(e.context.percent)
      if ((await read($, context)) !== percent) await update($, context, () => percent)
    }

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
      refreshRtk($)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    if (e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      const name = await read($, form)
      const now = Date.now()
      const clock = clockSvg((await read($, time)) || now)
      const spent = await read($, cost)
      const used = await read($, limit)
      const filled = await read($, context)
      const saved = await read($, rtk)
      const repliedAt = await read($, lastReply)
      const startedAt = await read($, turnStart)
      const label = await read($, doing)

      const cacheLeft = repliedAt ? Math.ceil((repliedAt + CACHE_TTL_MS - now) / 60000) : null
      const stats = statsSvg({
        cost: spent || undefined,
        limit: used >= 0 ? used : undefined,
        context: filled >= 0 ? filled : undefined,
        rtk: saved || undefined,
      })
      const verb = label.split('|')[0]
      const status = statusSvg(label ? verb : 'Idle', Boolean(label), cacheLeft)
      const timer = startedAt && label ? turnTimerSvg(0) : null

      return (
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" paddingX={2}>
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Svg source={clock.source} alt="Clock" width={clock.width} height={clock.height} isInteractive />
            {stats && <Svg source={stats.source} alt="Session stats" width={stats.width} height={stats.height} />}
          </Box>
          <Box flexDirection="row" alignItems="center" gap={2}>
            <Svg source={status.source} alt={`Status: ${label ? verb : 'Idle'}`} width={status.width} height={status.height} isInteractive />
            {timer && <Svg source={timer.source} alt="Turn time" width={timer.width} height={timer.height} isInteractive />}
            <Svg source={FORMS[name] ?? FORMS.Idle} alt={`Clawd: ${name}`} width={WIDTH} height={HEIGHT} isInteractive />
          </Box>
        </Box>
      )
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
