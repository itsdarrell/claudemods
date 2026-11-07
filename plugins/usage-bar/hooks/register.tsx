import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, Timer } from 'claude-code'

import { formatReset, hasReset, label, meter, toLimits, tone } from './limits'

const isOn = atom({ plugin: 'usage-bar', key: 'isOn' } as const, true)
const limits = atom({ plugin: 'usage-bar', key: 'limits' } as const, null)
const now = atom({ plugin: 'usage-bar', key: 'now' } as const, 0)

const METER_WIDTH = 10

const save = async ($: EngineInterface, rateLimits: SessionRateLimit[]) => {
  const picked = toLimits(rateLimits)
  if (picked.length === 0) return
  await update($, limits, () => picked)
  await $.store.set('limits', picked)
}

const tick = async ($: EngineInterface) => {
  const t = await $.clock.now()
  await update($, now, () => t)
}

export const register: Register = on => {
  let timer: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-bar',
      description: 'Toggle the 5-hour and weekly usage meters beside the context bar',
    })

    // The last reading from any session, until this one's first response reports fresh figures.
    if (!(await read($, limits))) {
      const stored = toLimits(await $.store.get('limits'))
      if (stored.length > 0) await update($, limits, () => stored)
    }
    void $.session
      .usage()
      .then(u => save($, u.rateLimits))
      .catch(() => {})
    await tick($)
    timer?.cancel()
    timer = $.clock.every(60_000, () => void tick($).catch(() => {}))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await save($, e.rateLimits).catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'usage-bar' }, async $ => {
    const shown = !(await read($, isOn))
    await update($, isOn, () => shown)

    return { text: shown ? 'Usage bar on.' : 'Usage bar off.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const beside = await next(e)
    if (e.props.hasSurvey || !(await read($, isOn))) return beside
    const lims = await read($, limits)
    if (!lims || lims.length === 0) return beside
    const t = await read($, now)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {beside}
        <Box key="usage" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} alignSelf="flex-start">
          {lims.map(l => {
            const isReset = hasReset(l, t)
            const percent = isReset ? 0 : l.percentUsed
            const { filled, empty } = meter(percent, METER_WIDTH)
            const resets = formatReset(l.resetsAt, t)

            return (
              <Box key={l.kind}>
                <Text dimColor>{`${label(l.kind).padEnd(3)}`}</Text>
                <Text color={tone(percent)}>{'━'.repeat(filled)}</Text>
                <Text dimColor>{'─'.repeat(empty)}</Text>
                <Text>{` ${isReset ? '–' : `${Math.round(percent)}%`}`}</Text>
                {resets ? <Text dimColor>{` · ${isReset ? 'reset' : `resets ${resets}`}`}</Text> : null}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
