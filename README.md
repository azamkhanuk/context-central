# context-central

A Claude Code plugin that gives all the context behind your work one central place: a map of plain Markdown notes about your repositories and the work in flight.

![Mind map of how context-central works: the hub and the live index are always loaded, the state file and notes are read when named, the deep tier and evidence are read on request, two hooks bring it in, and the skills do the work](docs/how-it-works.png)

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

## How it works for you

1. **Set it up once.** Install the plugin and run `/context-central:onboard`. It reads what it can from disk, asks what is left, and writes the map.
2. **Say how each repo is built, when you want to.** `/context-central:standards <repo>` drafts that repo's standards and its checks from what the repo itself declares, and you approve them. Skip it and the rest works as it did.
3. **Start a session.** Claude already has the list of work in flight.
4. **Name the work** in your prompt, by its ticket in any spelling or by its plain name. Claude is pointed at its state file and the notes behind it.
5. **Do the work with the skills.** `/context-central:research` finds out from primary sources, `/context-central:prep` writes the spec, `/context-central:design` settles how it will be built when the work needs that, and `/context-central:implement` builds it one slice at a time. From the spec onwards each step can start in a fresh session, because the hand-over is the files of the work item.
6. **Write it back.** `/context-central:checkpoint` updates the state file, so the next session starts from there.

