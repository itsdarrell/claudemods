import type { EngineInterface, Register } from 'claude-code'

import { flat, isPrompt, label, pair } from './label'

const PANE = 'prompt-nav'
const ACCENT = '#7aa2f7'

type Prompt = { id: string; text: string }

/** The prompts the person typed, oldest first, from the stored conversation. */
async function conversation($: EngineInterface) {
  return (await $.session.messages())
    .filter(m => m.role === 'user' && !m.toolResults?.length && isPrompt(m.text))
    .map(m => m.text)
}

export const register: Register = on => {
  // The list and its order come from the conversation; a prompt's jump target
  // (its row's render requestId, what $.ui.scroll reveals) is learned when
  // the transcript draws that row.
  const prompts: Prompt[] = []
  const visible = new Set<string>()

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'questions',
      description: 'Show your previous prompts in a pane and jump to one',
    })

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    $.ui.invalidate('ui.render')

    return next(e)
  })

  on('command.run', { command: 'questions' }, async ($, e) => {
    if (e.args.trim() === 'debug') {
      const list = pair(await conversation($), prompts)

      return {
        text: [
          `${list.length} prompts, ${prompts.length} rows drawn, ${visible.size} on screen`,
          ...list.map((p, i) => `${i + 1}. ${p.id ? 'jump' : 'no row yet'} · ${label(p.text, 60)}`),
        ].join('\n'),
      }
    }
    const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })

      return { text: 'Questions pane closed.' }
    }
    // A slim rail: about a twentieth of the terminal, docked on the right.
    const columns = Math.max(8, Math.round(e.presentation.columns * 0.05))
    await $.ui.open({ id: PANE, title: 'Questions', columns })

    return {
      text: e.presentation.isFullscreen
        ? 'Questions pane opened.'
        : 'Questions pane opened. It docks on the right, and jumps work, in fullscreen mode.',
    }
  })

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.props.origin.kind !== 'composer' || !isPrompt(e.props.text)) return next(e)

    let changed = false
    const known = prompts.find(p => p.id === e.requestId)
    if (!known) {
      prompts.push({ id: e.requestId, text: e.props.text })
      changed = true
    } else if (known.text !== e.props.text) {
      known.text = e.props.text
      changed = true
    }

    if (e.props.onScreen !== undefined) {
      const isShown = e.props.onScreen !== null
      if (isShown !== visible.has(e.requestId)) {
        if (isShown) visible.add(e.requestId)
        else visible.delete(e.requestId)
        changed = true
      }
    }

    if (changed) $.ui.invalidate('ui.render')

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const rail = { flexDirection: 'column' } as const
    const list = pair(await conversation($), prompts)

    if (list.length === 0) {
      return (
        <Box {...rail}>
          <Text dimColor>none yet</Text>
        </Box>
      )
    }

    const digits = String(list.length).length
    const room = e.props.bodyColumns - digits - 3

    return (
      <Box {...rail}>
        {list.map((p, i) => {
          const isShown = p.id !== undefined && visible.has(p.id)
          const rowKey = p.id ?? `n${i}`
          const n = String(i + 1).padStart(digits)

          return (
            // Keyed, so hovering anywhere on the row reveals the full prompt.
            <Box key={`row-${rowKey}`} flexDirection="column">
              <Box>
                <Text color={isShown ? ACCENT : undefined} dimColor={!isShown}>
                  {isShown ? '┃ ' : '│ '}
                </Text>
                <Button
                  key={`jump-${rowKey}`}
                  plain
                  dimColor={!isShown}
                  label={`${n} ${label(p.text, room)}`}
                  onPress={async () => {
                    if (!p.id) {
                      $.ui.toast('Scroll up past that prompt once, then it can jump')
                      return
                    }
                    const moved = await $.ui.scroll({ to: { requestId: p.id }, block: 'start' })
                    if (moved.deny) $.ui.toast(`Can't jump there: ${moved.deny}`)
                  }}
                />
              </Box>
              <Box display="none" hover={{ display: 'flex' }} paddingLeft={2} paddingBottom={1}>
                <Text wrap="wrap">{full(p.text)}</Text>
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  })
}

const full = (text: string) => {
  const one = flat(text)
  return one.length > 400 ? `${one.slice(0, 399)}…` : one
}
