export type MemFile = { path: string; type: string; tokens: number }
/** One settings source: how many keys it sets and its text, secrets masked. */
export type SettingsRow = { source: string; keys: number; text: string }
export type Saved = { path: string; note: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'memory-pane': {
      /** The memory files the context carries, as /context counts them. */
      files: Shaped<MemFile[]>
      /** The file whose text the pane shows expanded, if any. */
      open: string | null
      /** That file's text. */
      text: string
      /** Each settings source, then the merged view, as the pane shows them. */
      settings: Shaped<SettingsRow[]>
      /** Memory writes this session, newest last. */
      saved: Shaped<Saved[]>
    }
  }
}
