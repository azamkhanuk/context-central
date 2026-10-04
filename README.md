# context-central

A Claude Code plugin that gives all the context behind your work one central place: a map of the notes behind an estate of repositories.
It routes each task to the few notes that matter and keeps work in flight in small state files.
Long text (tickets, pull requests, threads) is saved in full behind those files and read only on request.

Needs Node 20 or later, on macOS or Linux (WSL included). No runtime dependencies.

## Install

From a shell:

```sh
claude plugin marketplace add azamkhanuk/context-central
claude plugin install context-central@context-central
```

Or both at once from inside a session (Claude Code v2.1.275 or later):

```
/plugin install context-central --marketplace azamkhanuk/context-central
```

The repository is its own marketplace. To try a local clone, give `claude plugin marketplace add` the path of the clone: the plugin then loads in place, and edits apply at the next session or `/reload-plugins`.

The manifest sets no `version`, so every commit is an update. `claude plugin update context-central@context-central` fetches the latest; auto-update is off by default for a marketplace you add yourself.

## First run

Start a session in the folder that holds your checkouts and run:

```
/context-central:onboard
```

It reads what it can from disk (repositories, instruction files, ticket keys in branch names, tools on `PATH`), asks only what is left unsettled in one pass, shows the draft settings, and writes the map. Restart or `/clear` afterwards so the hub loads.

## How a map is laid out

A map is a folder of Markdown with one settings file, `estate.json`. Two layouts:

- **Root**: `estate.json` sits at the estate root, above the checkouts. The map is the root itself.
- **Inner**: `estate.json` sits in `<repo>/.context-central/`. The map lives inside one repository, and the hub is that repository's own `CLAUDE.md` at its root, because that is the file Claude Code loads there. `init` adds one marked block to it and leaves the rest as it is.

```
<estate root>/
  estate.json          settings: repos, tracker, folders left alone, budgets
  CLAUDE.md            the hub: routing table, standing rules, where the parts are
  glossary.md          the estate's own terms
  repos/ areas/ concepts/ edges/ decisions/ docs/    nodes, one subject per file
  log/2026-01.md       dated one-line notes
  work/<item>/
    STATE.md           where the item stands and what is next
    SPEC.md            what is being built
    notes/             research and working notes
    sources/           full text of tickets, PRs, threads: the deep tier
    evidence/          files that are not text: screenshots, recordings, exports
  bin/context-central   optional launcher for use outside a session
  web/ api/ ...        the checkouts, registered in estate.json
```

A work item is named by a ticket key (`PROJ-12`) or a plain name (`portal-split`). Nodes link to each other with wiki links (`[[concepts/gateway]]`) or relative Markdown links.

## The three tiers

What loads, and when, is decided by tier. Budgets are settings under `budgets` in `estate.json`; `context-central lint` reports anything over.

| Tier | Holds | How it reaches the session | Budget (default) |
|---|---|---|---|
| Always loaded | the hub | Claude Code loads it at launch | `hubLines`: 200 lines, imports included |
| Always loaded | the live index: one line per work item in flight | the session-start hook | `indexChars`: 2,000 characters |
| Read when named | a work item's state file | resolver pointer; delivered again after compaction | `stateChars`: 10,000 characters |
| Read when named | nodes and work notes | resolver pointers, at most `resolveMax` (6) after the entry file | `nodeBytes`: 20,000 bytes, a soft cap |
| Deep | everything under `sources/`, and files named `*-full-text.md` | by path only, counted but never listed one by one | none |
| Evidence | every file under a work item's `evidence/` | by path only, counted and never opened | `evidenceBytes`: 1 MB a file, checked only where evidence is committed |

Two more budgets shape what the hooks do:

| Budget | Default | What it sets |
|---|---|---|
| `hookTextChars` | 600 characters | The longest prompt the hook matches on its words |
| `resumeNoticeTokens` | 100,000 tokens | The session size from which the resume notice is shown; 0 turns it off |

Two rules keep it honest. Every brief names the full-text file behind it. Status goes in state files, never in the hub.

