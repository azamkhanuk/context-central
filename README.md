# context-central

A Claude Code plugin that gives all the context behind your work one central place: a map of plain Markdown notes about your repositories and the work in flight.

![How context-central works: connections such as GitHub, Jira, Azure DevOps or anything else you use bring tickets, pull requests and threads into the map, saved in full. The map holds three tiers, and a session is given the hub and the live index at the start, the state file and the notes when your prompt names the work, and the deep tier and evidence only when asked. Five skills do the work, each starting from the files the last one wrote, and every step writes its files back to the map](docs/how-it-works.png)

## What it does

- **Keeps a map.** A folder of plain Markdown notes about your repositories and the work you have in flight.
- **Shows Claude the work in flight.** Every session starts with a short index, one line for each piece of work.
- **Points Claude at the right notes.** Name a piece of work, a pull request or a repository in your prompt, and Claude gets a short list of the notes behind it.
- **Keeps each piece of work in a small state file.** It says where the work stands, what is done and what is next.
- **Saves long text in full.** Tickets, pull requests and threads are kept whole behind the short files, and read only on request.
- **Reaches the work wherever it is tracked.** Tickets, pull requests, meetings and chat are recorded as connections, each reached by its own command-line tool, by an MCP server your session holds, or by hand. None is required.

## How it helps

- **A new session picks up where the last one stopped.** The state file says where the work stands, so you do not explain it again.
- **Context stays small.** Two small things load every time: one file that routes each task, and the index of work in flight. The rest is read when it is named or asked for.
- **Nothing is lost.** Long text is kept in full, and each short note names the full text behind it.
- **It stays quiet.** The hooks say nothing unless a map covers the folder and the match is confident.
- **It is plain files.** The map is Markdown and stays readable without the plugin. There are no runtime dependencies, and the resolver makes no network call.

## The core idea

Load little, and point to the rest. A map has three tiers, and the tier decides when Claude sees a file.

| Tier | What is in it | When Claude sees it |
|---|---|---|
| Always loaded | the hub (where each task goes, and the standing rules) and the live index (the work in flight, one line each) | at the start of every session |
| Read when named | a work item's state file, and the notes behind it | when your prompt names the work |
| Read on request | the deep tier (tickets, pull requests and threads in full) and evidence (screenshots, recordings, exports) | by path, only when asked for |

Two rules keep it honest:

- Every brief names the full-text file behind it.
- Status goes in state files, never in the hub.

[The map](docs/map.md) shows how a map is laid out and gives the budget of each tier.

## How it works for you

1. **Set it up once.** Install the plugin and run `/context-central:onboard`. It reads what it can from disk, asks what is left, and writes the map.
2. **Say how each repo is built, when you want to.** `/context-central:standards <repo>` drafts that repo's standards and its checks from what the repo itself declares, and you approve them. Skip it and the rest works as it did.
3. **Start a session.** Claude already has the list of work in flight.
4. **Name the work** in your prompt, by its ticket in any spelling or by its plain name. Claude is pointed at its state file and the notes behind it.
5. **Do the work with the skills.** `/context-central:research` finds out from primary sources, `/context-central:prep` writes the spec, `/context-central:design` settles how it will be built when the work needs that, and `/context-central:implement` builds it one slice at a time. From the spec onwards each step can start in a fresh session, because the hand-over is the files of the work item.
6. **Write it back.** `/context-central:checkpoint` updates the state file, so the next session starts from there.

## Install

It needs:

- Node 22.18 or later
- macOS, Linux (WSL included) or Windows
- on Windows, Git for Windows as well

There are no runtime dependencies. It is written in TypeScript, which Node runs as it is: nothing is compiled or installed.

```sh
claude plugin marketplace add azamkhanuk/context-central
claude plugin install context-central@context-central
```

Then start a session in the folder that holds your checkouts and run:

```
/context-central:onboard
```

Restart or `/clear` afterwards so the hub loads.