[A piece of work, step by step](#a-piece-of-work-step-by-step) says what each step needs, asks and writes, and the order to run them in.

## Install

It needs:

- Node 22.18 or later
- macOS, Linux (WSL included) or Windows
- on Windows, Git for Windows as well

There are no runtime dependencies. It is written in TypeScript, which Node runs as it is: nothing is compiled or installed.

On Windows it has been tried only on GitHub's Windows machines, not in a live Claude Code session. [Working from a terminal](#working-from-a-terminal) lists what was shown there, and [What it does not do](#what-it-does-not-do) lists what was not.

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

**What decides whether it loads.** There are three ways to have the plugin. They differ in when it loads, how a release reaches it and whether a [launcher](#working-from-a-terminal) finds it.

| How you have it | It loads | A release reaches it | A launcher finds it |
|---|---|---|---|
| Installed for you, which is what `claude plugin install` does unless told otherwise | in every session under that Claude Code config directory | by `claude plugin update`, or by itself once auto-update is on | from any map |
| Installed for one project, with `--scope project` or `--scope local` | in sessions started in that project, once its folder has been trusted | the same | when the launcher's own file is inside that project |
| Enabled from project settings, as [Two accounts on one machine](#two-accounts-on-one-machine) sets out | in sessions started in that folder, once its trust prompt has been accepted | by itself: the printed settings turn auto-update on | only where Claude Code has recorded an install for that project; otherwise set `CONTEXT_CENTRAL_CLI` |

Two rules of Claude Code decide the last two rows, and both are easy to trip on:

- **Project settings are read only from the folder a session starts in.** Claude Code does not look in the folders above. With a map at the estate root, a session started inside one of the repos is given the hub, which tells it to use the plugin, and is not given the plugin. Install the plugin for yourself, or put the same settings in that repo as well.
- **Project settings that add a marketplace apply only in a folder a person has trusted.** Nothing loads until the folder's trust prompt has been accepted in a session with a person in it, and nothing ever loads in a headless run of a folder nobody has trusted. Claude Code passes over the settings there without a message.

Both are taken from Claude Code's documentation. The checks of this repository cannot show either, since each needs a person at the prompt.

**Releases.** [CHANGELOG.md](CHANGELOG.md) says what each release changed, and each one is on the repository's Releases page.

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
7. runs `doctor` and says what is left for you to do

Restart or `/clear` afterwards so the hub loads. When work starts in a repo, `/context-central:standards <repo>` records how its code is written and checked.

## A piece of work, step by step

A piece of work goes through five steps, and each step is a skill. Research finds out, prep says what to build, design says how, implement builds it, and checkpoint writes the session back. Each step leaves files in the work item's folder under `work/<item>/`, and the next step starts from those files. That is the hand-over: from the spec onwards each step can begin in a fresh session, and should, so that a build starts with its context small.

| Step | You type | It starts from | It writes |
|---|---|---|---|
| 1. Research | `/context-central:research <question> [item]` | a question, and a ticket or an item where there is one | a research note in the item's `notes/`, or a concept note when there is no item; the work item itself when the ticket is new to the map |
| 2. The spec | `/context-central:prep <item>` | the item's ticket, read in full, and the research notes | `SPEC.md`, a code map note, new terms in the glossary, and a brief for the ticket |
| 3. The design | `/context-central:design <item>` | `SPEC.md`, the repo's standards and its code | `DESIGN.md`, in seven parts. Optional |
| 4. The build | `/context-central:implement <item>` | `SPEC.md`, and `DESIGN.md` where there is one | branches, commits and tests in the repos, built lines and revisions in `DESIGN.md`, evidence in the item, then its checkpoint |
| 5. The checkpoint | `/context-central:checkpoint` | git, the files on disk and the session | the state file rewritten, a line in the log, and lasting lessons in the notes, the glossary and the standards note |

### Before the first one

- **The map is there.** `/context-central:onboard` wrote it, and the session was restarted so that the hub loaded. Every step runs from a folder the map covers, such as the estate root or a registered repo.
- **A connection reaches the ticket**, or you have its text to paste. Research and prep read the ticket in full before anything is written, and a spec is never written with the ticket unread. Where nothing reaches it, the skill asks you to paste the text and saves it whole.
- **The repo's standards are recorded, when you want them.** `/context-central:standards <repo>`, once per repo. Design and implement read them, and the reviewer holds the diff to them. With none recorded, the steps work from the repo's instruction files and its recent history, and say so.
- **The build's settings are set.** They are the `implement` and `writeRules` keys in `estate.json` and three keys on each repo's entry, all of which onboard asks for. The table under [4. The build](#4-the-build) lists them.

### 1. Research

```
/context-central:research <question> [item]
```

Finds out from primary sources: the code at a commit, the ticket, the pull request, the vendor's own documentation, the meeting record. A summary, a recollection or a note already in the map is a lead to check against its source, never the source.

- **It places the question.** With an item, it reads the state file first. When the question names a ticket that no work item answers to, it makes the item, `work new <item> --ticket "<reference>"`, so that the ticket's full text has somewhere to go. With no item at all, the note goes in `concepts/`.
- **Work already in progress is read both ways.** For a branch, an open pull request or a half-finished ticket it reads the diff against the repo's base branch and the ticket: the diff shows what was done, the ticket what was asked.
- **Bulk stays out of the conversation.** Long files go to the reader agent. A ticket or a pull request is read with `fetch`, which finds the connection the reference belongs to, saves the full text in the item's `sources/` and prints a digest. What `fetch` says a session reads goes to the fetcher agent. What nothing reaches, you paste, and it is saved in full before anything else.
- **Every claim carries a mark.** `verified`, with its source as `path:line` at a commit, a link or the saved file; or `inferred`, with what it was reasoned from.
- **It writes one note**, `work/<item>/notes/<YYYY-MM-DD>-research-<slug>.md`, and adds it to "Where the detail lives" in the state file. The note holds the question, the answer in a few lines, the claims with their marks and sources, and what is still unknown.
- **You get a digest** of at most ten lines, and the note's path.

Run it once for each question. Each run writes its own note, and prep reads them all.

### 2. The spec

```
/context-central:prep <item>
```

Turns the conversation and the research into what will be built. It makes the item when it is not there yet, and it reads the ticket before anything else, with `fetch ticket --item <item>`, unless `sources/` already holds a copy.

- **It asks once.** Every question the spec needs answered that neither the conversation nor the notes settle comes in one numbered message, each with the answer it recommends and why. Answer them all in one reply. It goes on when no decision in the spec would be its guess.
- **It writes `SPEC.md`** beside the state file, in five parts. **Problem**: what is wrong or missing, for whom, and how that is known. **Solution**: the behaviour once this is built, in the estate's own terms. **Decisions**: each choice with its reason and the option turned down. **Test seams**: where behaviour is observed from outside, and what each test would show. **Out of scope**: what a reader might expect and will not get. The spec names behaviour and modules and holds no file paths, which go stale as the code moves.
- **It writes the code map**, `notes/<YYYY-MM-DD>-code-map.md`: each repo with its commit and the date, then one `path:line` a line with what is there. A later reader can tell how far the code has moved since.
- **It adds new terms to the estate's glossary** and uses the glossary's wording in the spec.
- **It writes a brief for the ticket** in three parts: why, what, done when. The spec stays in the map. The brief is posted through the connection the ticket belongs to only where your write rules allow it and you approve the exact text; otherwise it is shown for you to post.
- **It rewrites "Where it stands" and "Next"** in the state file, and lists the spec and the code map under "Where the detail lives".

Then `/clear`, and `/context-central:implement <item>`, or `/context-central:design <item>` first where the work needs its structure settled.

### 3. The design

```
/context-central:design <item>
```

Optional. It settles how the spec will be built, in the repos it touches and in what order, before any code is written. A small item needs none: implement builds from the spec alone. With no spec it stops and suggests prep.

- **It reads the standards** of each repo the code map names, the Design part first. With no code map it asks which repos the work touches. Where a repo has none recorded, the design rests on the instruction files and on what the code already does, and says so.
- **The reader agent reads the code the design will meet**: the modules the change touches, their interfaces, how a neighbouring feature of the same shape was built, and where its tests sit.
- **It writes `DESIGN.md`** beside the spec, headed with each repo, its commit and the date, in seven parts. **Shape**: the modules that change and the ones that are new, what each is for, and what may call what. **Interfaces**: each new or changed interface as it will be written, with what it takes, what it returns and how it fails on the failing inputs: the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused, with a failure that rests on a dependency written as its source at the pinned version or a run of it shows. **Choices**: each with its reason, the standards rule it follows as that file's `path:line`, the option turned down, the smaller option weighed or `none`, and the trigger that reopens one turned down for now. **Slices**: the order of the build, each slice one behaviour through every layer it touches in one repo, starting from a test seam of the spec; each slice names the Interfaces headings it builds and the seams it covers, and every seam is started from by a slice, named under the one that covers it, or named as not covered with the reason. **Checks beyond this machine**: what it assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared. **If time is short**: the cut order and what is never cut. **Anchors**: `path:line` for each place the build starts from or must not break.
- **It adds no requirement.** Something the spec does not ask for comes back to you as a question. Every requirement of the spec lands in at least one slice.
- **It shows you the Choices and the Slices** in short, with every point where it departs from the standards or could not follow the spec, and links the design from the state file.

You approve by starting the build: `/clear`, then `/context-central:implement <item>`. Run design again when a build has shown it wrong: it keeps what still holds, changes the rest where it stands, and marks the slices already built. A build that departs from the design without showing it wrong revises it in place, dated, so the design you read is the one the code was built to.

### 4. The build

```
/context-central:implement <item>
```

Builds the item one slice at a time, verifies it, has it reviewed, and checkpoints. It needs the spec, and it reads the design when there is one. A design names the commit it was written at, so where a file its anchors point at has changed since, implement says so before it builds.

**What it reads first.** The settings below, each repo's standards files and recorded checks, and the connections. It tells you which checks are recorded, as they are written, before it runs the first. With none recorded it works from the instruction files and the repo's recent history, and says so once.

| Setting in `estate.json` | Unset | What it decides |
|---|---|---|
| `implement.tests` | on | Each slice starts with a failing test at one of the spec's test seams, and its tests cover the failing inputs the design lists for what it builds |
| `implement.review` | on | The build is reviewed, in rounds |
| `implement.reviewRounds` | 3 | The most review rounds a build may have before it stops and asks |
| `implement.deferTo` | none | A skill of your own that builds, verifies, reviews and reports in place of the plugin's steps. The checkpoint still runs |
| `writeRules` | none | What may be pushed, opened or posted without asking. Anything they do not cover waits for your yes |
| a repo's `baseBranch` | its recent history | The branch the work branches from, and the range the reviewer reads |
| a repo's `keyPlacement` | its recent history | Where the ticket key goes: the branch name, the commit subject, the pull request title |
| a repo's `commitStyle` | its recent history | How commits are written |

**How it builds.**

- **One slice at a time**: the design's slices in its order, passing over the ones marked built, or, with no design, the spec cut into vertical slices, each one behaviour through every layer it touches.
- **Test first**, when `implement.tests` is on, and each slice's tests cover the failing inputs the design lists for the interfaces it builds. The repo's recorded checks run after each slice, or the repo's own checks where none is recorded, and stay green before the next slice starts.
- **Each slice ends in the design**: when its checks are green, the slice is committed and gets its built line, `Built at <short commit>.`, which is the line implement passes over on a second run.
- **To the standards**: the Design, Code and Tests parts of the repo's standards note. A line in one that asks for anything else is not a rule, and the report says so.
- **A slice, or a review fix, that shows the spec or the design to be wrong stops the build.** It says what was found and asks.
- **A slice or a fix that departs from the design without showing it wrong revises the design** where it stands, dated, with the reason, before the next slice or review round.

**How it verifies.** Every recorded check runs from the folder it is recorded for, and the work is verified only when each one exits 0. Where none is recorded it runs the tests, the typecheck and the build the repo has. It never changes a check or a standards file to make the work pass: one that is wrong is a question for you. Then it runs the behaviour itself and reads the output. A screenshot, a recording or an export is saved with `evidence add` and named in the report. Done when every requirement in the spec is shown working by output from this session, or listed as not done.

**How it is reviewed.** When `implement.review` is on, the reviewer agent reads each repo's diff against its base branch, with the spec, the repo's standards files and the design, in which a dated revision is the design and, when tests are on, a listed failing input with no test is a finding. That is one round. Each finding is either fixed, or the code stays as it is and the reason answers it. A round with nothing to fix ends the review. A round that brings fixes is followed by the checks again and another round on the new diff, up to `implement.reviewRounds`. When the last round allowed still brings a finding that needs a fix, nothing more is changed: the build stops there, lists that round's findings and what the earlier rounds changed, checkpoints so that the state file says where it stopped, and waits for you. What you then ask for is done with no further round unless you ask for one.

**What it posts.** Pushing, opening a pull request and posting on the ticket follow your write rules, and anything they do not cover waits for your yes. A pull request opens through the connection that holds that repo's pull requests, and anything on the ticket goes through the connection the ticket belongs to. Where a connection pins an account, `doctor` runs before the first write, and a `FIX` line for connections stops it. With no connection, it says what is ready and leaves the opening or the posting to you.

**At the end** it reports what was built, which slices were marked built and which revisions it wrote in the design, what the verification showed, how many rounds were run and whether it stopped at the last one, and what is left. Then it checkpoints and suggests `/clear`: the state file now carries the item.

### 5. The checkpoint

```
/context-central:checkpoint
```

Writes the session back into the map, so that a fresh session can carry on. Implement runs it at the end of a build. Run it yourself when a session ends, before `/clear`, or whenever you say checkpoint, log this or hand over. It is the one skill Claude may also pick up unasked.

- **The facts come from git and the files**, never from recollection: the status, the log since the base branch, the diff, the pull request's state read through its connection, the last test run. A claim with nothing on disk behind it is written as unverified or left out.
- **Long text is saved first**, in full, under `sources/`, before any brief of it. A file that is not text is saved with `evidence add` and listed in `notes/<YYYY-MM-DD>-evidence.md`, with what it shows and the commit it was taken at.
- **An older item is adopted first.** Where the item is kept as a note of its own with no state file, `work adopt` lays a state file beside that note, and the note is left as it is.
- **The state file is rewritten**, never appended to, in its six parts: **Where it stands**, **Done** (with the commit or the pull request's link that shows it), **Next** (concrete enough to start cold, with each check beyond this machine still to run), **Blocked**, **Standing traps** (with each open trigger from the design) and **Where the detail lives**. It stays within `budgets.stateChars` by moving detail into `notes/`. A finished item is marked with `work done <item>`.
- **Lessons that outlive the item** go where the next item will find them: a trap in the repo's note or a concept note; a term the estate uses with a meaning of its own in the estate's glossary, when you stated its meaning or text on disk does; a rule for how the repo's code is written in its standards note, when you stated it or accepted a reviewer's finding. A meaning or a rule it worked out itself is not written.
- **A line goes in the log**, `note "<item>: <what changed>"`. Then `lint` and `graph` run, and every `ERROR`, `BROKEN` and `UNREFERENCED` line is fixed.
- **It ends with what was not recorded**: the paths written, what was left out and why, and each glossary entry and standards rule added, with where it came from.

### What the item's folder holds afterwards

For the invented estate, a ticket `PROJ-12` that went through all five steps:

```
work/PROJ-12/
  STATE.md                                            made at research, as the ticket was new; rewritten at each checkpoint
  sources/01-2026-01-12-ticket-PROJ-12-full-text.md   the ticket in full, saved by fetch at research
  notes/2026-01-12-research-rate-limits.md            research: one note for each question
  SPEC.md                                             prep: what is built and why
  notes/2026-01-13-code-map.md                        prep: where in the code, at a commit
  DESIGN.md                                           design: how it is built, at a commit, each slice marked built as it lands
  evidence/2026-01-14-limit-reached.png               implement: what the build showed
  notes/2026-01-14-evidence.md                        checkpoint: what each evidence file shows
```

Outside the folder, prep and checkpoint add terms to the estate's glossary, checkpoint adds a line to `log/<YYYY-MM>.md`, and a lesson may land in `repos/<repo>.md`, a concept note or `standards/<repo>.md`.

### Running it, in order

1. **Install**, once per machine: `claude plugin marketplace add azamkhanuk/context-central`, then `claude plugin install context-central@context-central`.
2. **Set up the map**, once per estate. Start a session in the folder that holds your checkouts and run `/context-central:onboard`. Answer its one message of questions, say yes to the draft, take or decline what it offers, then restart or `/clear`.
3. **Record each repo's standards**, once per repo, when you want them: `/context-central:standards <repo>`.
4. **Start a session in a folder the map covers**, such as the estate root or a registered repo. Claude already has the work in flight.
5. **Research**: `/context-central:research <question> [item]`, once for each question. For a ticket new to the map, the first run makes the work item.
6. **Spec**: `/context-central:prep <item>`. Answer its questions in one reply. Then `/clear`.
7. **Design**, where the structure needs settling first: `/context-central:design <item>`. Read the Choices and the Slices. Then `/clear`.
8. **Build**: `/context-central:implement <item>`. Answer when it stops: a slice or a review fix that shows the spec or the design wrong, a write your rules do not cover, or a last review round that still has findings. It checkpoints at the end. Then `/clear`.
9. **Carry on in any later session** by naming the item in your prompt. Before you leave it, `/context-central:checkpoint`.

## How a map is laid out

A map is a folder of Markdown with one settings file, `estate.json`. An estate is the set of repositories you work across, with the folder that holds their checkouts. One estate has one map. [CONTEXT.md](CONTEXT.md) defines the plugin's terms.

There are two layouts:

- **Root**: `estate.json` sits at the estate root, above the checkouts. The map is the root itself.
- **Inner**: `estate.json` sits in `<repo>/.context-central/`. The map lives inside one repository. The hub is that repository's own `CLAUDE.md` at its root, because that is the file Claude Code loads there. `init` adds one marked block to it and leaves the rest as it is.

```
<estate root>/
  estate.json          settings: repos, connections, folders left alone, budgets
  CLAUDE.md            the hub: routing table, standing rules, where the parts are
  glossary.md          the estate's own terms, unless estate.json names another file for them
  repos/ areas/ concepts/ edges/ decisions/ docs/    nodes, one subject per file
  standards/<repo>.md  how one repo's code is designed, written, tested and reviewed
  log/2026-01.md       dated one-line notes
  work/<item>/
    STATE.md           where the item stands and what is next
    SPEC.md            what is being built
    DESIGN.md          how it will be built, for work that needs it settled first, each slice marked built as it lands
    notes/             research and working notes
    sources/           full text of tickets, PRs, threads: the deep tier
    evidence/          files that are not text: screenshots, recordings, exports
  bin/context-central   optional launcher for use outside a session, with context-central.cmd beside it
  web/ api/ ...        the checkouts, registered in estate.json
```

- A work item is named by a ticket key (`PROJ-12`) or a plain name (`portal-split`). Its state file can carry its ticket, so a plain name still answers to `#41`.
- Nodes link to each other with wiki links (`[[concepts/gateway]]`) or relative Markdown links.
- A node may sit in a folder below its kind, to any depth: `note --new docs/runbooks/month-end` makes one. A decision and a standards note take no folder.
- A file named `README.md` or `index.md` directly under `work/` is neither a work item nor a node, in any letter case. Neither is anything under `work/` that `notNodes` lists, and `work new` refuses a name whose folder is listed there.

**An older item.** A work item kept as a note of its own, with no state file, is still a work item: a single note `work/<item>.md`, or a folder that holds a `00-START-HERE.md` or a `README.md`. `context-central work adopt <item>` gives it a state file beside that note, and `work adopt --all` does so for every one. Adoption moves nothing and changes no file that is there. The state file links the older note and every note it pointed to, so a session is given what it was given before, with the state file first and the older note after it and the spec, whatever the limit. Checkpoint, prep, design and research adopt the item they are working on before they write to it, and never write to the older note. Where the item's folder holds a file with the state file's name in another letter case, such as a hand-kept `state.md`, the command stops and names it: on a disk that ignores letter case the state file would land on that file.

**The glossary.** The estate's terms live in the map's own `glossary.md`, or in a file the estate already keeps. Name that file with `"glossary"` in `estate.json`, as a path from the estate root. `init` then lays out none, and the plugin never creates, moves or reformats the file. `context-central where` says where the glossary is. Where it is inside a registered repo, prep and checkpoint read it, write nothing to it and list the terms in their report: writing would change that repo's work tree on whatever branch it is on.

## The three tiers

What loads, and when, is decided by tier. The budgets are settings under `budgets` in `estate.json`. `context-central lint` reports anything over.

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

### Evidence

Evidence is any file under a work item's `evidence/` folder. The folder is for what was seen and is not text: a screenshot, a recording, an export.

- The commands count every file there, whatever its kind, and never open one.
- A file sits at `work/<item>/evidence/<YYYY-MM-DD>-<what>.<ext>`, lower case with dashes.
- A note names it, by custom `notes/<YYYY-MM-DD>-evidence.md`.
- `context-central evidence add` copies a file into place under such a name.
- Text a session can read stays in the deep tier.
- `evidence.commit` in `estate.json` records whether evidence is committed. It is read as false when absent.
- `graph` reports an evidence file no note names.
- `lint` warns on a file in a work item that is neither Markdown nor under `evidence/`.
- `doctor` says when git and the setting disagree.

## Connections

A connection is a named way the estate reaches one outside system for one kind of thing: tickets, pull requests, meetings, chat or any other. An estate can have any number, and none is required: with no connection every command, hook and skill works as before. One is recommended, so that a session can read the ticket or the pull request behind the work.

They are recorded under `connections` in `estate.json`, by name:

```json
"connections": {
  "tracker": { "holds": "tickets", "references": ["PROJ-\\d+"], "server": "issues" },
  "code": { "holds": "pull-requests", "preset": "<a preset>", "account": "acme-bot" },
  "notes": { "holds": "meetings", "how": "Ask for the minutes in the channel." }
}
```

| Key | What it says |
|---|---|
| `holds` | The kind of thing. `tickets` and `pull-requests` have a part in the skills; any other word is carried as written |
| `references` | Regular expressions for how text names one thing in it. A part named `id` is the thing's own identifier, and a part named `repo` is its repository |
| `preset` | One of the plugin's presets, with that preset's own parameters beside it |
| `server` | The name you gave an MCP server or a connector. The session finds the tool when it needs it, so no tool name is recorded |
| `commands` | Your own command for an action (`read`, `search`, `comment`, `transition`, `open`), as a list of words. A session runs it; the plugin never does |
| `how` | Anything else, in words, for a connection reached by hand |
| `account` | The account its tool must run as. `fetch` reads only as it, `doctor` says whether it can, and neither switches the account that is active on the machine |
| `repos` | For pull requests: the registered repos it serves, when more than one connection holds them |

**References.** `PROJ-12`, `#41`, `AB#4312` and a link can each name a ticket. A reference is matched whatever its letter case and never inside a longer word. A work item answers to every spelling of its own ticket. That is the `ticket` line in the head of its state file, which `work new <item> --ticket "<reference>"` writes, or its name when the name is itself a reference. In a shell a reference goes in quotes, since `#` starts a comment there.

**Presets.** A preset is what the plugin knows about one vendor's system: how its references look, which program reads from it, and how a checkout's remote reads as it. `context-central connections --presets` lists the ones this version carries, each with the parameters it takes, which are written beside `preset` in the connection's entry. A preset is handed those parameters and nothing else of the entry. A preset is optional knowledge, kept in one folder of the plugin with a file for each vendor, and nothing else in the plugin names a vendor. A connection with no preset is used in every skill like any other.

**How a connection is read.** `context-central connections` lists each one with how this machine reaches it:

- **by fetch**: its preset has a read command and that program is on the `PATH`, so `fetch` saves the full text with no agent
- **by a session**: through the server named, or with your own command, which the fetcher agent uses
- **by hand**: the skill asks you to paste the text and saves it in full

`context-central connections --ticket "<reference>"` lists only the connection that ticket belongs to, `--pr "<reference>"` the one a pull request belongs to, and `--item <item>` the one a work item's own ticket belongs to. It is the connection `fetch ticket` and `fetch pr` read through: the one whose references claim it or, where none does, the only connection that holds the kind. Where two claim a link, the one that names its repository under `repos` has it, then one that names no repos, and otherwise the one written first. A link's repository is matched to a registered repo by its name. A reference that names no repository belongs to the first written of those that claim it. On a map made before connections the answer can be a preset that applies unasked, and its line says that the map does not record it. A skill never picks a connection for itself: it reads through `fetch`, which finds the connection or names it and says how a session reads it, and it asks this before it posts on a ticket.

**A pinned account.** Where a connection names an `account`, `fetch` reads only as that account. Where its preset's tool can hand out one account's token, `fetch` asks for the pinned account's and gives it to the tool it starts, in that tool's environment and nowhere else, whichever account is active. Where the tool hands out none, the read goes ahead only if the tool already runs as that account on the connection's own host. Otherwise `fetch` reads nothing, saves nothing and exits 1. `doctor` answers for each pinned connection:

- `ok`: the tool runs as the pinned account
- `note`: another account is active and the tool holds the pinned one. `fetch` reads as it, and the note says how to run one command of your own as it
- `FIX`: the tool cannot run as it here. The line says how to sign the account in, that signing in makes it the active one, and how to put the former one back

No advice from the plugin tells you to change the machine's active account for good. On a map shared with people who have not signed the pinned account in, a read that once went ahead as whoever was active now stops with that `FIX`.

A developer who has some of an estate's connections and not others is served by those they have. A tool that is missing is a note in `doctor`, never a fault.

**A map made before connections** has no `connections` in its `estate.json` and is read as it always was. Its tracker, its code host and its sources are shown as connections, and a GitHub pull request link and `fetch pr|issue` go on working there whatever it records. To move it over, write `connections` by hand in the shape above. The old `tracker`, `codeHost` and `sources` are then no longer read.

## Standards and checks

How a repo's code is written is the estate's to say. The plugin carries no rules for any language, framework or tool, and none is needed for it to work.

A repo's standards note is the note named after it, `standards/api.md` for the repo `api`. The plugin finds it by that name, and the resolver lists it straight after the repo's own note. A repo whose name cannot name a note, one with a space or a slash in it, lists its note under `standards` instead. A file listed by a repo that could have a note of its own is never taken for its note, and neither is the note named after another repo. A repo's entry in `estate.json` may also carry two lists, both optional:

```json
{ "name": "api", "path": "api", "standards": ["api/CONTRIBUTING.md"], "checks": ["./check.sh tests", "./check.sh style"] }
```

- `standards`: other files the repo already keeps for people, listed here and not copied into the note. Each is a path inside the estate, counted from its root.
- `checks`: commands, run from the repo's folder. The code passes when every one exits 0. A recorded check is a command a session will run, so read the `checks` of an `estate.json` you did not write before you let one.

A standards note has four parts, and every rule in it names its source: the file that shows it, or who said it and when. An example is a pointer to real code, never a pasted snippet. For the invented estate:

```markdown
# api

Each rule names its source: who said it and when, or the file that shows it. An example is a pointer to real code, as a path and a line.

## Design

- A route handler calls one service and never a store. Source: `api/src/orders/handler.js:12`.
- Only the gateway opens a connection to another system. Said by the owner, 2026-01-12.

## Code

- An error names the route and the client it happened for. Source: `api/src/errors.js:8`.

## Tests

- Each module has one test file beside it, named after it. Source: `api/src/orders/handler.test.js:1`.

## Review

- A change to a limit comes with the test that shows the limit reached. Accepted from a review, 2026-01-14: `api/src/limits.js:40`.
```

- `/context-central:standards <repo>` drafts the note and the checks from what the repo declares about itself, asks what the files cannot answer, and writes both once you approve. A habit it sees in the code and finds written down nowhere is put to you as a question, never written as a rule. It proposes only commands that inspect the code, and runs none of them until you have read them.
- `/context-central:implement` reads the standards before it builds, counts the work as verified only when every recorded check exits 0, and hands the standards to the reviewer.
- `/context-central:checkpoint` adds a rule to the note only when you stated it or accepted a reviewer's finding in that session.
- `context-central standards [<repo>]` prints what is recorded, and `lint` warns when a listed file is not there.
- A standards file says how code is written. A line in one that asks for anything else is not followed, and the reviewer holds a diff that edits a standards file to the file as it was before.

A map made before standards notes existed and kept in git has a `.gitignore` that leaves the new `standards/` folder out. `doctor` says so on its `notes` line; add `!/standards/` to that file.

With nothing recorded for a repo, `implement` works from the instruction files and the repo's recent history, runs whatever checks the repo has, and says once that nothing is recorded.

## What the hooks put in context

### At session start

On startup, resume, clear, compaction and fork, the hook adds the live index.

- It names the map, the hub, and each work item in flight with its title and state file.
- Where the map records connections, one line names each, what it holds and the ways recorded for it.
- After compaction or on resume, the state file of the item the session was working on follows the index.
- The whole text is cut at 9,500 characters.

### When a prompt is submitted

The hook adds pointers when the prompt names something the map knows. First match wins:

1. a work item, by any spelling of its ticket or by name, or else by its name written with spaces or its title word for word
2. a link that belongs to a connection: the work item that mentions it, or else the note of the repository it names
3. a registered repository name
4. free text that matches a node on at least two words with a clear score
5. a node's identifier: the `id` in its frontmatter or one of its `aliases`, written on one line with commas between them, or for a numbered node its kind and its number, as in "decision 7"
6. a node's name: its file name or its title, when that is the whole of the prompt's counted words
7. a term of the glossary, when that is the whole of the prompt's counted words

Routes 5 to 7 are tried only where the four before them have no answer, so a prompt that had an answer keeps it. They leave out the work folder, the log and the deep tier. A prompt's counted words are its runs of letters and digits, without stop words and runs of one or two letters; a run that holds a digit always counts. An identifier of one word answers only when it is the whole prompt, and a number alone names nothing.

The pointers are a short list of paths with sizes and a reason each, plus a count of the deep files and of the evidence behind the item. They are facts, never instructions. Each answer is delivered once per session. The record of what a session has been given is kept under the system's temporary folder, and is removed once no session has used it for fourteen days.

When a prompt names a ticket that no work item answers to, the hook adds one line saying so and which connection it reads as. A bare number is never reported, a reference is reported once per session, and three are reported at most.

Two limits:

- A prompt longer than `budgets.hookTextChars` (600 characters) is matched only on work item tickets and names, links and repo names. It is not matched on its words, a title or a name written with spaces, nor on an identifier, a node's name or a term, and no ticket without a work item is reported: a pasted log or diff would match those by chance.
- On the command line `resolve` has one more route after free text: when two or more words of the query all sit in the name and title of one work item, and of no other, the answer is that item. The hook never uses it. Routes 5 to 7 come after it there.

### When a large session resumes with an expired cache

The hook shows a notice to the person, not to the model. If Claude Code reports that the prompt cache has likely expired and the session holds at least `budgets.resumeNoticeTokens` (100,000) tokens, the hook shows one line giving the size and saying that a fresh session started from the work item's state file is cheaper.

### When the hooks stay silent

- no map covers the session's folder
- the working directory is inside a different map
- the folder is outside the estate, under a `leftAlone` entry, or not a registered repo or node folder
- the prompt matches nothing with confidence
- the same answer was already delivered in this session

If `estate.json` is invalid, the person sees a one-line message and the model sees nothing. The resolver makes no network call.

## Commands

Inside a session the plugin puts `context-central` on the Bash tool's `PATH`.

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

Typed with the plugin prefix. All but the last run only when you invoke them; `checkpoint` may also be picked up by the model. The five that do the work are walked through in [A piece of work, step by step](#a-piece-of-work-step-by-step).

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
| `context-central:reviewer` | Reviews a diff against the spec, the estate's standing rules, and the design and the repo's standards files when it is given them. Never edits |

## Working from a terminal

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

### On Windows

Windows needs Node 22.18 or later and Git for Windows. A session's Bash tool there is Git Bash, and that is where the skills call `context-central`.

What the checks have shown on GitHub's Windows machines, with Node 22 and 24:

- the commands, run as a process
- both hooks answering when started as the hooks manifest declares them
- a tool found on the `PATH` under a name ending in `.exe` or `.com` and started by its bare name: real `git` for `detect` and `doctor`, and a stand-in named `gh.exe` for `gh`; a tool installed only as a `.cmd` or a `.bat` reads as missing
- the bare command and the launcher, typed in Git Bash, and the launcher found there by its bare name in a folder that also holds the cmd launcher
- the cmd launcher run through cmd, with arguments that hold a space, nothing, `*` and an apostrophe arriving unchanged
- the cmd launcher found by its bare name in cmd and in Windows PowerShell, with two plain arguments and its exit code coming back
- a map whose files have Windows line endings or a byte-order mark: frontmatter and `estate.json` are read, and `work done` changes one line and keeps the rest as it found it

What has not been shown there is under [What it does not do](#what-it-does-not-do).

## Two accounts on one machine

A plugin installed at user scope belongs to one Claude Code config directory. If you switch accounts by config directory, enable the plugin from the map's project settings instead, so whichever account opens the map gets it:

```sh
context-central init --print-settings
```

Put the printed JSON in one of:

- the map's `.claude/settings.json`, shared with everyone who clones the map
- the map's `.claude/settings.local.json`, for this machine only

It declares the marketplace with auto-update on, enables `context-central@context-central`, and allows `Bash(context-central *)`. With auto-update on, a release reaches everyone who has the plugin this way, and the plugin's own version still decides when there is one to fetch.

The command only prints: `.claude/` is a protected path, so the write is yours to approve. [What decides whether it loads](#install) says when Claude Code then applies those settings: only in sessions started in that folder, and only once a person has accepted its trust prompt.

## Turning it off

- **In one folder**: add it to `leftAlone` in `estate.json`. The hooks stay silent there.
- **On one machine, for a map that enables it**: set `"context-central@context-central": false` under `enabledPlugins` in the map's `.claude/settings.local.json`.
- **For your account**: `claude plugin disable context-central@context-central`.
- **For good**: `claude plugin uninstall context-central@context-central`.

The map is plain Markdown and stays readable without the plugin.

## What it does not do

- Its own commands never post to a tracker or a code host, and the fetcher only reads. A skill may post through a connection only where your write rules allow it and you approve the exact text.
- Its own `fetch` reads only with the command of a preset. A connection with no preset is read by a session, through its server or your own command. The plugin never runs a command that `estate.json` names. What it puts into a preset's command from a reference or from the settings is one word that does not start with a dash, so that nothing reaches the tool as a flag.
- Of the presets' read commands, only GitHub's has been run against the real tool. Jira's and Azure DevOps's were written from their vendors' documentation and tried against stand-ins. `fetch --check` shows whether one works for you.
- A pull request read by `fetch` holds what the preset's tool returns. Where that leaves out a review's line comments, the fetcher can read them through a server that offers them.
- On Windows it does not start a tool that is installed only as a `.cmd` or a `.bat` file. `fetch` says so, and a session reads that connection through its own shell or a server.
- It does not link or copy nodes into the checkouts. Nodes are reached by pointer.
- It does not move or rewrite the files of an older item. Adoption lays a state file beside them and changes nothing else.
- It does not find a pull request written as a repo and a number. A link finds its work item once the item's state file or notes hold it, which checkpoint writes.
- It does not write to a glossary inside a repo, and it does not turn an estate's own glossary into its entry format.
- It does not check where the plugin is enabled. `doctor` cannot tell you that a session started inside a repo is not given the plugin, or that a folder has not been trusted.
- It does not renew a launcher you saved. `wrapper --write` says when one differs, and the renewing is yours.
- It does not ingest meetings on its own: the fetcher reads one when asked. It ships no workflows and no evals.
- It carries no coding standards of its own, for any language. A repo's standards are what the estate wrote in its standards note, and its checks are the commands the estate recorded.
- It does not judge whether a note is true. `lint` and `graph` check size and links, nothing more.
- On Windows it has not been tried in a live Claude Code session. These are untested on Windows, not known to fail:
  - Nothing has shown that Claude Code fires the hooks there, or that a skill reaches `context-central` from the Bash tool.
  - Nothing has shown what `fetch` does with an answer from a preset's tool there, or what `doctor` and `detect` make of its accounts.
  - Of `doctor`'s check on what git ignores, one case ran there with real `git`: checkouts the map's repository does not ignore.
  - PowerShell 7 has not been tried, and no argument with a space or a special character has been sent through either PowerShell.
  - The cmd launcher's choice of an install by project folder has run there only against a record of a copy installed for the person.
- It does not support a Windows session that has only the PowerShell tool. The skills call `context-central` from the Bash tool, which needs Git for Windows.
- It ships a `bin/` folder, so claude.ai and Cowork do not install it. It is for Claude Code.

## Licence

MIT. See `LICENSE`.
