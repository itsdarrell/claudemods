import { expect, test } from 'claude-code/testing'

import { allocate, fitLegend, formatTokens } from './bar'

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

test('legend shows the top used rows, largest first, and fits one line', async () => {
  const segs = [
    { name: 'System prompt', tokens: 3100, color: '', kind: 'used' as const },
    { name: 'System tools', tokens: 12400, color: '', kind: 'used' as const },
    { name: 'Memory files', tokens: 800, color: '', kind: 'used' as const },
    { name: 'Messages', tokens: 29700, color: '', kind: 'used' as const },
    { name: 'Free space', tokens: 120000, color: '', kind: 'free' as const },
    { name: 'Autocompact buffer', tokens: 33000, color: '', kind: 'buffer' as const },
  ]
  const legend = fitLegend(segs, 80)
  expect(legend.map(l => l.text)).toEqual(['msgs 29.7k', 'tools 12.4k', 'sys 3.1k'])
  expect(legend.map(l => l.i)).toEqual([3, 1, 0])
  expect(fitLegend(segs, 14)).toHaveLength(1)
})
