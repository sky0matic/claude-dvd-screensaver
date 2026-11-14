import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const SPINNER = {
  plugin: 'dvd-screensaver',
  surface: 'terminal',
  component: 'Spinner',
  props: { word: 'Crunching', message: null, suffix: '', mode: 'responding' },
} as const

/** The engine beneath the plugin: turns and tool calls answer plainly. */
function engine(on: On) {
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))
}

const TURN = { text: 'go', turnId: 't1' }
const DONE = {
  ...TURN,
  answer: '',
  durationMs: 0,
  isAborted: false,
  reason: 'answer',
} as const

test('nothing shows before the delay', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)

  await $.turn.start(TURN)
  await clock.advance(14_000)

  const ui = await $.ui.mount(SPINNER)
  expect(await ui.find({ type: 'Text', text: /VIDEO/ })).toBeUndefined()
  await ui.unmount()
})

test('the logo bounces once a turn runs long, and goes when it ends', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)

  await $.turn.start(TURN)
  await clock.advance(15_000 + 120 * 3)

  const ui = await $.ui.mount(SPINNER)
  expect(await ui.find({ type: 'Text', text: /VIDEO/ })).toBeDefined()
  await ui.unmount()

  await $.turn.complete(DONE)
  const after = await $.ui.mount(SPINNER)
  expect(await after.find({ type: 'Text', text: /VIDEO/ })).toBeUndefined()
  await after.unmount()
})

test('a subagent turn does not start the screensaver', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)

  await $.turn.start({ ...TURN, agentId: 'a1' })
  await clock.advance(20_000)

  const ui = await $.ui.mount(SPINNER)
  expect(await ui.find({ type: 'Text', text: /VIDEO/ })).toBeUndefined()
  await ui.unmount()
})

test('tool calls show in the feed under the logo', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)

  await $.turn.start(TURN)
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a.txt' })
  await clock.advance(15_000 + 120 * 3)

  const ui = await $.ui.mount(SPINNER)
  expect(await ui.find({ type: 'Text', text: /Bash: ls -la/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Read: \/tmp\/a\.txt/ })).toBeDefined()
  await ui.unmount()
})

test('a tool call still runs when the feed cannot be saved', async ($, on) => {
  engine(on)
  on('state.set', () => {
    throw new Error('state is down')
  })

  const result = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(result.isError ?? false).toBe(false)
})
