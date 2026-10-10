# Commands, skills and agents

What the plugin adds besides its two hooks: the `context-central` command, seven skills and three agents. The hooks are in [What the hooks put in context](hooks.md).

## Commands

Inside a session the plugin puts `context-central` on the Bash tool's `PATH`. [Working from a terminal](terminal.md) says how to run it outside one.

Exit codes: 0 fine, 1 a problem was found, 2 wrong usage.

| Command | What it does |
|---|---|
| `config [--get <key>]` | Print the estate settings, or one of them by dotted key |
| `where [--json]` | Show which map covers this folder, where the estate's glossary is and whether the hooks answer here |
| `work new <item> [--title <title>] [--ticket "<reference>"]\|list [--all]\|done <item>\|reopen <item>\|adopt <item>\|adopt --all` | Create a work item with its state file, its title and its ticket; list work in flight, or with `--all` every item; mark an item done or reopen it; give an older item, or with `--all` every one, a state file beside its own note |
| `resolve <query...> [--max N] [--json] [--absolute]` | List the notes behind a work item, a link, a repo name or free text, or else the node an identifier or a name finds or the glossary for a term, and say which ticket named has no work item |
| `index [--absolute] [--json]` | Print the live index of work in flight |
| `hook <session-start\|user-prompt-submit>` | The hook entry point: JSON on stdin, JSON on stdout |
| `graph [--json] [--strict]` | Report broken links, orphan nodes, and deep files and evidence nothing points to |
| `lint [--json] [--strict]` | Check the hub, state files, nodes, evidence and index against their budgets, and that each repo's standards files and a glossary the estate names exist |
| `doctor [--json]` | Check the setup: Node, settings, hub, lint, links, repo folders, git ignore rules, note folders against git, evidence against git, legacy hooks, connections |
| `note <text...>` | Append a dated line to this month's log |
| `note --new <kind>/[<folder>/]<name> [--title <title>]` | Create a node from a small template, in a folder below its kind when one is given |
| `slice <file> --toc\|--heading <text>\|--lines <a>-<b>\|--grep <regex> [--context N] [--max-bytes N]` | Read part of a large file: its headings, one section, a line range, or matches with `--context` lines around each (2). The output is cut at `--max-bytes` (20,000) |
| `fetch ticket\|pr "<reference>" --item <item> [--connection <name>] [--repo <repo>]` | Read a ticket or a pull request with the command of its connection's preset, save the full text under the item's `sources/`, then print a digest. With no reference, `fetch ticket --item <item>` reads the item's own ticket. `--check` in place of `--item` tries the connection and saves nothing |
| `connections [--ticket\|--pr "<reference>"] [--item <item>] [--json]` | List the connections and how this machine reaches each. With a ticket, a pull request or a work item named, only the connection it belongs to. `connections --presets [--json]` lists the presets this version carries and what each takes |
| `evidence add <file> --item <item> [--as <what>]` | Copy a file that is not text into the item's `evidence/` under a dated, cleaned name, never overwriting |
| `standards [<repo>] [--json]` | Print a repo's standards files as absolute paths, its standards note first and marked, with a mark on one that is missing or a folder, and its recorded checks with the folder they run from |
| `detect [dir] [--json]` | Report what can be read from disk before asking anyone: repos, instruction files, key patterns, tools, accounts and connection candidates |
| `init [dir] --from <answers.json> [--dry-run]` | Write a new map from an answers file, never overwriting |
| `init --print-settings` | Print the settings that enable the plugin for a map, with auto-update on for its marketplace |
| `wrapper [--write]` | Print a launcher for running the CLI from a terminal, or save it in the map with one for cmd. A launcher already there is kept, and said to differ when it is not the one this release writes |
| `budget [dir] [--json]` | Show what a session started in a folder loads at launch from instruction files |

About `doctor`:

- It prints one line per check: `ok`, `FIX` with what to do, or `note` with something worth knowing. It exits 1 only if something needs fixing.
- Its connections check holds one thing to be a fault: a pinned account that the tool cannot run as here. Another account being active is a note where the tool holds the pinned one. A tool that is not installed, and a map with no connection, are notes too.
- Its hooks check looks for hooks from an earlier tool that would resolve the same prompts a second time.
- Name those hooks in `estate.json`, for example `"legacyHooks": ["old-resolver.mjs"]`. The list is empty by default, and the check then passes.
- A hook command that contains one of those strings counts when it is in the estate's own `.claude/settings.json` or `.claude/settings.local.json`, or in your user settings and pointing at this estate's root.

## Skills

Typed with the plugin prefix. All but the last run only when you invoke them; `checkpoint` may also be picked up by the model. The five that do the work are walked through in [A piece of work, step by step](step-by-step.md).

| Skill | What it does |
|---|---|
| `/context-central:onboard` | Detects the estate, asks what is unsettled, writes the map, proves each connection, runs `doctor` |
| `/context-central:standards <repo>` | Drafts one repo's standards note and its checks from what the repo declares, asks what is unsettled, writes both on your yes |
| `/context-central:research <question> [item]` | Researches from primary sources, marks each claim verified or inferred, writes a note |
| `/context-central:prep <item>` | Reads the item's ticket, then turns the conversation and research into the item's `SPEC.md` and a short tracker brief |
| `/context-central:design <item>` | Reads the spec, the repo's standards and the code, and writes the item's `DESIGN.md`: the modules, their interfaces, each choice with its reason, the slices in order, the checks beyond this machine and what is cut if time is short. Optional, and approved by starting the build |
| `/context-central:implement <item>` | Builds from the state file, the spec and the design when there is one, one slice at a time, following the estate's settings for tests and review, the repo's standards and its recorded checks. Stops and asks when the last review round allowed, the third unless set, still brings a finding to fix |
| `/context-central:checkpoint` | Writes the session back: state file, lasting lessons, the session's terms in the glossary, the rules you stated in the repo's standards note, log line, then `lint` and `graph` |

## Agents

| Agent | What it does |
|---|---|
| `context-central:reader` | Reads the paths it is given and returns short findings with `path:line` references. Does not load `CLAUDE.md` |
| `context-central:fetcher` | Fetches one ticket, PR, thread or meeting through the connection it is given, saves the full text to `sources/` first, returns a digest and the path. Only reads from external systems, and does not load `CLAUDE.md` |
| `context-central:reviewer` | Reviews a diff against the spec, the estate's standing rules, and the design and the repo's standards files when it is given them; where the rules disagree it holds the diff to neither and reports the disagreement. Never edits |
