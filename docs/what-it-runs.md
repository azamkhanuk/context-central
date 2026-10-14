# What it runs, what it writes and how to remove it

Everything the plugin starts on your machine, every place it writes outside the map, and how to take all of it away again. The [README](../README.md#what-it-runs) has the short version.

## What it runs

The plugin is a command, `context-central`, which Node runs as it is. Nothing is compiled, nothing is installed beside it, and it has no dependencies to download.

**The two hooks.** Claude Code starts each as `node <plugin folder>/bin/context-central hook <event>`, with no shell.

- At every session start, resume, clear, compaction and fork, with a limit of 15 seconds.
- At every prompt you submit, with a limit of 10 seconds.
- A hook reads the map's settings, its notes and the session's own record, and prints a few lines for the session. It writes nothing but that record.
- In a git work tree a hook may start `git` once, to tell a draft in the work tree from a file that git tracks there. It starts nothing else.
- Past its limit Claude Code cancels a hook and the session goes on without what it would have added.

**The commands.** A command runs when a session or you type it. [Commands, skills and agents](commands.md) lists them.

- `draft`, `take`, `work done`, `work reopen`, `doctor` and `detect` start `git`, to read what it tracks and ignores, and in a git work tree any command may start it once, to tell a draft from a file git tracks there. `init --plain` starts it once inside a repository that has no map yet, to learn whether git tracks `CLAUDE.local.md`. None of them commits, pushes or changes a branch.
- `fetch` starts the tool of a connection's preset to read one ticket or one pull request: `gh`, `acli` or `az`. `doctor`, `connections` and `detect` start the same tool to ask which accounts are signed in. Each runs under your own sign-in. Where a connection pins an account that is not the active one, the plugin asks the tool for that account's token and hands it to the tool for that one read: it never prints a token and never saves one.
- The plugin itself opens no network connection and sends nothing anywhere. What reaches the network is the tool a preset starts, and only for a read. Its own commands never post to a tracker or a code host.
- To find the checkout they are in, `init --plain` and the two hooks read `.git` themselves where they can, and start no program for that.

**The skills and the agents.** A skill is a set of instructions the session follows, and an agent is a session it starts for one job. What they run is what your session is allowed to run: `context-central`, `git`, and in a build the checks your repo recorded. A skill posts to a tracker or a code host only where your write rules allow it and you approve the exact text.

**The launcher.** `wrapper --write` saves a small script in the map so that the command can be typed in a terminal. It finds the installed plugin through Claude Code's own install record and starts it with Node. [Working from a terminal](terminal.md) has the detail.

## What it writes outside the map

The map is where the plugin writes: `.context-central/` inside a repository, or the folders of the root layout. These are the places beyond it.

| Where | What | When |
|---|---|---|
| The hub, `CLAUDE.md` unless the settings name another file | The whole file when it is new, or one block at its end between `<!-- context-central:start -->` and `<!-- context-central:end -->` when it is there already | `init`, once |
| `CLAUDE.local.md` and two lines in `.git/info/exclude` | A plain map's hub, and the lines that keep it and `.context-central/` out of git | `init --plain` inside a repository |
| `.gitignore` and `.gitattributes` at the estate root | Only where they are not there yet | `init`, where the answers say the map is kept in git |
| `.claude/settings.json` or `.claude/settings.local.json`, and `.mcp.json` | The marketplace, the enabled plugin and one permission; the allow rules for the read tools onboard used; and the rules and server names you pick from your repos' own settings | Onboard, each only on your yes |
| `<work tree>/.context-central/` | Drafts: files on their way to the map from a git work tree | `draft`, until `take` |
| The plugin's data folder under `~/.claude/plugins/data/`, in its `sessions` folder | One small record a session, of what it has been given | The prompt hook |
| `context-central-<your user id>` under the system's temporary folder | The same record, where Claude Code names no data folder | The prompt hook |
| Node's own compile cache under the temporary folder | What Node keeps so that the next start is quicker | Every start |

Three things inside the map are worth knowing too.

- A command that changes the map makes an empty folder, `.context-central.lock`, in the map's own folder for the moment of the write. To take over a lock left by a process that died it makes a second for that moment, `.context-central.lock.break`. A second that was itself left behind is taken over the same way, by a folder with `.break` added to its name once more, and so on. Git never shows an empty folder.
- A write lands in a file named `.context-central.<eight letters>.tmp` beside its place and is moved onto it. One is left behind only where a process was killed in that moment, and it can be deleted.
- A ticket, a pull request or a thread is saved word for word under a work item's `sources/`. It may carry names and other personal data, so think before a map that holds them is shared or kept in git.

A session's record is removed once no session has used it for fourteen days, the next time any session saves one. Records of releases before 0.13.0 sit in `context-central` under the temporary folder: nothing reads them now, and they can be deleted.

## How to remove all of it

1. In each git work tree where drafts wait, run `context-central take` while the command is still there, or delete that work tree's `.context-central/` folder.
2. `claude plugin uninstall context-central@context-central`, then `claude plugin marketplace remove context-central`. By Claude Code's own documentation the plugin's data folder goes with it.
3. Take the entries out of `.claude/settings.json` and `.claude/settings.local.json` in each folder where they were written: `context-central` under `extraKnownMarketplaces`, `context-central@context-central` under `enabledPlugins`, and `Bash(context-central *)` under `permissions.allow`, with anything onboard copied into `.mcp.json` that you no longer want.
4. Delete the block between the two marks in the hub, or the hub itself where the plugin wrote all of it.
5. For a plain map, take the two lines out of `.git/info/exclude` and delete `CLAUDE.local.md` if nothing else of yours is in it.
6. Delete the folders named `context-central` and `context-central-<your user id>` under the system's temporary folder.
7. Keep the map or delete it. It is plain Markdown and stays readable without the plugin: `.context-central/` inside a repository, or with the root layout the node folders, `estate.json`, `glossary.md` and `bin/` at the estate root.

To turn the plugin off and keep everything, see [Turning it off](install.md#turning-it-off).
