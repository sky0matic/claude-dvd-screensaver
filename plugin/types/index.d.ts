export type Saver = {
  isOn: boolean
  x: number
  y: number
  dx: 1 | -1
  dy: 1 | -1
  color: number
  corners: number
  /** The travel the start was picked for; -1 before one is picked. */
  maxX: number
  maxY: number
}

declare module 'claude-code' {
  interface PluginState {
    'dvd-screensaver': { saver: Shaped<Saver>; activity: Shaped<string[]> }
  }
}
