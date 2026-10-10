# Install, update and turn off

How to install the plugin, how a release reaches it, what decides whether it loads, what the first run does, and how to turn it off. The [README](../README.md#install) has the two commands most people need.

## What it needs

- Node 22.18 or later
- macOS, Linux (WSL included) or Windows
- on Windows, Git for Windows as well

There are no runtime dependencies. It is written in TypeScript, which Node runs as it is: nothing is compiled or installed.

On Windows it has been tried only on GitHub's Windows machines, not in a live Claude Code session. [Working from a terminal](terminal.md#on-windows) lists what was shown there, and [What it does not do](limits.md) lists what was not.

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

**Trying a local clone.** The repository is its own marketplace. Give `claude plugin marketplace add` the path of the clone. The plugin then loads in place, and edits apply at the next session or `/reload-plugins`.

**Updating.** The plugin carries a version, and an installed copy stays on its release until a newer one is published. `claude plugin update context-central@context-central` fetches it. Auto-update is off by default for a marketplace you add yourself, and the Enable auto-update toggle under `/plugin` turns it on. It is on from the start where the plugin was enabled from project settings as `init --print-settings` prints them.

**Releases.** [CHANGELOG.md](../CHANGELOG.md) says what each release changed, and each one is on the repository's Releases page.

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

Restart or `/clear` afterwards so the hub loads. When work starts in a repo, `/context-central:standards <repo>` records how its code is written and checked.

## Two accounts on one machine

A plugin installed at user scope belongs to one Claude Code config directory. If you switch accounts by config directory, enable the plugin from the map's project settings instead, so whichever account opens the map gets it:

```sh
context-central init --print-settings
```

Put the printed JSON in one of:

- the map's `.claude/settings.json`, shared with everyone who clones the map
- the map's `.claude/settings.local.json`, for this machine only

It declares the marketplace with auto-update on, enables `context-central@context-central`, and allows `Bash(context-central *)`. With auto-update on, a release reaches everyone who has the plugin this way, and the plugin's own version still decides when there is one to fetch.

The command only prints: `.claude/` is a protected path, so the write is yours to approve. [What decides whether it loads](#what-decides-whether-it-loads) says when Claude Code then applies those settings: only in sessions started in that folder, and only once a person has accepted its trust prompt.

## Turning it off

- **In one folder**: add it to `leftAlone` in `estate.json`. The hooks stay silent there.
- **On one machine, for a map that enables it**: set `"context-central@context-central": false` under `enabledPlugins` in the map's `.claude/settings.local.json`.
- **For your account**: `claude plugin disable context-central@context-central`.
- **For good**: `claude plugin uninstall context-central@context-central`.

The map is plain Markdown and stays readable without the plugin.
