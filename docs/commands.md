# Commands, skills and agents

What the plugin adds besides its two hooks: the `context-central` command, seven skills and three agents. The hooks are in [What the hooks put in context](hooks.md).

## Commands

Inside a session the plugin puts `context-central` on the Bash tool's `PATH`. [Working from a terminal](terminal.md) says how to run it outside one.

Exit codes: 0 fine, 1 a problem was found, 2 wrong usage.

- **A fault the command did not expect** is one line on standard error and exit 1: `context-central <command>: <what failed, with the path and the system's code>. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.` With that variable set the trace follows the line.
- **A command that changes the map holds the map's lock for the write.** One that cannot get it within five seconds says `the map is being written by another command, and still was after 5 seconds, so nothing was written; run this again`, writes nothing and exits 1. A lock left by a process that died is taken over once it is thirty seconds old.
- **A command whose reader has closed the pipe**, as in `context-central graph | head -1`, ends quietly with exit 0.

| Command | What it does |
|---|---|
| `help`, `--help`, `-h` | List the commands with a line each, and `--version` last; `<command> --help` gives that command's line |
| `--version` | Print the release, the Node it runs on and the system, in one line. Given after a command it is that command's own flag |
| `config [--get <key>]` | Print the estate settings, or one of them by dotted key |
| `where [--json]` | Show which map covers this folder, where the estate's glossary is and whether the hooks answer here, and in a git work tree the work tree, its main checkout and the drafts folder |
| `work new <item> [--title <title>] [--ticket "<reference>"]\|list [--all] [--json]\|done <item>\|reopen <item>\|adopt <item>\|adopt --all` | Create a work item with its state file, its title and its ticket; list work in flight, or with `--all` every item, as JSON with `--json`; mark an item done or reopen it; give an older item, or with `--all` every one, a state file beside its own note |
| `resolve <query...> [--max N] [--json] [--absolute]` | List the notes behind a work item, a link, a repo name or free text, or else the node an identifier or a name finds, the glossary for a term or the notes that mention a code name, and say which ticket named has no work item |
| `index [--absolute] [--json]` | Print the live index of work in flight |
| `hook <session-start\|user-prompt-submit>` | The hook entry point: JSON on stdin, JSON on stdout. It always exits 0, and a failure is one line for the person. Claude Code gives it 15 seconds at session start and 10 at a prompt |
| `graph [--json] [--strict]` | Report broken links, orphan nodes, and deep files and evidence nothing points to |
| `lint [--json] [--strict]` | Check the hub, state files, nodes, evidence and index against their budgets, and that each repo's standards files and a glossary the estate names exist. An entry of the map that cannot be read is an error too, `read: <path> <why>, so the listings pass over it`: a folder or a note with no permission, a link that leads nowhere where a note would be listed, a folder where a note would be read. Nothing under a folder `notNodes` lists is one |
| `doctor [--json]` | Check the setup: Node, settings, hub, lint, links, repo folders, git ignore rules, note folders against git, evidence against git, drafts left in work trees, legacy hooks, copies of the plugin loaded twice, connections |
| `note <text...>` | Append a dated line to this month's log |
| `note --new <kind>/[<folder>/]<name> [--title <title>]` | Create a node from a small template, in a folder below its kind when one is given |
| `draft <path>...` | Print the file to use for each file of the map named: the map's own, or in a git work tree a draft at the same place under the work tree, copied from the map's file where there is one and kept up to date until it is edited. For a file the map does not hold yet it makes the folder in the work tree and writes no file. A path is counted from the map's folder, or is an absolute path inside it |
| `take [--over <path>]...` | Put the work tree's drafts into the map and remove them from the work tree. A draft is kept, with the reason, where the map's file changed after it was drafted or the map holds the file and the draft was not made from it; beside it `take` leaves a copy of the map's file as it now is, to compare with, and `--over` takes the draft once the two are compared. A draft that is in the map and cannot then be removed is kept too, in a line of its own, and the drafts after it are still taken. Two work trees that take a draft of one file at the same moment end with one `took` and one `kept`. In the main checkout there is nothing to take |
| `slice <file> --toc\|--heading <text>\|--lines <a>-<b>\|--grep <regex> [--context N] [--max-bytes N]` | Read part of a large file: its headings, one section, a line range, or matches with `--context` lines around each (2). The output is cut at `--max-bytes` (20,000) |
| `fetch ticket\|pr "<reference>" --item <item> [--connection <name>] [--repo <repo>]` | Read a ticket or a pull request with the command of its connection's preset, save the full text under the item's `sources/`, then print a digest. With no reference, `fetch ticket --item <item>` reads the item's own ticket. `--check` in place of `--item` tries the connection and saves nothing |
| `connections [--ticket "<reference>"\|--pr "<reference>"\|--item <item>] [--json]` | List the connections and how this machine reaches each. With a ticket, a pull request or a work item named, only the connection it belongs to: one of the three at a time, since they do not combine. `connections --presets [--json]` lists the presets this version carries and what each takes |
| `evidence add <file> --item <item> [--as <what>]` | Copy a file into the item's `evidence/` under a dated, cleaned name, never overwriting. The folder is for what is not text, and the command takes any file and never opens one |
| `standards [<repo>] [--json]` | Print a repo's standards files as absolute paths, its standards note first and marked, with a mark on one that is missing or a folder, and its recorded checks with the folder they run from, which in a git work tree of the repo is the work tree |
| `detect [dir] [--json]` | Report what can be read from disk before asking anyone: whether the folder is a git work tree, repos, instruction files, key patterns, tools, accounts and connection candidates |
| `init [dir] --from <answers.json> [--dry-run]` | Write a new map from an answers file, never overwriting |
| `init [dir] --plain [--dry-run]` | Write a plain map with no answers file, never overwriting: inside a repository the map in `.context-central/` with its hub in `CLAUDE.local.md`, both named in the checkout's own `.git/info/exclude` so that git shows nothing new, and from a git work tree in the main checkout; in a folder that holds checkouts the root layout with each registered. It records no connection. It refuses a repository where git tracks `CLAUDE.local.md`. `--dry-run` lists every file it would write or change and writes nothing |
| `init --print-settings` | Print the settings that enable the plugin for a map, with auto-update on for its marketplace |
| `wrapper [--write]` | Print a launcher for running the CLI from a terminal, or save it in the map with one for cmd. A launcher already there is kept, and said to differ when it is not the one this release writes |
| `budget [dir] [--json]` | Show what a session started in a folder loads at launch from instruction files |

