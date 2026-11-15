import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { MemFile, Saved, SettingsRow } from '../types'

import { MEMORY_PATH, base, describe, mask, tilde } from './memory'

const PANE = 'memory-pane'
const ACCENT = '#bb9af7'

const filesAtom = atom({ plugin: 'memory-pane', key: 'files' } as const, [], { shape: 'files-1' })
const openAtom = atom({ plugin: 'memory-pane', key: 'open' } as const, null)
const textAtom = atom({ plugin: 'memory-pane', key: 'text' } as const, '')
const settingsAtom = atom({ plugin: 'memory-pane', key: 'settings' } as const, [], { shape: 'settings-1' })
const savedAtom = atom({ plugin: 'memory-pane', key: 'saved' } as const, [], { shape: 'saved-1' })

const ORDER = ['Managed', 'User', 'Project', 'Local', 'AutoMem']
const LABEL: Record<string, string> = { AutoMem: 'Project memory (auto)' }
// The CLAUDE.md tiers a person might expect, shown as "none" when absent.
const EXPECTED = ['User', 'Project', 'Local']

// Lowest precedence first, as the engine merges them.
const SOURCES = ['user', 'project', 'local', 'flag', 'policy'] as const
const SOURCE_LABEL: Record<string, string> = {
  user: 'User · ~/.claude/settings.json',
  project: 'Project · .claude/settings.json',
  local: 'Local · .claude/settings.local.json',
  flag: 'Flag · --settings',
  policy: 'Managed policy',
  merged: 'Effective (merged)',
}

async function refresh($: EngineInterface) {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const files: MemFile[] = (usage.context.breakdown?.memoryFiles ?? []).map(f => ({
    path: f.path,
    type: f.type,
    tokens: f.tokens,
  }))
  await update($, filesAtom, () => files)

  const layers: Record<string, Record<string, unknown>> = {}
  for (const source of SOURCES) {
    layers[source] = ((await $.settings.read({ source }).catch(() => ({}))) ?? {}) as Record<string, unknown>
  }
  const rows: SettingsRow[] = SOURCES.map(source => {
    const own = layers[source] ?? {}
    return { source, keys: Object.keys(own).length, text: JSON.stringify(mask(own), null, 2) }
  })
  // Each top-level key, with the highest-precedence source that sets it.
  const winner: Record<string, string> = {}
  for (const source of SOURCES) for (const k of Object.keys(layers[source] ?? {})) winner[k] = source
  const merged = (await $.settings.read().catch(() => ({}))) as Record<string, unknown>
  const lines = Object.keys(merged)
    .sort()
    .map(k => `${k}  ← ${winner[k] ?? 'plugin'}\n${JSON.stringify(mask(merged[k], k, k === 'env'), null, 2)}`)
  rows.push({ source: 'merged', keys: Object.keys(merged).length, text: lines.join('\n\n') })
  await update($, settingsAtom, () => rows)
}

async function toggleSettings($: EngineInterface, source: string) {
  const id = `settings:${source}`
  if ((await read($, openAtom)) === id) {
    await update($, openAtom, () => null)
    return
  }
  const row = (await read($, settingsAtom)).find(r => r.source === source)
  await update($, textAtom, () => row?.text ?? '')
  await update($, openAtom, () => id)
}

async function toggle($: EngineInterface, path: string) {
  const current = await read($, openAtom)
  if (current === path) {
    await update($, openAtom, () => null)
    return
  }
  const text = await $.fs.read(path).catch(() => '(could not read this file)')
  await update($, textAtom, () => text)
  await update($, openAtom, () => path)
}

