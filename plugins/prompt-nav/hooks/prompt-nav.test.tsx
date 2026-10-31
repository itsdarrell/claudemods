import { expect, test } from 'claude-code/testing'

import { isPrompt, label, pair } from './label'

test('labels are one line and fit', async () => {
  expect(label('hello\n  world', 20)).toBe('hello world')
  expect(label('a very long question indeed', 10)).toBe('a very lo…')
})

test('slash commands and wrappers are not prompts', async () => {
  expect(isPrompt('/questions')).toBe(false)
  expect(isPrompt('<command-name>/questions</command-name>')).toBe(false)
  expect(isPrompt('[Request interrupted by user]')).toBe(false)
  expect(isPrompt('make it 5%')).toBe(true)
})

test('order comes from the conversation, not from drawing order', async () => {
  // The transcript drew the newest row first, as after a reload.
  const rows = [
    { id: 'c', text: 'third' },
    { id: 'a', text: 'first' },
  ]
  expect(pair(['first', 'second', 'third'], rows)).toEqual([
    { text: 'first', id: 'a' },
    { text: 'second', id: undefined },
    { text: 'third', id: 'c' },
  ])
  // The same prompt typed twice takes its rows in turn.
  expect(pair(['yes', 'yes'], [{ id: 'x', text: 'yes' }, { id: 'y', text: 'yes' }]).map(p => p.id)).toEqual(['x', 'y'])
})