About `doctor`:

- It prints one line per check: `ok`, `FIX` with what to do, or `note` with something worth knowing. It exits 1 only if something needs fixing.
- With no `git` on the `PATH`, the four checks that ask git (git, notes, evidence and work trees) each say as a `note` that they were not checked, and the others decide the exit code.
- Its lint check says `FIX` where `lint` has an error, an entry of the map that cannot be read among them.
- Its connections check holds one thing to be a fault: a pinned account that the tool cannot run as here. Another account being active is a note where the tool holds the pinned one. A tool that is not installed, and a map with no connection, are notes too.
- Its work trees check names each git work tree of the map's checkout in which drafts wait, with how many, and says when the map itself sits in a work tree where git ignores it. [In a git work tree](map.md#in-a-git-work-tree) says what a draft is.
- Its hooks check looks for hooks from an earlier tool that would resolve the same prompts a second time.
- Name those hooks in `estate.json`, for example `"legacyHooks": ["old-resolver.mjs"]`. The list is empty by default, and the check then passes.
- A hook command that contains one of those strings counts when it is in the estate's own `.claude/settings.json` or `.claude/settings.local.json`, or in your user settings and pointing at this estate's root.
- Its copies check says `FIX` where more than one copy of the plugin loads in the estate's folder, as with `context-central@azamkhanuk` and the `context-central@context-central` installed before 0.14.0. A copy loads where it is installed for you or for that folder, and the settings that apply there enable it. Each hook would run once for each copy. The fix names the uninstall command for every copy but the one from the author's marketplace.
- A copy installed for you can be kept off in one folder: `"context-central@context-central": false` under `enabledPlugins` in that folder's `.claude/settings.json` turns it off for everyone who opens the map there, except a person whose own `.claude/settings.local.json` turns it back on.

## Skills

Typed with the plugin prefix. All but the last run only when you invoke them; `checkpoint` may also be picked up by the model. The five that do the work are walked through in [A piece of work, step by step](step-by-step.md). Every skill ends on a [closing answer](step-by-step.md#how-every-step-ends) in four groups.

| Skill | What it does |
|---|---|
| `/context-central:onboard` | Detects the estate, asks what is unsettled, writes the map, proves each connection, runs `doctor` |
| `/context-central:standards <repo>` | Drafts one repo's standards note and its checks from what the repo declares, asks what is unsettled, writes both on your yes |
| `/context-central:research <question> [item]` | Researches from primary sources, sorts each claim into one of four groups and marks how it is known, writes a note laid out in them, and links a note that has no item from the note of each repo it is about |
| `/context-central:prep <item>` | Reads the item's ticket, then turns the conversation and research into the item's `SPEC.md` and a short tracker brief, or revises the spec that is there |
| `/context-central:design <item>` | Reads the spec, the repo's standards and the code, and writes the item's `DESIGN.md`: the modules, their interfaces, each choice with its reason, the slices in order, the checks beyond this machine and what is cut if time is short. Optional, and approved by starting the build |
| `/context-central:implement <item>` | Builds from the state file, the spec and the design when there is one, one slice at a time, following the estate's settings for tests and review, the repo's standards and its recorded checks. Stops and asks when the last review round allowed, the third unless set, still brings a finding to fix, or when a slice or a fix shows the spec or the design wrong |
| `/context-central:checkpoint` | Writes the session back: state file, lasting lessons, the session's terms in the glossary, the rules you stated in the repo's standards note, log line, then `lint` and `graph` |

## Agents

| Agent | What it does |
|---|---|
| `context-central:reader` | Reads the paths it is given and returns short findings with `path:line` references. Does not load `CLAUDE.md` |
| `context-central:fetcher` | Fetches one ticket, PR, thread or meeting through the connection it is given, saves the full text to `sources/` first, returns a digest and the path. Only reads from external systems, and does not load `CLAUDE.md` |
| `context-central:reviewer` | Reviews a diff against the spec, the estate's standing rules, and the design and the repo's standards files when it is given them; where the rules disagree it holds the diff to neither and reports the disagreement. Never edits |
