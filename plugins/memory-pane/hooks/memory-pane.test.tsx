import { expect, test } from 'claude-code/testing'

import { MEMORY_PATH, describe, mask, tilde } from './memory'

test('memory paths: instruction files and auto-memory, nothing else', async () => {
  expect(MEMORY_PATH.test('/repo/CLAUDE.md')).toBe(true)
  expect(MEMORY_PATH.test('/repo/CLAUDE.local.md')).toBe(true)
  expect(MEMORY_PATH.test('/repo/.claude/rules/style.md')).toBe(true)
  expect(MEMORY_PATH.test('/u/.claude/projects/-repo/memory/MEMORY.md')).toBe(true)
  expect(MEMORY_PATH.test('/repo/README.md')).toBe(false)
  expect(MEMORY_PATH.test('/repo/NOTCLAUDE.md')).toBe(false)
  expect(MEMORY_PATH.test('/u/.claude/projects/-repo/notes/a.md')).toBe(false)
})

test('a memory file is described by its frontmatter', async () => {
  expect(describe('---\nname: a\ndescription: use tabs\nmetadata:\n  type: user\n---\nbody')).toBe('use tabs')
  expect(describe('no frontmatter')).toBeUndefined()
})

test('settings: env values and secret-looking keys are masked, the rest kept', async () => {
  const got = mask({
    theme: 'dark',
    apiKeyHelper: '/bin/get-key',
    env: { ANTHROPIC_BASE_URL: 'https://x', DEBUG: '1' },
    permissions: { allow: ['Bash(ls)'] },
    nested: { authToken: 'abc', count: 3 },
  })
  expect(got).toEqual({
    theme: 'dark',
    apiKeyHelper: '••••',
    env: { ANTHROPIC_BASE_URL: '••••', DEBUG: '••••' },
    permissions: { allow: ['Bash(ls)'] },
    nested: { authToken: '••••', count: 3 },
  })
})

test('home folders are shown as ~', async () => {
  expect(tilde('/Users/someone/.claude/CLAUDE.md')).toBe('~/.claude/CLAUDE.md')
  expect(tilde('/home/someone/x')).toBe('~/x')
  expect(tilde('/opt/x')).toBe('/opt/x')
})
