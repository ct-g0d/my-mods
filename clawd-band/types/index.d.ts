export type FormName = string
export type Part = { color: string; share: number }

declare module 'claude-code' {
  interface PluginState {
    'clawd-band': {
      form: FormName
      time: number
      cost: string
      doing: string
      limit: number
      week: number
      context: number
      parts: Part[]
      hit: number
      tps: number
      lastReply: number
      turnStart: number
      warmed: number
      warmKind: 'glow' | 'thaw'
      auto: number
      note: { text: string; at: number }
    }
  }
}
