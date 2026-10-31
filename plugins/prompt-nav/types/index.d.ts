export type Row = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'prompt-nav': {
      /** Prompt rows the transcript has drawn, by render requestId. */
      rows: Row[]
      /** Ids of the prompt rows on screen now. */
      visible: string[]
      /** Bumped after each turn, so the pane re-reads the conversation. */
      turns: number
    }
  }
}