Evidence is a file that is not text and shows what was seen: a screenshot, a recording, an export. It sits in `work/<item>/evidence/<YYYY-MM-DD>-<what>.<ext>`, lower case with dashes, and a note names it, by custom `notes/<YYYY-MM-DD>-evidence.md`. `context-central evidence add` copies a file into place under such a name. Text a session can read stays in the deep tier. `evidence.commit` in `estate.json` records whether evidence is committed and is read as false when absent. `graph` reports an evidence file no note names, `lint` warns on a file in a work item that is neither Markdown nor under `evidence/`, and `doctor` says when git and the setting disagree.

## What the hooks put in context

**At session start** (startup, resume, clear, compaction, fork): the live index. It names the map, the hub, and each work item in flight with its title and state file. After compaction or on resume, the state file of the item the session was working on follows the index. The whole text is cut at 9,500 characters.

**When a prompt is submitted**: pointers, when the prompt names something the map knows. First match wins:

1. a work item, by ticket key or by name, or else by its name written with spaces or its title word for word
2. a GitHub pull request link recorded in a work item, or whose repository has a note
3. a registered repository name
4. free text that matches a node on at least two words with a clear score

On the command line `resolve` has one more route after free text: when two or more words of the query all sit in the name and title of one work item, and of no other, the answer is that item. The hook never uses it.

The pointers are a short list of paths with sizes and a reason each, plus a count of the deep files and of the evidence behind the item. They are facts, never instructions. Each answer is delivered once per session.

A prompt longer than `budgets.hookTextChars` (600 characters) is matched only on work item keys and names, PR links and repo names, not on its words, a title or a name written with spaces: a pasted log or diff would match those by chance.

**When a large session resumes with an expired cache**: a notice to the person, not to the model. If Claude Code reports that the prompt cache has likely expired and the session holds at least `budgets.resumeNoticeTokens` (100,000) tokens, the hook shows one line giving the size and saying that a fresh session started from the work item's state file is cheaper.

**The hooks stay silent** when:

- no map covers the session's folder
- the working directory is inside a different map
- the folder is outside the estate, under a `leftAlone` entry, or not a registered repo or node folder
- the prompt matches nothing with confidence
- the same answer was already delivered in this session

If `estate.json` is invalid, the person sees a one-line message and the model sees nothing. The resolver makes no network call.

## Commands

Inside a session the plugin puts `context-central` on the Bash tool's `PATH`. Exit codes: 0 fine, 1 a problem was found, 2 wrong usage.

| Command | What it does |
|---|---|
| `config [--get <key>]` | Print the estate settings, or one of them by dotted key |
| `where [--json]` | Show which map covers this folder and whether the hooks answer here |
| `work new\|list\|done\|reopen` | Create a work item with its state file, list work in flight, mark an item done or reopen it |
| `resolve <query...> [--max N] [--json] [--absolute]` | List the notes behind a work item, PR link, repo name or free text |
| `index [--absolute] [--json]` | Print the live index of work in flight |
| `hook <session-start\|user-prompt-submit>` | The hook entry point: JSON on stdin, JSON on stdout |
| `graph [--json] [--strict]` | Report broken links, orphan nodes, and deep files and evidence nothing points to |
| `lint [--json] [--strict]` | Check the hub, state files, nodes, evidence and index against their budgets |
| `doctor [--json]` | Check the setup: Node, settings, hub, lint, links, repo folders, git ignore rules, evidence against git, legacy hooks, `gh` |
| `note <text...>` | Append a dated line to this month's log |
| `note --new <kind>/<name> [--title <title>]` | Create a node from a small template |
| `slice <file> --toc\|--heading\|--lines\|--grep` | Read part of a large file: its headings, one section, a line range, or matches with context |
| `fetch pr\|issue <ref> --item <item> [--repo <owner/name>]` | Save the full text of a GitHub PR or issue under the item's `sources/`, then print a digest |
| `evidence add <file> --item <item> [--as <what>]` | Copy a file that is not text into the item's `evidence/` under a dated, cleaned name, never overwriting |
| `detect [dir] [--json]` | Report what can be read from disk before asking anyone: repos, instruction files, key patterns, tools |
| `init [dir] --from <answers.json> [--dry-run]` | Write a new map from an answers file, never overwriting |
| `init --print-settings` | Print the settings that enable the plugin for a map |
| `wrapper [--write]` | Print or save a launcher for running the CLI from a terminal |
| `budget [dir] [--json]` | Show what a session started in a folder loads at launch from instruction files |

