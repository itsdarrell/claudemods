import { expect, test } from 'claude-code/testing'

import { formatReset, meter, toLimits } from './limits'

const NOW = Date.parse('2026-11-07T12:00:00Z')

const BAND = {
  plugin: 'usage-bar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

test('reset times: a countdown under a day, a weekday past it', async () => {
  expect(formatReset('2026-11-07T12:42:00Z', NOW)).toBe('42m')
  expect(formatReset('2026-11-07T14:13:00Z', NOW)).toBe('2h 13m')
  expect(formatReset('2026-11-07T11:00:00Z', NOW)).toBe('reset')
  expect(formatReset(undefined, NOW)).toBe('')
  expect(formatReset('2026-11-11T12:00:00Z', NOW)).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2}(:\d\d)?(am|pm)$/)
})

test('meters fill by percent and stay in bounds', async () => {
  expect(meter(42, 10)).toEqual({ filled: 4, empty: 6 })
  expect(meter(130, 10)).toEqual({ filled: 10, empty: 0 })
})

test('limits are ordered 5h then weekly, junk dropped', async () => {
  const got = toLimits([
    { kind: 'seven_day', percentUsed: 18, resetsAt: 'x' },
    { kind: 'five_hour', percentUsed: 42 },
    { kind: 5 },
  ])
  expect(got.map(l => l.kind)).toEqual(['five_hour', 'seven_day'])
  expect(toLimits('old value')).toEqual([])
})

test('the meters draw on the right of the band beneath', async ($, on) => {
  on('state.get', (_, e) => {
    const key = (e as { key: string }).key
    if (key === 'limits')
      return {
        value: {
          value: [
            { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-11-07T14:13:00Z' },
            { kind: 'seven_day', percentUsed: 18, resetsAt: '2026-11-11T12:00:00Z' },
          ],
          version: 1,
        },
      }
    if (key === 'now') return { value: { value: NOW, version: 1 } }
    return { value: { value: undefined, version: 0 } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>context bar</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /context bar/ }))?.text).toBe('context bar')
    expect((await ui.find({ type: 'Text', text: /42%/ }))?.text).toBe(' 42%')
    expect((await ui.find({ type: 'Text', text: /resets 2h 13m/ }))?.text).toBe(' · resets 2h 13m')
    await ui.unmount()
  }
})

test('/usage-bar toggles', async $ => {
  const off = await $.command.run({ command: 'usage-bar', origin: { kind: 'plugin', name: 'test' }, args: '' } as never)
  expect(JSON.stringify(off)).toContain('off')
})
