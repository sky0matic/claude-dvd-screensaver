export type Saver = {
  isOn: boolean
  x: number
  y: number
  dx: 1 | -1
  dy: 1 | -1
  color: number
  corners: number
}

declare module 'claude-code' {
  interface PluginState {
    'dvd-screensaver': { saver: Shaped<Saver>; activity: Shaped<string[]> }
  }
}
