# DVD Screensaver for Claude Code

![The screensaver bouncing above the prompt while a turn runs, with the latest tool calls listed underneath](plugin/assets/demo.gif)

A Claude Code plugin for the terminal that brings back the classic bouncing
DVD-logo screensaver while a long turn runs. See [plugin/README.md](plugin/README.md)
for what it does and how to tune it.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install dvd-screensaver --marketplace sky0matic/claude-dvd-screensaver
```

Answer `y` to add the marketplace, then pick a scope. The screensaver draws in
the Claude Code terminal only.

## Repository layout

- `plugin/` is the plugin itself: what the marketplace installs and what the
  plugin directory reviews. Keep only what the plugin needs at runtime there,
  plus its tests.
- `.claude-plugin/marketplace.json` makes this repository a marketplace whose
  one plugin is `./plugin`.
- Everything else (`package.json`, `.githooks/`, `CLAUDE.md`, this README) is
  development tooling and is not part of the plugin.

## Develop it

```
git clone https://github.com/sky0matic/claude-dvd-screensaver
cd claude-dvd-screensaver
npm install
claude --plugin-dir ./plugin
```

`npm install` also turns on a git pre-commit hook that runs `npm run check`:
the type-check (`npm run typecheck`), the marketplace and plugin validation
(`npm run validate`) and the tests in `plugin/tests/` (`npm test`). The
type-check uses the types Claude Code writes into `plugin/.claude-plugin/types/`
when it loads the plugin, so start a session with `--plugin-dir ./plugin` once
before running it.

## License

MIT. See [LICENSE](LICENSE).