`doctor` prints one line per check, `ok` or `FIX` with what to do, and exits 1 if anything needs fixing. Its hooks check looks for hooks from an earlier tool that would resolve the same prompts a second time. Name them in `estate.json`, for example `"legacyHooks": ["old-resolver.mjs"]`; the list is empty by default and the check then passes. A hook command that contains one of those strings counts when it is in the estate's own `.claude/settings.json` or `.claude/settings.local.json`, or in your user settings and pointing at this estate's root.

## Skills

Typed with the plugin prefix. The first four run only when you invoke them; `checkpoint` may also be picked up by the model.

| Skill | What it does |
|---|---|
| `/context-central:onboard` | Detects the estate, asks what is unsettled, writes the map, runs `doctor` |
| `/context-central:research <question> [item]` | Researches from primary sources, marks each claim verified or inferred, writes a note |
| `/context-central:prep <item>` | Turns the conversation and research into the item's `SPEC.md` and a short tracker brief |
| `/context-central:implement <item>` | Builds from the state file and spec, one slice at a time, following the estate's settings for tests and review |
| `/context-central:checkpoint` | Writes the session back: state file, lasting lessons, log line, then `lint` and `graph` |

## Agents

| Agent | What it does |
|---|---|
| `context-central:reader` | Reads the paths it is given and returns short findings with `path:line` references. Does not load `CLAUDE.md` |
| `context-central:fetcher` | Fetches one ticket, PR, thread or meeting, saves the full text to `sources/` first, returns a digest and the path. Only reads from external systems |
| `context-central:reviewer` | Reviews a diff against the spec and the estate's standing rules. Never edits |

## Working from a terminal

Outside a session the CLI is not on your `PATH`, so the map can hold a small `sh` launcher. Write it once, in either of two ways:

- from inside a Claude Code session in the map, ask Claude to run `context-central wrapper --write`
- from a terminal in the map, run `node <plugin folder>/bin/context-central wrapper --write`

The launcher is saved as `bin/context-central` in the map; with a map inside a repository that is `.context-central/bin/context-central`. It finds the installed plugin through Claude Code's install record and passes every argument through:

```sh
./bin/context-central work list
./bin/context-central doctor
```

When the plugin is enabled from project settings there is no install record. Set `CONTEXT_CENTRAL_CLI` to the path of the plugin's `bin/context-central` file and the launcher uses that.

## Two accounts on one machine

A plugin installed at user scope belongs to one Claude Code config directory. If you switch accounts by config directory, enable the plugin from the map's project settings instead, so whichever account opens the map gets it:

```sh
context-central init --print-settings
```

Put the printed JSON in the map's `.claude/settings.json` (shared with everyone who clones the map) or `.claude/settings.local.json` (this machine only). It declares the marketplace, enables `context-central@context-central`, and allows `Bash(context-central *)`. The command only prints: `.claude/` is a protected path, so the write is yours to approve. Claude Code applies project settings after you accept the trust prompt for the folder.

## Turning it off

- **In one folder**: add it to `leftAlone` in `estate.json`. The hooks stay silent there.
- **On one machine, for a map that enables it**: set `"context-central@context-central": false` under `enabledPlugins` in the map's `.claude/settings.local.json`.
- **For your account**: `claude plugin disable context-central@context-central`.
- **For good**: `claude plugin uninstall context-central@context-central`.

The map is plain Markdown and stays readable without the plugin.

## What it does not do

- It does not post to a tracker or a code host. The fetcher only reads; anything written outside the map is yours to approve.
- It fetches from the command line through `gh` only (GitHub PRs and issues). Other trackers are reached through whatever tools your session already has, by the route recorded in `estate.json`.
- It does not link or copy nodes into the checkouts. Nodes are reached by pointer.
- It does not ingest meetings, ship workflows, or include evals.
- It does not judge whether a note is true. `lint` and `graph` check size and links, nothing more.
- It does not run on Windows outside WSL.
- It ships a `bin/` folder, so claude.ai and Cowork do not install it. It is for Claude Code.

## Licence

MIT. See `LICENSE`.
