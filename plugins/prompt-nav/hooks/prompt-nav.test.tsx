import { expect, mock, test } from 'claude-code/testing'

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

test('a drawn prompt row reaches the pane without redrawing the transcript', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>row</Text>
  })
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'first question', toolUses: [] },
      { role: 'assistant', text: 'an answer', toolUses: [] },
      { role: 'user', text: 'second question', toolUses: [] },
    ],
  }) as never)
  await $.ui.mount({
    plugin: 'prompt-nav',
    surface: 'terminal',
    component: 'UserMessage',
    requestId: 'm2',
    props: { text: 'second question', origin: { kind: 'composer' }, isExpanded: false, onScreen: { first: 0, last: 2, of: 3 } } as never,
  })
  await clock.advance(10)
  const pane = await $.ui.mount({
    plugin: 'prompt-nav',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'prompt-nav',
    props: { title: 'Questions', isFocused: false, bodyColumns: 30, placement: 'dock', scroll: { offset: 0, bodyRows: 20 } } as never,
  })
  // Both prompts listed in order; only the drawn one can jump, and it is on screen.
  expect((await pane.find({ key: 'jump-n0' }))?.props.label).toBe('1 first question')
  expect((await pane.find({ key: 'jump-m2' }))?.props.label).toBe('2 second question')
  expect(await pane.find({ type: 'Text', text: '┃ ' })).toBeDefined()
})
