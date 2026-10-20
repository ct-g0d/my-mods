export type FormName = string

declare module 'claude-code' {
  interface PluginState {
    'clawd-band': {
      form: FormName
      time: number
      cost: string
      doing: string
      limit: number
      context: number
      rtk: string
      lastReply: number
      turnStart: number
    }
  }
}