/** Toasts and logs a successful write to an instruction or memory file. */
async function watch($: EngineInterface, path: string, content: string | undefined, ran: { deny?: string; isError?: boolean }) {
  if (ran.deny !== undefined || ran.isError || !MEMORY_PATH.test(path)) return
  const note = (content && describe(content)) ?? 'updated'
  $.ui.toast(`Memory saved · ${base(path)} — ${note}`, { timeoutMs: 6000 })
  await update($, savedAtom, list => [...list, { path, note, at: Date.now() }].slice(-20))
  if ((await read($, openAtom)) === path) {
    const text = await $.fs.read(path).catch(() => '')
    await update($, textAtom, () => text)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'memory-pane',
      description: 'Show the CLAUDE.md and memory files in context, with their token cost',
    })
    void refresh($).catch(() => {})
    void $.ui.open({ id: PANE, title: 'Memory' })

    return next(e)
  })

  on('command.run', { command: 'memory-pane' }, async $ => {
    const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Memory pane closed.' }
    }
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Memory' })

    return { text: 'Memory pane opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($).catch(() => {})

    return next(e)
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    await watch($, e.file_path, e.content, ran).catch(() => {})
    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    await watch($, e.file_path, undefined, ran).catch(() => {})
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const files = await read($, filesAtom)
    const open = await read($, openAtom)
    const text = await read($, textAtom)
    const saved = await read($, savedAtom)
    const settings = await read($, settingsAtom)
    const clip = (t: string) => (t.length > 3000 ? `${t.slice(0, 2999)}…` : t)
    const width = Math.max(20, e.props.bodyColumns)

    const total = files.reduce((n, f) => n + f.tokens, 0)
    const groups = [...new Set([...files.map(f => f.type), ...EXPECTED])].sort(
      (a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99,
    )
    const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {files.length} files · {fmt(total)} tokens
        </Text>
        {files.length === 0 && <Text dimColor>No memory files in context.</Text>}
        {groups.map(type => (
          <Box key={`g-${type}`} flexDirection="column" marginTop={1}>
            <Text bold color={ACCENT}>
              {LABEL[type] ?? type}
            </Text>
            {!files.some(f => f.type === type) && <Text dimColor>  none</Text>}
            {files
              .filter(f => f.type === type)
              .map(f => {
                const isOpen = open === f.path
                const name = base(f.path)
                const room = Math.max(4, width - fmt(f.tokens).length - 4)
                const shown = name.length > room ? `${name.slice(0, room - 1)}…` : name
                return (
                  <Box key={`f-${f.path}`} flexDirection="column">
                    <Box>
                      <Button key={`open-${f.path}`} plain label={`${isOpen ? '▾' : '▸'} ${shown}`} onPress={() => toggle($, f.path)} />
                      <Box flexGrow={1} />
                      <Text dimColor>{fmt(f.tokens)}</Text>
                    </Box>
                    {isOpen && (
                      <Box flexDirection="column" paddingLeft={2} paddingBottom={1}>
                        <Text dimColor>{tilde(f.path)}</Text>
                        <Text wrap="wrap">{clip(text)}</Text>
                      </Box>
                    )}
                  </Box>
                )
              })}
          </Box>
        ))}
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={ACCENT}>
            Settings
          </Text>
          {settings.map(r => {
            const id = `settings:${r.source}`
            const isOpen = open === id
            const name = SOURCE_LABEL[r.source] ?? r.source
            const room = Math.max(4, width - 10)
            return (
              <Box key={`s-${r.source}`} flexDirection="column">
                <Box>
                  <Button
                    key={`open-${id}`}
                    plain
                    dimColor={r.keys === 0}
                    label={`${isOpen ? '▾' : '▸'} ${name.length > room ? `${name.slice(0, room - 1)}…` : name}`}
                    onPress={() => toggleSettings($, r.source)}
                  />
                  <Box flexGrow={1} />
                  <Text dimColor>{r.keys === 0 ? 'none' : `${r.keys} keys`}</Text>
                </Box>
                {isOpen && (
                  <Box paddingLeft={2} paddingBottom={1}>
                    <Text wrap="wrap">{r.keys === 0 ? 'Nothing set here.' : clip(text)}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
        {saved.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color={ACCENT}>
              Saved this session
            </Text>
            {[...saved].reverse().map((s, i) => (
              <Text key={`saved-${i}`} dimColor wrap="truncate-end">
                {base(s.path)} — {s.note}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
