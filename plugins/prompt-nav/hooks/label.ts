/** Whitespace collapsed to single spaces, trimmed. */
export const flat = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** One line for a prompt, cut to `width` with an ellipsis. */
export const label = (text: string, width: number): string => {
  const one = flat(text)
  if (width <= 1) return one.slice(0, Math.max(0, width))

  return one.length > width ? `${one.slice(0, width - 1)}…` : one
}

/**
 * Whether a stored user message is a prompt the person typed, not a slash
 * command's wrapper, an interruption marker or an injected note.
 */
export const isPrompt = (text: string): boolean => {
  const one = flat(text)

  return one !== '' && !one.startsWith('<') && !one.startsWith('/') && !one.startsWith('[Request interrupted')
}

/**
 * Pairs the conversation's prompts, in order, with the transcript rows drawn
 * so far (id by text), oldest first. A prompt typed twice takes its rows in
 * turn.
 */
export const pair = (prompts: string[], rows: { id: string; text: string }[]) => {
  const used = new Set<string>()

  return prompts.map(text => {
    const key = flat(text)
    const row = rows.find(r => !used.has(r.id) && (key === flat(r.text) || key.startsWith(flat(r.text))))
    if (row) used.add(row.id)

    return { text, id: row?.id }
  })
}
