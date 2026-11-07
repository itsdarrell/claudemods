import { expect, test } from 'claude-code/testing'

import { allocate, formatTokens, legendStrip, marquee, scrolls } from './bar'

test('cells always fill the width and tiny used rows stay visible', async () => {
  const segs = [
    { name: 'System prompt', tokens: 3000, color: 'inactive', kind: 'used' as const },
    { name: 'Memory files', tokens: 50, color: 'claude', kind: 'used' as const },
    { name: 'Messages', tokens: 40000, color: 'permission', kind: 'used' as const },
    { name: 'Free space', tokens: 120000, color: 'promptBorder', kind: 'free' as const },
    { name: 'Autocompact buffer', tokens: 33000, color: 'inactive', kind: 'buffer' as const },
  ]
  const cells = allocate(segs, 60)
  expect(cells.reduce((a, b) => a + b, 0)).toBe(60)
  expect(cells[1]).toBe(1)
  expect(allocate(segs, 0)).toEqual([0, 0, 0, 0, 0])
})

test('token labels', async () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(45200)).toBe('45.2k')
  expect(formatTokens(1_000_000)).toBe('1.0M')
})

test('/context-bar toggles', async $ => {
  const off = await $.command.run({ command: 'context-bar', origin: { kind: 'plugin', name: 'test' }, args: '' } as never)
  expect(JSON.stringify(off)).toContain('off')
  const on = await $.command.run({ command: 'context-bar', origin: { kind: 'plugin', name: 'test' }, args: '' } as never)
  expect(JSON.stringify(on)).toContain('on')
})

const SEGS = [
  { name: 'System prompt', tokens: 3100, color: '', kind: 'used' as const },
  { name: 'System tools', tokens: 12400, color: '', kind: 'used' as const },
  { name: 'Memory files', tokens: 800, color: '', kind: 'used' as const },
  { name: 'Messages', tokens: 29700, color: '', kind: 'used' as const },
  { name: 'Free space', tokens: 120000, color: '', kind: 'free' as const },
  { name: 'Autocompact buffer', tokens: 33000, color: '', kind: 'buffer' as const },
]
const COLORS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']
const text = (runs: { text: string }[]) => runs.map(r => r.text).join('')

test('legend strip holds the top 3 used rows, largest first, no free or buffer', async () => {
  const strip = legendStrip(SEGS, COLORS)
  expect(strip.map(c => c.ch).join('')).toBe('● msgs 29.7k   ● tools 12.4k   ● sys 3.1k   ')
  expect(strip.filter(c => c.color).map(c => c.color)).toEqual(['c3', 'c1', 'c0'])
})

test('a legend that fits stands still, whole', async () => {
  const strip = legendStrip(SEGS, COLORS, 1)
  expect(scrolls(strip, 30)).toBe(false)
  expect(text(marquee(strip, 7, 30))).toBe('● msgs 29.7k')
})

test('a wide legend scrolls in a window of one width and wraps around', async () => {
  const strip = legendStrip(SEGS, COLORS)
  expect(scrolls(strip, 20)).toBe(true)
  expect(text(marquee(strip, 0, 20))).toBe('● msgs 29.7k   ● too')
  expect(text(marquee(strip, 2, 20))).toBe('msgs 29.7k   ● tools')
  for (const n of [0, 5, 31, 44, 1000]) expect(text(marquee(strip, n, 20))).toHaveLength(20)
  // One step before wrapping, the window spans the end and the start.
  expect(text(marquee(strip, strip.length - 3, 20))).toBe('   ● msgs 29.7k   ● ')
  // Dots keep their color; text runs are dim.
  expect(marquee(strip, 0, 20)[0]).toEqual({ text: '●', color: 'c3' })
})

test('the band draws the scrolling legend beside the band beneath', async ($, on) => {
  const snap = { segments: SEGS, totalTokens: 46000, maxTokens: 200000, percentage: 23 }
  on('state.get', (_, e) => {
    const key = (e as { key: string }).key
    if (key === 'snapshot') return { value: { value: snap, version: 1 } }
    if (key === 'offset') return { value: { value: 2, version: 1 } }
    return { value: { value: undefined, version: 0 } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>usage</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'context-bar',
      component: 'AbovePrompt',
      surface,
      props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
    })
    expect((await ui.find({ type: 'Text', text: /^msgs 29\.7k/ }))?.text).toBe('msgs 29.7k   ')
    expect((await ui.find({ type: 'Text', text: /usage/ }))?.text).toBe('usage')
    await ui.unmount()
  }
})

test('/context-bar scroll switches to a still top-2 legend and back', async ($, on) => {
  const snap = { segments: SEGS, totalTokens: 46000, maxTokens: 200000, percentage: 23 }
  // Seeds the drawing's inputs; the toggle's own value goes to the kit's state.
  on('state.get', (_, e, next) => {
    const key = (e as { key: string }).key
    if (key === 'snapshot') return { value: { value: snap, version: 1 } }
    if (key === 'offset') return { value: { value: 2, version: 1 } }
    return next(e)
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>usage</Text>
  })
  const stored: Record<string, unknown> = {}
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    return { value: undefined }
  })
  const run = (args: string) =>
    $.command.run({ command: 'context-bar', origin: { kind: 'plugin', name: 'test' }, args } as never)

  expect(JSON.stringify(await run('scroll'))).toContain('top 2')
  const ui = await $.ui.mount({
    plugin: 'context-bar',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
  })
  // Still: starts at the biggest driver whatever the offset, and leaves out the third.
  expect((await ui.find({ type: 'Text', text: /^ msgs 29\.7k/ }))?.text).toBe(' msgs 29.7k   ')
  expect(await ui.find({ type: 'Text', text: /sys/ })).toBeFalsy()
  await ui.unmount()

  expect(stored.isScrolling).toBe(false)
  expect(JSON.stringify(await run(' scroll '))).toContain('top 3')
  expect(stored.isScrolling).toBe(true)
})
