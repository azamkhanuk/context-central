# Install, update and turn off

How to install the plugin, how a release reaches it, what decides whether it loads, what the first run does, and how to turn it off. The [README](../README.md#install) has the two commands most people need.

## What it needs

- Claude Code 2.1.275 or later
- Node 22.18 or later, as `node` on the `PATH` Claude Code starts with
- macOS, Linux (WSL included) or Windows
- on Windows, Git for Windows as well

There are no runtime dependencies. It is written in TypeScript, which Node runs as it is: nothing is compiled or installed.

With no `node` on that `PATH`, Claude Code reports each time a hook would run that it could not be started, with `Executable not found in $PATH: "node"`, and the session goes on without the index and the pointers. With a Node older than 22.18 the plugin says so itself. At session start it is one line to you, `context-central: this is Node <version>; the plugin needs Node 22.18 or later. Its hooks stay quiet until then.` Any command prints the first of those two sentences and exits 1, and at a prompt nothing is said.

On Windows it has been tried only on GitHub's Windows machines, not in a live Claude Code session. [Working from a terminal](terminal.md#on-windows) lists what was shown there, and [What it does not do](limits.md) lists what was not.

## Install

From a shell:

```sh
claude plugin marketplace add azamkhanuk/claude-plugins
claude plugin install context-central@azamkhanuk
```

Or both at once from inside a session in the terminal (Claude Code v2.1.275 or later):

```
/plugin install context-central --marketplace azamkhanuk/claude-plugins
```

The marketplace is the list of its author's plugins, kept in a repository of its own.

**In the desktop app.** The two shell commands install it for the desktop app as well, since the app and the terminal read the same settings files. The app's own menu is the **+** button beside the prompt box, then **Plugins**: **Add plugin** installs one there, and **Manage plugins** turns one on or off, or removes it.

**Trying a local clone.** The repository is also a marketplace of its own, called `context-central`. Give `claude plugin marketplace add` the path of the clone and install `context-central@context-central`. The plugin then loads in place, and edits apply at the next session or `/reload-plugins`.

**Updating.** The plugin carries a version, and an installed copy stays on its release until a newer one is published. `claude plugin update context-central@azamkhanuk` fetches it. Run from a shell, that works for the desktop app too. Auto-update is off by default for a marketplace you add yourself, and the Enable auto-update toggle under `/plugin`, in a terminal session, turns it on. It is on from the start where the plugin was enabled from project settings as `init --print-settings` prints them. On Claude Code 2.1.303, `claude plugin marketplace add azamkhanuk/claude-plugins --scope project` writes that entry again without `"autoUpdate": true`, which turns auto-update off for everyone who uses the map: after it, put the key back or print the settings again.

**Releases.** [CHANGELOG.md](../CHANGELOG.md) says what each release changed, and each one is on the repository's Releases page.

## Research alone

The research skill can be installed by itself, with no plugin, from a clone of the repository or with the package each release carries from 0.21.0. [Research taken alone](research.md#research-taken-alone) has the commands, and what it leaves out.

## On the Copilot command line

From 0.22.0 the plugin works on the GitHub Copilot command line, and there it follows Copilot's own ways. The folder holds a side for each host over one shared core. The core is the command and the seven skills. Claude Code's side is its manifest, its hooks file and its agents, as they were. Copilot's side is a manifest of its own, `plugin.json` at the folder's root in the Agent Plugins form, and a folder `com.github.copilot/` with a hooks file in Copilot's own form and the five agents with heads in Copilot's words. Copilot loads its own side and the skills, and nothing of Claude Code's.

**What it needs.** The Copilot command line 1.0.116 or later, the version everything below was shown on, and Node 22.18 or later as `node` on the `PATH` Copilot starts with. It has been run there on macOS alone.

**Install.** From a shell:

```sh
copilot plugin marketplace add azamkhanuk/claude-plugins
copilot plugin install context-central@azamkhanuk
```

Copilot keeps the copy in `~/.copilot/installed-plugins/azamkhanuk/context-central/`, or under `COPILOT_HOME` where that is set. A [launcher](terminal.md) finds it there where Claude Code has no copy on record.

**Updating.** Copilot updates a plugin from a marketplace you added yourself only where your own settings turn that on. The first command above wrote the marketplace into `~/.copilot/settings.json`. Give that entry `"autoUpdate": true`, once, so that it reads:

```json
{
  "extraKnownMarketplaces": {
    "azamkhanuk": { "source": { "source": "github", "repo": "azamkhanuk/claude-plugins" }, "autoUpdate": true }
  }
}
```

Copilot then updates the plugin as a session starts in a folder you have trusted, and in a folder nobody has trusted it updates nothing. Without the entry, `copilot plugin update context-central@azamkhanuk` fetches a release by hand. Copilot takes any change of a plugin's files as an update, whatever its version, so the marketplace names the plugin's `release` branch, which only a release moves: a merge that is not a release reaches nobody.

**What Copilot asks you to allow.** Copilot does not put a plugin's command on the `PATH`, so there a skill runs `node` with the file `bin/context-central` of the plugin's folder. Copilot asks before it runs a shell command it does not know as read-only, and before it uses a path outside the working folder, and a skill's `allowed-tools` grants neither there. Answer its prompt, which by Copilot's own help offers to stop asking for that command in the repository, or start Copilot with both allowed:

```sh
copilot --add-dir ~/.copilot/installed-plugins/azamkhanuk/context-central --allow-tool='shell(node:*)'
```

That rule allows every `node` command for the run. With the command on your own `PATH`, as [the package each release carries](research.md#research-taken-alone) puts it, a skill finds it by its bare name, and the rule to give is `--allow-tool='shell(context-central:*)'`. That way was not run.

**Trust.** A plugin's hooks run only in a folder you have trusted. By Copilot's own help, a session with you in it asks at its start whether to trust the folder. A run with nobody there, `copilot -p`, runs no hook in a folder nobody has trusted, and `--trust-folder` trusts it for that run.

**The skills.** In a session with you in it, a skill is typed as `/context-central:<skill>` with your words after it: Copilot's help says so, and its log showed the slash name taken. No skill was run to its end there with any model, and of the seven only `checkpoint` was loaded. In a `-p` run the six skills you type cannot be started: Copilot hands the slash name to the model as typed, and refuses the model a skill that is kept to the person. `checkpoint`, which the model may start, loads there.

**Setting a map up.** `/context-central:onboard` follows the host it runs on. On Copilot the hub of a new map is `.github/copilot-instructions.md`, the file Copilot's own `init` writes and GitHub's best practices name, or `.context-central/hub.md` where the map sits in a repository and is kept out of git, since Copilot loads no instruction file that one checkout keeps to itself. The entry that shares the plugin with everyone who uses the map goes into the repository's `.github/copilot/settings.json`, or into `.github/copilot/settings.local.json` for one machine, and `context-central init --print-settings` prints it for the host it runs under. Copilot keeps no file of rules for you to write: it stops asking before a tool runs once you answer its prompt with "Yes, and don't ask again", or where you start it with `--allow-tool`. The servers onboard lists are the ones `copilot mcp list` prints. `context-central host` prints all of this for the host it runs under, which is where the onboard skill takes it from, and `context-central budget` there counts the files Copilot loads at a start. `context-central init --plain`, which the other skills offer in a folder no map covers, gives a new map the same hub.

**The agents.** Each starts under its name, `context-central:<agent>`, from a file of Copilot's own whose head lists the tools the agent may hold by Copilot's names for them. Copilot holds the reader and the reviewer to that list: neither is given a tool that writes a file, and each holds a shell, as on Claude Code. Copilot has no way to deny a tool, so the sweeper holds every tool there, as the fetcher does on both hosts, and only its brief keeps it from writing. No agent names a model there: each runs on the session's model, and `/subagents` sets another for one. Each brief is the one Claude Code's agent is given.

**The hub.** Copilot puts `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, the rules under `.claude/rules/` and an instructions file under `.github/instructions/` that applies to every file before the model at a session's start, from the folder the session starts in and from the root of its repository, with the named files from the folders between the two as well, and no `CLAUDE.local.md`: its help lists them, and a run showed which arrive. Where it does not load the hub, the session-start hook gives the hub's text after the live index, for a hub that lies inside the estate. The hook takes a hub as loaded by the name it is kept under, counted from any of those folders, and a hub that is a link by the name of the file the link leads to as well. Whether Copilot reads a file through a link was not seen. An instructions file that names the files it applies to arrives only once one of them is worked on, so the hook gives a hub kept as one. In a folder that `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` names, the hook takes an instructions file that applies to every file as loaded, and gives any other hub.

**Turning it off.** `copilot plugin disable context-central@azamkhanuk` turns it off and `copilot plugin enable context-central@azamkhanuk` turns it on again. `copilot plugin uninstall context-central@azamkhanuk` removes the copy, and `copilot plugin marketplace remove azamkhanuk` the marketplace.

**What was shown, and how.** The monthly quota of the account these runs were made on was spent, so each session below ran on Copilot 1.0.116 against a stand-in model: a small server on the same machine that answers from a script and writes down what Copilot sends it. That shows what Copilot does with the plugin. It shows nothing of how one of GitHub's models follows a skill.

| What | Shown |
|---|---|
| The marketplace added and the plugin installed from it, as 0.21.0, in a Copilot home of its own | yes |
| A marketplace entry pinned to a branch: an install takes that branch, on Copilot and on Claude Code, and an update moves when it moves and not when `main` does | yes: the install with this plugin from a branch of its own repository, the update with a throwaway plugin |
| With `autoUpdate` on the marketplace's entry, a session that starts in a trusted folder updates the plugin by itself | yes, with a throwaway plugin |
| Copilot loads its own side of the plugin and the skills, and nothing of Claude Code's side, and Claude Code the other way round | yes, with a throwaway plugin laid out as this one is, and with this plugin installed from a marketplace on disk |
| Both hooks start from Copilot's own hooks file, and the live index is before the model at a start and the pointers at a prompt, each once | yes |
| The hub's text after the index, in a plain map | yes |
| Which instruction files are before the model at a start | yes: each kind named under The hub above, once |
| A skill loads with its folder named, and the command answers when run by its file | yes, for `checkpoint`, with the plugin's folder added |
| Inside a session the command says its host is the Copilot command line, and prints Copilot's settings and steps | yes: `host`, `init --print-settings` and `budget`, each run by its file |
| Each of the five agents starts from Copilot's own file with no warning, and the tools each holds | yes, but for the web reader's tools, the network being off |
| A launcher finds the copy Copilot installed | yes |
| Any skill run with one of GitHub's models, onboard run at all, a skill typed with words after it in a session with a person in it, the `powershell` line of a hook, Linux, Windows, VS Code | no |

## What decides whether it loads

There are three ways to have the plugin. They differ in when it loads, how a release reaches it and whether a [launcher](terminal.md) finds it.

| How you have it | It loads | A release reaches it | A launcher finds it |
|---|---|---|---|
| Installed for you, which is what `claude plugin install` does unless told otherwise | in every session under that Claude Code config directory | by `claude plugin update`, or by itself once auto-update is on | from any map |
| Installed for one project, with `--scope project` or `--scope local` | in sessions started in that project, once its folder has been trusted | the same | when the launcher's own file is inside that project |
| Enabled from project settings, as [Two accounts on one machine](#two-accounts-on-one-machine) sets out | in sessions started in that folder, once its trust prompt has been accepted | by itself: the printed settings turn auto-update on | only where Claude Code has recorded an install for that project; otherwise set `CONTEXT_CENTRAL_CLI` |

Two rules of Claude Code decide the last two rows, and both are easy to trip on:

- **Project settings are read only from the folder a session starts in.** Claude Code does not look in the folders above. With a map at the estate root, a session started inside one of the repos is given the hub, which tells it to use the plugin, and is not given the plugin. Install the plugin for yourself, or put the same settings in that repo as well.
- **Project settings that add a marketplace apply only in a folder a person has trusted.** Nothing loads until the folder's trust prompt has been accepted in a session with a person in it, and nothing ever loads in a headless run of a folder nobody has trusted. Claude Code passes over the settings there without a message.

Both are taken from Claude Code's documentation. The checks of this repository cannot show either, since each needs a person at the prompt.

## First run

Start a session in the folder that holds your checkouts and run:

```
/context-central:onboard
```

It then:

1. reads what it can from disk: repositories, instruction files, ticket keys in branch names, tools on `PATH`, and adds the MCP servers the session holds
2. asks only what is left unsettled, in one pass
3. shows the draft settings
4. writes the map
5. proves each connection with one real read, which saves nothing
6. offers allow rules for the read tools it used, the terminal launcher and the settings that enable the plugin for the map, and writes each only on your yes
7. runs `doctor` and ends on a [closing answer](step-by-step.md#how-every-step-ends), with each fault it still reports under Needs a fix

In a git work tree onboard stops and names the main checkout: a map is set up from there, since the hub and the settings that enable the plugin belong to it.

Start a fresh session afterwards so the hub loads: `/clear` in the terminal, or **+ New session** in the desktop app. When work starts in a repo, `/context-central:standards <repo>` records how its code is written and checked.

## Two accounts on one machine

A plugin installed at user scope belongs to one Claude Code config directory. If you switch accounts by config directory, enable the plugin from the map's project settings instead, so whichever account opens the map gets it:

```sh
context-central init --print-settings
```

Put the printed JSON in one of:

- the map's `.claude/settings.json`, shared with everyone who clones the map
- the map's `.claude/settings.local.json`, for this machine only

It declares the marketplace with auto-update on, enables `context-central@azamkhanuk`, and allows `Bash(context-central *)`. With auto-update on, a release reaches everyone who has the plugin this way, and the plugin's own version still decides when there is one to fetch.

The command only prints: `.claude/` is a protected path, so the write is yours to approve. [What decides whether it loads](#what-decides-whether-it-loads) says when Claude Code then applies those settings: only in sessions started in that folder, and only once a person has accepted its trust prompt.

## Turning it off

- **In one folder**: add it to `leftAlone` in `estate.json`. The hooks stay silent there.
- **On one machine, for a map that enables it**: set `"context-central@azamkhanuk": false` under `enabledPlugins` in the map's `.claude/settings.local.json`.
- **For your account**: `claude plugin disable context-central@azamkhanuk`.
- **For good**: `claude plugin uninstall context-central@azamkhanuk`. [How to remove all of it](what-it-runs.md#how-to-remove-all-of-it) lists what the plugin wrote outside the map, which an uninstall leaves where it is.

The map is plain Markdown and stays readable without the plugin.

## What stays put before 1.0

The plugin is before 1.0, so a release may still change things. Two kinds of thing are held apart:

- **The map's layout and the keys of `estate.json` stay put.** Where a release changes what either means for a map that is already there, its section of [CHANGELOG.md](../CHANGELOG.md) says so under "For a map that already exists", with what to do.
- **The wording may change in any release**: the text of a skill or an agent, and what a command prints. A script that reads a command's output should ask for `--json` where the command has it.
