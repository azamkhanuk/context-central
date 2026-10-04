# Working on context-central

A Claude Code plugin: a CLI in `lib/`, two hooks, five skills and three agents. Terms are defined in `CONTEXT.md`; use them as written.

## Checks

- One test file: `node --test test/<name>.test.mjs`. All of them: `npm test`.
- Types: `npm run typecheck`. It must stay clean.
- Manifests: `claude plugin validate .` (a missing `version` warning is expected).
- Before any push: `node scripts/scan-names.mjs <names-file>`. It must exit 0.

## Public-safety rule

This repository is public-safe. Nothing in it, and no commit message, may name a client, an employer, a private person, a real ticket or a private path. Public products the plugin works with, such as GitHub and Jira, may be named. The one person named is the author: in `LICENSE`, in the two manifests and the test that pins them, and as the GitHub account in the install commands. Fixtures use the invented estate "acme" and keys like `PROJ-12`. The list of names to keep out lives outside the repository and is never committed.

## Conventions

- Every tracked text file is LF, pinned in `.gitattributes`.
- ESM `.mjs`, Node 20 or later, Node built-ins only. Flags are parsed with `parseArgs` from `node:util`.
- A command is `lib/commands/<name>.mjs` exporting `summary` and `run(args, io)`. The router finds it by file name; nothing registers it.
- `io` is `{ cwd, env, nodeVersion, out, err, readStdin }`. Commands never touch `process` directly.
- Expected failures throw `PluginError` (exit 1) or `UsageError` (exit 2) from `lib/errors.mjs`. Exit 0 means fine.
- `--json` on commands whose output a skill or script parses.
- The clock is `localDate(io.env)`; tests fix it with `CONTEXT_CENTRAL_NOW`.
- Config paths are POSIX, relative to the map directory (nodes) or the estate root (repos, hub).
- Hooks always exit 0 and print nothing when they have nothing to say. What they add is facts, never instructions.
- Skills set neither `model` nor `effort`; estate facts come from `context-central config --get`, never from skill text.
- `plugin.json` carries no `version`, so every commit is an update.
- No lockfile is committed. With a `package.json` and a lockfile at the plugin root, Claude Code runs an npm install in every user's plugin cache, and the plugin has no runtime dependencies.

## Tests

- Work test-first, one behaviour at a time.
- Test through the CLI as a process: `run()` and `hook()` in `test/helpers.mjs`, against a tree made with `acme()` or `makeTree()`. Never import a module under test.
- Expected values are literals or come from the fixture, never from re-running the code's own logic.
- The checks run on Linux, macOS and Windows. Build an expected path with `join`. A test that cannot run on a system is skipped there with its reason, through `notOnWindows` or `onlyOnWindows` in `test/helpers.mjs`.

## Writing

- Code needs no comments. One line only where the code cannot hold the reason. None in tests.
- Text a person or the model reads is plain British English, with no em dashes and no emojis.