[Install, update and turn off](docs/install.md) has the rest: installing from inside a session or from a local clone, updating, [what decides whether the plugin loads](docs/install.md#what-decides-whether-it-loads), [what the first run does](docs/install.md#first-run), [two accounts on one machine](docs/install.md#two-accounts-on-one-machine) and [turning it off](docs/install.md#turning-it-off).

On Windows it has been tried only on GitHub's Windows machines, not in a live Claude Code session. [On Windows](docs/terminal.md#on-windows) lists what was shown there, and [What it does not do](docs/limits.md) lists what was not.

## A piece of work, step by step

A piece of work goes through five steps, and each step is a skill. Each step leaves files in the work item's folder under `work/<item>/`, and the next step starts from those files. That is the hand-over: from the spec onwards each step can begin in a fresh session, and should, so that a build starts with its context small.

![The five steps of a piece of work and what each writes: research writes a research note and the saved sources, prep writes the spec and a code map, design writes the design, implement writes commits and evidence, and checkpoint rewrites the state file and adds to the log](docs/step-by-step.png)

| Step | You type | It starts from |
|---|---|---|
| [1. Research](docs/step-by-step.md#1-research) | `/context-central:research <question> [item]` | a question, and a ticket or an item where there is one |
| [2. The spec](docs/step-by-step.md#2-the-spec) | `/context-central:prep <item>` | the item's ticket, read in full, and the research notes |
| [3. The design](docs/step-by-step.md#3-the-design) | `/context-central:design <item>` | `SPEC.md`, the repo's standards and its code. Optional |
| [4. The build](docs/step-by-step.md#4-the-build) | `/context-central:implement <item>` | `SPEC.md`, and `DESIGN.md` where there is one |
| [5. The checkpoint](docs/step-by-step.md#5-the-checkpoint) | `/context-central:checkpoint` | git, the files on disk and the session |

[A piece of work, step by step](docs/step-by-step.md) says what each step needs, asks and writes, with a diagram for each.

## Where the detail lives

The README is the short version. Each part has a file of its own under `docs/`:

| Part | What its file covers |
|---|---|
| [Install, update and turn off](docs/install.md) | Installing from a session or a local clone, updating, what decides whether the plugin loads, the first run, two accounts on one machine, and turning it off |
| [A piece of work, step by step](docs/step-by-step.md) | What each of the five steps needs, asks and writes, the settings the build follows, and what the item's folder holds afterwards |
| [The map](docs/map.md) | The two layouts, what each folder holds, an older item, the glossary, the budget of each tier, and evidence |
| [Connections](docs/connections.md) | How a connection is recorded, references, presets, the three ways a connection is read, and a pinned account |
| [Standards and checks](docs/standards.md) | A repo's standards note, the files and the checks recorded beside it, and what is done where none is recorded |
| [What the hooks put in context](docs/hooks.md) | What is added at session start and when a prompt is submitted, the routes in order, and when the hooks stay silent |
| [Commands, skills and agents](docs/commands.md) | Every command of `context-central` with its flags, what `doctor` checks, the seven skills and the three agents |
| [Working from a terminal](docs/terminal.md) | The launcher that runs the CLI outside a session, and what the checks have shown on Windows |
| [What it does not do](docs/limits.md) | Every limit, with what is untested on Windows |

[CONTEXT.md](CONTEXT.md) defines the plugin's terms. [CHANGELOG.md](CHANGELOG.md) says what each release changed, and each one is on the repository's Releases page.

## What it does not do

- Its own commands never post to a tracker or a code host, and the fetcher only reads. A skill may post through a connection only where your write rules allow it and you approve the exact text.
- It carries no coding standards of its own, for any language. A repo's standards are what the estate wrote in its standards note, and its checks are the commands the estate recorded.
- It does not judge whether a note is true. `lint` and `graph` check size and links, nothing more.
- On Windows it has not been tried in a live Claude Code session.
- It ships a `bin/` folder, so claude.ai and Cowork do not install it. It is for Claude Code.

The full list is in [What it does not do](docs/limits.md).

## Licence

[MIT](LICENSE).
