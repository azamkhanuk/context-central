# Working on context-central

A plugin for Claude Code and, from 0.22.0, the GitHub Copilot command line: a CLI in `lib/`, two hooks, seven skills and five agents. The folder is a core that both hosts share, `bin/`, `lib/` and `skills/`, and a side for each host: Claude Code's is `.claude-plugin/`, `hooks/` and `agents/`, and Copilot's is `plugin.json` at the root and `com.github.copilot/`. `lib/host.mts` says which host a hook or a command runs under, and `lib/hosts/` holds each host's own names. Research alone is also a skill in the open skill format for any host. Terms are defined in `CONTEXT.md`; use them as written.

## Checks

- One test file: `node --test test/<name>.test.mts`. All of them: `npm test`.
- Types: `npm run typecheck`. It must stay clean.
- Manifests: `claude plugin validate .`. It must pass.
- Before any push: `node scripts/scan-names.mts <names-file>`. It must exit 0.

## Public-safety rule

This repository is public-safe. Nothing in it, and no commit message, may name a client, an employer, a private person, a real ticket or a private path. Public products the plugin works with, such as GitHub and Jira, may be named. The one person named is the author: in `LICENSE`, in the manifests and the tests that pin them, and as the GitHub account in the install commands and in the marketplace's name and address, which `lib/templates.mts` holds and the tests pin. Fixtures use the invented estate "acme" and keys like `PROJ-12`. The list of names to keep out lives outside the repository and is never committed.

## Conventions

- Every tracked text file is LF, pinned in `.gitattributes`.
- TypeScript in `.mts` files, checked in strict mode and run by Node as it is: nothing is compiled, and `tsc` only checks. So only syntax Node can strip: no `enum`, no `namespace`, no parameter properties, `import type` for a type, and imports that end in `.mts`.
- No `any` and no `@ts-` comments. A cast only where data comes in from outside: parsed JSON, flags, a caught error, the environment. A type lives beside the code that makes the thing.
- Node 22.18 or later, Node built-ins only. `bin/context-central` is the one JavaScript file: it has to run on a Node too old for the rest, to say so. Flags are parsed with `parseArgs` from `node:util`.
- A command is `lib/commands/<name>.mts` exporting `summary` and `run(args, io)`. The router finds it by file name; nothing registers it.
- `io` is `{ cwd, env, nodeVersion, out, err, readStdin }`. Commands never touch `process` directly.
- Expected failures throw `PluginError` (exit 1) or `UsageError` (exit 2) from `lib/errors.mts`. Exit 0 means fine.
- `--json` on commands whose output a skill or script parses.
- The clock is `localDate(io.env)`; tests fix it with `CONTEXT_CENTRAL_NOW`. The map lock alone reads the system's clock, since a lock folder's age is the file system's own time, which `CONTEXT_CENTRAL_NOW` cannot move.
- Config paths are POSIX, relative to the map directory (nodes) or the estate root (repos, hub, a repo's standards).
- The plugin holds no rule for any language, framework or build tool, in `lib/`, a skill or an agent. How a repo's code is written and checked comes from its own files, its standards note and its recorded checks.
- Hooks always exit 0 and print nothing when they have nothing to say. What they add is facts, never instructions, with one exception: where the host does not load the hub by itself, the session-start hook gives the hub's own text after the live index.
- Each host has a hooks file of its own: a program with its arguments for Claude Code, and for Copilot a shell line under Copilot's own event names. The hook program answers each host in the one shape it reads.
- A skill is one text for both hosts and names no host's file, command or tool. What differs by host is data in that host's file under `lib/hosts/`, which a command prints for the host it runs under: `context-central host` prints the parts of setting a map up, and the onboard skill shows them.
- An agent has a file for each host, with a head in that host's words and the same brief, which a test holds.
- A host's own names are written in its file under `lib/hosts/` and nowhere else in `lib/`. A hook is told its host by what Copilot names to a plugin's hooks, and a command by the mark each host sets for the commands a session runs, or by the copy that is running where both marks or neither are there.
- Skills set neither `model` nor `effort`; estate facts come from `context-central config --get`, never from skill text.
- A skill has a file of the map read and written at the path `context-central draft` prints, and put into the map by `context-central take`, never at a path it works out for itself: in a git work tree a host may keep a session's tools to the work tree.
- `.claude-plugin/plugin.json` carries the `version`, `plugin.json` at the root carries the same, which a test holds, and the marketplace entry carries none. People stay on a release until the version changes, so a change reaches them only through a release. On Copilot any change of the plugin's files is an update, so the author's marketplace pins the plugin to the branch `release`, which only the release job moves. Nobody works on that branch: a work branch comes from `main` and goes back to it.
- The plugin installs from its author's marketplace, a repository of its own that lists it. `lib/templates.mts` holds that marketplace's name and address, and a test holds the README and the install doc to them. The repository's own marketplace, named after the plugin, is for installing from a clone and for the copies installed from it before 0.14.0.
- No lockfile is committed. With a `package.json` and a lockfile at the plugin root, Claude Code runs an npm install in every user's plugin cache, and the plugin has no runtime dependencies.

## Releases

- A release is one pull request that raises `version` in `.claude-plugin/plugin.json` and in `plugin.json` at the root, and adds that version's section, dated, at the top of `CHANGELOG.md`. A test holds the two together.
- Once it is merged and the checks pass on `main`, `.github/workflows/release.yml` tags that commit `context-central--v<version>` and publishes the GitHub release, with that section of the changelog as its notes, and its last step runs `scripts/release-branch.mts`, which moves the branch `release` to the tagged commit and exits 1 where it cannot. `scripts/release-notes.mts` prints the tag, the title and the notes. A merge that does not raise the version publishes nothing.
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
