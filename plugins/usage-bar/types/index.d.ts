export type Limit = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-bar': { isOn: boolean; limits: Limit[] | null; now: number }
  }
}
