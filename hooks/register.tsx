import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Saver } from '../types'

/** How long a turn runs before the screensaver comes up. */
const DELAY_MS = 15_000
/** Frame period of the bounce. */
const FRAME_MS = 120
/** Rows left for the spinner line, the prompt box and the hint under it. */
const RESERVED_ROWS = 7
/** Recent tool calls listed at the bottom of the box. */
const FEED_ROWS = 3

const LOGO = [
  '█▀▀▄ █   █ █▀▀▄',
  '█  █  █ █  █  █',
  '█▄▄▀   ▀   █▄▄▀',
  ' ≈≈≈ VIDEO ≈≈≈ ',
]
const LOGO_W = Math.max(...LOGO.map(line => line.length))
const LOGO_H = LOGO.length
const COLORS = ['magenta', 'cyan', 'yellow', 'green', 'red', 'blue', 'white'] as const

const IDLE: Saver = {
  isOn: false,
  x: 0,
  y: 0,
  dx: 1,
  dy: 1,
  color: 0,
  corners: 0,
  maxX: -1,
  maxY: -1,
}
const saver = atom({ plugin: 'dvd-screensaver', key: 'saver' } as const, IDLE, {
  shape: 'saver-2',
})
const activity = atom({ plugin: 'dvd-screensaver', key: 'activity' } as const, [], {
  shape: 'activity-1',
})

/** One line for a tool call: its name and the most telling of its arguments. */
function describe(e: Record<string, unknown>): string {
  const tool = String(e.tool)
  for (const key of ['description', 'command', 'file_path', 'pattern', 'url', 'query', 'prompt']) {
    const value = e[key]
    if (typeof value === 'string' && value.trim() !== '') {
      return `${tool}: ${value.replace(/\s+/g, ' ').trim()}`
    }
  }
  return tool
}

// The field the logo bounces in, as last drawn (module state: a reload resets it).
let field = { w: 60, h: 10 }
let pending: { cancel: () => void } | undefined
let ticking: { cancel: () => void } | undefined

type Motion = Pick<Saver, 'x' | 'y' | 'dx' | 'dy'>

/** One tick of the bounce in a field of `maxX` by `maxY` cells of travel. */
function step(m: Motion, maxX: number, maxY: number) {
  let { x, y, dx, dy } = m
  x += dx
  y += dy
  let hitX = false
  let hitY = false
  if (x <= 0 || x >= maxX) {
    x = Math.min(Math.max(x, 0), maxX)
    dx = dx === 1 ? -1 : 1
    hitX = true
  }
  if (y <= 0 || y >= maxY) {
    y = Math.min(Math.max(y, 0), maxY)
    dy = dy === 1 ? -1 : 1
    hitY = true
  }
  return { motion: { x, y, dx, dy }, hitX, hitY }
}

/**
 * A random start that is sure to reach a corner: a random corner, heading
 * inward, run forward a random number of ticks. The bounce is a loop that
 * comes back to every point on it, so the logo comes back to that corner.
 */
function cornerReachableStart(maxX: number, maxY: number): Motion {
  const right = Math.random() < 0.5
  const bottom = Math.random() < 0.5
  let m: Motion = {
    x: right ? maxX : 0,
    y: bottom ? maxY : 0,
    dx: right ? -1 : 1,
    dy: bottom ? -1 : 1,
  }
  // One full loop takes at most 2 * maxX * maxY ticks; go somewhere along it.
  const ticks = Math.floor(Math.random() * Math.max(1, 2 * maxX * maxY))
  for (let i = 0; i < ticks; i += 1) m = step(m, maxX, maxY).motion
  return m
}

async function stop($: EngineInterface) {
  pending?.cancel()
  ticking?.cancel()
  pending = ticking = undefined
  await update($, saver, s => ({ ...s, isOn: false }))
}

export const register: Register = on => {

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    await stop($)
    await update($, activity, () => [])
    pending = $.clock.after(DELAY_MS, async () => {
      // The start is picked on the first tick, once the box has been drawn
      // and its size is known (maxX -1 says no start yet).
      await update($, saver, () => ({
        ...IDLE,
        isOn: true,
        color: Math.floor(Math.random() * COLORS.length),
      }))
      ticking = $.clock.every(FRAME_MS, () =>
        update($, saver, s => {
          if (!s.isOn) return s
          const maxX = Math.max(0, field.w - LOGO_W)
          const maxY = Math.max(0, field.h - LOGO_H)
          // First tick, or the terminal was resized: the old path no longer
          // fits, so pick a new corner-reachable start for this size.
          if (s.maxX !== maxX || s.maxY !== maxY) {
            return { ...s, ...cornerReachableStart(maxX, maxY), maxX, maxY }
          }
          const { motion, hitX, hitY } = step(s, maxX, maxY)
          let { color, corners } = s
          if (hitX || hitY) color = (color + 1) % COLORS.length
          if (hitX && hitY) {
            corners += 1
            void $.ui.toast('📀 It hit the corner!')
          }
          return { ...s, ...motion, color, corners }
        }),
      )
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const who = e.agentId === undefined ? '' : '↳ '
    const line = who + describe(e as unknown as Record<string, unknown>)
    await update($, activity, list => [...list, line].slice(-FEED_ROWS))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await stop($)
    return next(e)
  })

  // The spinner line ("Sauteing… (12s)") is drawn only while a turn runs, right
  // above the prompt. While the screensaver is on, it grows into a box filling
  // the terminal, the transcript scrolled up behind it, the spinner kept beneath.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const s = await read($, saver)
    if (!s.isOn || e.surface !== 'terminal') return next(e)

    const columns = e.viewport?.columns ?? 80
    const rows = e.viewport?.rows ?? 24
    const boxWidth = Math.max(LOGO_W + 2, columns - 1)
    const boxHeight = Math.max(LOGO_H + 2, rows - RESERVED_ROWS)
    // The logo's field: inside the border, above the divider and the feed.
    field = { w: boxWidth - 2, h: Math.max(LOGO_H, boxHeight - 2 - 1 - FEED_ROWS) }
    const feed = await read($, activity)

    const x = Math.min(s.x, Math.max(0, field.w - LOGO_W))
    const y = Math.min(s.y, Math.max(0, field.h - LOGO_H))
    const spinner = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box
          flexDirection="column"
          width={boxWidth}
          height={boxHeight}
          borderStyle="round"
          borderColor="gray"
        >
          <Box flexDirection="column" height={field.h}>
            <Box flexDirection="column" marginLeft={x} marginTop={y}>
              {s.maxX >= 0 && LOGO.map(line => (
                <Text color={COLORS[s.color]} bold wrap="truncate">
                  {line}
                </Text>
              ))}
            </Box>
          </Box>
          <Text color="gray">{'─'.repeat(field.w)}</Text>
          <Box flexDirection="column" height={FEED_ROWS}>
            {feed.length === 0 && <Text dimColor>Thinking…</Text>}
            {feed.map((line, i) => (
              <Text dimColor={i < feed.length - 1} wrap="truncate">
                {i === feed.length - 1 ? '▸ ' : '  '}
                {line}
              </Text>
            ))}
          </Box>
        </Box>
        {spinner}
      </Box>
    )
  })
}
