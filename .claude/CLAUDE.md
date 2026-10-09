# Working on context-central

A Claude Code plugin: a CLI in `lib/`, two hooks, seven skills and three agents. Terms are defined in `CONTEXT.md`; use them as written.

## Checks

- One test file: `node --test test/<name>.test.mts`. All of them: `npm test`.
- Types: `npm run typecheck`. It must stay clean.
- Manifests: `claude plugin validate .`. It must pass.
- Before any push: `node scripts/scan-names.mts <names-file>`. It must exit 0.

## Public-safety rule

This repository is public-safe. Nothing in it, and no commit message, may name a client, an employer, a private person, a real ticket or a private path. Public products the plugin works with, such as GitHub and Jira, may be named. The one person named is the author: in `LICENSE`, in the two manifests and the test that pins them, and as the GitHub account in the install commands. Fixtures use the invented estate "acme" and keys like `PROJ-12`. The list of names to keep out lives outside the repository and is never committed.

## Conventions

- Every tracked text file is LF, pinned in `.gitattributes`.
- TypeScript in `.mts` files, checked in strict mode and run by Node as it is: nothing is compiled, and `tsc` only checks. So only syntax Node can strip: no `enum`, no `namespace`, no parameter properties, `import type` for a type, and imports that end in `.mts`.
- No `any` and no `@ts-` comments. A cast only where data comes in from outside: parsed JSON, flags, a caught error, the environment. A type lives beside the code that makes the thing.
- Node 22.18 or later, Node built-ins only. `bin/context-central` is the one JavaScript file: it has to run on a Node too old for the rest, to say so. Flags are parsed with `parseArgs` from `node:util`.
- A command is `lib/commands/<name>.mts` exporting `summary` and `run(args, io)`. The router finds it by file name; nothing registers it.
- `io` is `{ cwd, env, nodeVersion, out, err, readStdin }`. Commands never touch `process` directly.
- Expected failures throw `PluginError` (exit 1) or `UsageError` (exit 2) from `lib/errors.mts`. Exit 0 means fine.
- `--json` on commands whose output a skill or script parses.
- The clock is `localDate(io.env)`; tests fix it with `CONTEXT_CENTRAL_NOW`.
- Config paths are POSIX, relative to the map directory (nodes) or the estate root (repos, hub, a repo's standards).
- The plugin holds no rule for any language, framework or build tool, in `lib/`, a skill or an agent. How a repo's code is written and checked comes from its own files, its standards note and its recorded checks.
- Hooks always exit 0 and print nothing when they have nothing to say. What they add is facts, never instructions.
- Skills set neither `model` nor `effort`; estate facts come from `context-central config --get`, never from skill text.
- `plugin.json` carries the `version` and the marketplace entry carries none. People stay on a release until the version changes, so a change reaches them only through a release.
- No lockfile is committed. With a `package.json` and a lockfile at the plugin root, Claude Code runs an npm install in every user's plugin cache, and the plugin has no runtime dependencies.

## Releases

- A release is one pull request that raises `version` in `.claude-plugin/plugin.json` and adds that version's section, dated, at the top of `CHANGELOG.md`. A test holds the two together.
- Once it is merged and the checks pass on `main`, `.github/workflows/release.yml` tags that commit `context-central--v<version>` and publishes the GitHub release, with that section of the changelog as its notes. `scripts/release-notes.mts` prints the tag, the title and the notes. A merge that does not raise the version publishes nothing.
- By hand, the same is `claude plugin tag --push` on `main`, then `gh release create <tag> --verify-tag`.

## Tests

- Work test-first, one behaviour at a time.
- Test through the CLI as a process: `run()` and `hook()` in `test/helpers.mts`, against a tree made with `acme()` or `makeTree()`. Never import a module under test.
- Expected values are literals or come from the fixture, never from re-running the code's own logic.
- A skill or an agent is tested where it meets the CLI: its frontmatter, and each command, flag, setting, file or printed line it names. Its wording is not pinned by a test: what a session does with it is shown by a run.
- The checks run on Linux, macOS and Windows. Build an expected path with `join`. A test that cannot run on a system is skipped there with its reason, through `notOnWindows` or `onlyOnWindows` in `test/helpers.mts`.

## Writing

- Code needs no comments. One line only where the code cannot hold the reason. None in tests.
- Text a person or the model reads is plain British English, with no em dashes and no emojis.
- The README is the short version: what the plugin does, the install and the five steps. The detail of each part is in its own file under `docs/`, which the README links, and new detail goes there. A test holds the links.
