# Working from a terminal

Outside a session the CLI is not on your `PATH`, so the map can hold a small launcher.

**Write it once**, in either of two ways:

- from inside a Claude Code session in the map, ask Claude to run `context-central wrapper --write`
- from a terminal in the map, run `node <plugin folder>/bin/context-central wrapper --write`

**What is saved.** Three files go in the map's `bin/` folder, on every system, and a file already there is kept. With a map inside a repository the folder is `.context-central/bin/`.

- `context-central`, the launcher: a `sh` script for macOS, Linux and Git Bash
- `context-central.cmd`, the cmd launcher: the same for cmd and Windows PowerShell
- `.gitattributes`, which keeps the first at LF and the second at CRLF when the map is kept in git, whatever a machine's line-ending setting

**Using it.** Each launcher finds the installed plugin through Claude Code's install record and passes the arguments it is given and the exit code through:

```sh
./bin/context-central work list
./bin/context-central doctor
```

**Worth knowing:**

- A plugin has an install record for each install: one for each project it was installed for, and one for you. A launcher takes the record of the project its own file sits in, or of the nearest folder above it that has one. With none it takes yours, and it never starts a copy that belongs to another project.
- Where it finds neither, it says the plugin was not found. Set `CONTEXT_CENTRAL_CLI` to the path of the plugin's `bin/context-central` file and either launcher uses that.
- A launcher saved by an earlier release keeps that release's rule. `wrapper --write` says when a saved launcher differs from the one it would write: delete it and run the command again to renew it.
- With the map's `bin/` folder on your `PATH`, the name `context-central` alone runs the cmd launcher in cmd and Windows PowerShell, and the launcher in Git Bash.
- PowerShell quotes arguments again in its own way before the cmd launcher is given them; what arrives then has not been tried.
- The cmd launcher looks for the install record in `CLAUDE_CONFIG_DIR`, or else in `.claude` under your Windows profile folder.

## On Windows

Windows needs Node 22.18 or later and Git for Windows. A session's Bash tool there is Git Bash, and that is where the skills call `context-central`.

What the checks have shown on GitHub's Windows machines, with Node 22 and 24:

- the commands, run as a process
- both hooks answering when started as the hooks manifest declares them
- a tool found on the `PATH` under a name ending in `.exe` or `.com` and started by its bare name: real `git` for `detect` and `doctor`, and a stand-in named `gh.exe` for `gh`; a tool installed only as a `.cmd` or a `.bat` reads as missing
- the bare command and the launcher, typed in Git Bash, and the launcher found there by its bare name in a folder that also holds the cmd launcher
- the cmd launcher run through cmd, with arguments that hold a space, nothing, `*` and an apostrophe arriving unchanged
- the cmd launcher found by its bare name in cmd and in Windows PowerShell, with two plain arguments and its exit code coming back
- a map whose files have Windows line endings or a byte-order mark: frontmatter and `estate.json` are read, and `work done` changes one line and keeps the rest as it found it

What has not been shown there is under [What it does not do](limits.md).
