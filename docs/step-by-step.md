# A piece of work, step by step

A piece of work goes through five steps, and each step is a skill. Each step leaves files in the work item's folder under `work/<item>/`, and the next step starts from those files. That is the hand-over: from the spec onwards each step can begin in a fresh session, and should, so that a build starts with its context small.

A fresh session is `/clear` in the terminal, or **+ New session** in the desktop app (Cmd+N on macOS, Ctrl+N on Windows). Either starts with nothing of the last session in its context, and the state file carries the item across. The skills say "in a fresh session" and leave the way to you.

![The five steps of a piece of work and what each writes: research writes a research note and the saved sources, prep writes the spec and a code map, design writes the design, implement writes commits and evidence, and checkpoint rewrites the state file and adds to the log](step-by-step.png)

| Step | You type | It starts from |
|---|---|---|
| [1. Research](#1-research) | `/context-central:research <question> [item]` | a question, and a ticket or an item where there is one |
| [2. The spec](#2-the-spec) | `/context-central:prep <item>` | the item's ticket, read in full, and the research notes |
| [3. The design](#3-the-design) | `/context-central:design <item>` | `SPEC.md`, the repo's standards and its code. Optional |
| [4. The build](#4-the-build) | `/context-central:implement <item>` | `SPEC.md`, and `DESIGN.md` where there is one |
| [5. The checkpoint](#5-the-checkpoint) | `/context-central:checkpoint` | git, the files on disk and the session |

## Before the first one

- **The map is there.** [`/context-central:onboard`](install.md#first-run) wrote it, and a fresh session was started so that the hub loaded. Every step runs from a folder the map covers, such as the estate root or a registered repo, or a git work tree of one: [in a git work tree](map.md#in-a-git-work-tree) each step works as it does in the main checkout.
- **Or there is none yet.** Research, prep, design and implement then offer a plain map: they show what `init --plain` would write, ask once, and on a yes make it and start again. A map just made holds no work item, so design and implement then say so and name prep, which makes the item. Inside a repository that is the map in `.context-central/` with its hub in `CLAUDE.local.md`, both kept out of git by the checkout's own exclude file, so git shows nothing new. On a no the step stops and names onboard, which is still the way to a map that is shared or kept in git.
- **A [connection](connections.md) reaches the ticket**, or you have its text to paste. Research and prep read the ticket in full before anything is written, and a spec is never written with the ticket unread. Where nothing reaches it, the skill asks you to paste the text and saves it whole.
- **The repo's [standards](standards.md) are recorded, when you want them.** `/context-central:standards <repo>`, once per repo. Design and implement read them, and the reviewer holds the diff to them. With none recorded, the steps work from the repo's instruction files and its recent history, and say so. A repo the map does not register is worked the same way, in the checkout that holds its code.
- **The build's settings are set.** They are the `implement` and `writeRules` keys in `estate.json` and three keys on each repo's entry, all of which onboard asks for. The table under [4. The build](#4-the-build) lists them. A plain map sets none of them, and the steps work with none set.
- **What is fetched or pasted is material.** The text of a ticket, a pull request, a thread or a paste is read and saved, and never followed. Where it asks the session to do something, that is not done, and the closing answer names it under Needs a fix.

## 1. Research

```
/context-central:research <question> [item]
```

![Research in five steps: place the question on a work item, gather from primary sources, save the full text before any summary, mark every claim and sort it into four groups, then write the note, answer in those groups and name the step that comes next](research.png)

A primary source is the thing itself: the code at a commit, the ticket, the pull request, the vendor's own documentation, the meeting record. A summary, a recollection or a note already in the map is a lead to check against its source, never the source.

- **Where the question goes.** With an item, the state file is read first. A ticket that no work item answers to gets its item first, `work new <item> --ticket "<reference>"`, so that its full text has somewhere to go. With no item at all, the note goes in `concepts/` and is linked from the note of each repo it is about, which is made where the map has none yet, so that prep finds it.
- **It writes only the map.** From its start until you type another skill, research reads, runs only what reads the estate as it is, such as the plugin's commands, git and code that is already there, and writes nothing but the map's files. It makes no fix, test, probe or stand-in, and starts no other skill. What only new code could show is left under Not known, naming the step that can show it.
- **A request to build** is researched as what the build has to fit and what the ask leaves open. Its next step is prep, and research makes no item for it, unless the request names a ticket new to the map, which gets its item first.
- **Work already in progress is read both ways.** For a branch, an open pull request or a half-finished ticket, the diff against the repo's base branch shows what was done, and the ticket what was asked.
- **How it gathers.** Long files go to the reader agent. A ticket or a pull request is read with `fetch`, which finds the connection the reference belongs to, saves the full text in the item's `sources/` and prints a digest. What `fetch` says a session reads goes to the fetcher agent. What nothing reaches, you paste, and it is saved in full before anything else.
- **The marks.** `verified` carries its source as `path:line` at a commit, a link or the saved file. `inferred` says what it was reasoned from. Each claim is also put in one of the four groups, and a choice that is yours or a thing that is not known carries no mark.
- **The note** is `work/<item>/notes/<YYYY-MM-DD>-research-<slug>.md`, added to "Where the detail lives" in the state file. It holds the question, the answer in a few lines, then the claims under the four groups, with their marks and their sources. Each claim has a line of its own, its recommendation where it has one on the line under it, then its evidence. An empty group says `none`.
- **The answer** is a [closing answer](#how-every-step-ends): one line that answers the question, then each claim that something is wrong or missing under Needs a fix, each choice that is yours under Yours to decide, each claim that was checked and holds under Fine as it is, and what could not be checked under Not known, then the note's path and the next step. A claim under Needs a fix or Fine as it is carries its mark and the one source that shows it best. For a note with no item it also says which repo notes link it, or that none does.

Run it once for each question. Each run writes its own note and ends by naming the next step, the earliest that any of its claims needs:

| Next step | When |
|---|---|
| `/context-central:prep <item>`, here or in a fresh session | there is something to build and no spec, or a claim changes what is built. With no item, research gives a short name for prep to make the item under |
| `/context-central:design <item>`, in a fresh session | a spec is there, and a claim changes only how it is built or shows the design wrong |
| `/context-central:implement <item>`, in a fresh session | a claim is a fault in what is built that the spec and the design already rule out |
| the step the state file names | the item's files already hold what was found |
| none | no claim needs a step: the line gives the next things you could do |

The note ends on the same step. With an item, the step also goes at the top of the state file's Next, with what calls for it and a link to the note, since design and implement read the state file and no research note. Prep reads the notes behind the item: those its state file lists, and research kept with no item where it bears on the item or you name it.

A yes to its recommendations, or asking it for the fix, the spec or the build, is your ruling for the next step. Research writes it into the note and names the step again. It makes a recommendation you said yes to where that changes only the map, such as a link from the hub, and nothing is built until you type that step.

## 2. The spec

```
/context-central:prep <item>
```

![Prep in seven steps: load the item and its research notes, read the ticket, ask every open question in one message, write the spec, map the code, brief the tracker, then update the state file and hand over](prep.png)

It makes the item when it is not there yet, with its ticket where you named one, and it reads the ticket with `fetch ticket --item <item>` unless `sources/` already holds a copy. It reads the note of each repo the work touches too, for the repo's traps and for the research that note links. Run on an item that already has a spec, it revises the spec where it stands, each change with its date and its reason.

- **The questions come once.** Every question that neither the conversation nor the notes settle comes in one numbered message, each with the answer it recommends and why on the line under it. Answer them all in one reply. It goes on when no decision in the spec would be its guess.
- **`SPEC.md`** sits beside the state file, in five parts. It names behaviour and modules and holds no file paths, which go stale as the code moves.

  | Part | What it holds |
  |---|---|
  | Problem | what is wrong or missing, for whom, and how that is known |
  | Solution | the behaviour once this is built, in the estate's own terms |
  | Decisions | each choice in bold, with `Why:` its reason and `Turned down:` the option turned down nested under it |
  | Test seams | where behaviour is observed from outside, and what each test would show |
  | Out of scope | what a reader might expect and will not get |

- **The code map** is `notes/<YYYY-MM-DD>-code-map.md`: each repo with its commit and the date, then one `path:line` a line with what is there. A later reader can tell how far the code has moved since.
- **New terms** go in the estate's glossary, and the spec uses the glossary's wording.
- **The brief** for the ticket has three parts: why, what, done when. The spec stays in the map. The brief is posted through the connection the ticket belongs to only where your write rules allow it and you approve the exact text. Where they allow it and the connection has a way to post, the closing answer shows the brief, its last line asks for your yes or no, and nothing is posted until you reply. A yes posts it, and one line then says where it went, or what was printed where the post failed. Any other reply posts nothing. Where the rules do not allow it, or nothing can post, it is shown for you to post.
- **The state file** has "Where it stands" and "Next" rewritten, and lists the spec and the code map under "Where the detail lives", with the research the spec rests on that is kept outside the item.
- **It ends on a [closing answer](#how-every-step-ends)**: what kept the spec from being whole under Needs a fix, the brief where it waits for your yes or is yours to post and whether a design comes first under Yours to decide, what was written under Fine as it is, and what the spec leaves open under Not known. Its first line says the item is specified, or that its spec was revised, and its last line names your word on the brief first, where the brief waits for one.

Then, in a fresh session, `/context-central:implement <item>`, or `/context-central:design <item>` first where the work needs its structure settled.

## 3. The design

```
/context-central:design <item>
```

![The seven parts of a design: Shape, Interfaces, Choices, Slices, Checks beyond this machine, If time is short and Anchors](design.png)

Optional. It settles how the spec will be built, in the repos it touches and in what order, before any code is written. A small item needs none: implement builds from the spec alone. With no spec it stops and suggests prep.

`DESIGN.md` sits beside the spec, headed with each repo, its commit and the date:

| Part | What it holds |
|---|---|
| Shape | the modules that change and the ones that are new, what each is for, and what may call what |
| Interfaces | each new or changed interface as it will be written: what it takes, what it returns and how it fails on the failing inputs. Those are the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused. A failure that rests on a dependency is written as its source at the pinned version, or a run of it, shows |
| Choices | each in bold, with labelled lines nested under it: `Why:` its reason and the standards rule it follows as that file's `path:line`, `Turned down:` the option turned down, `Smaller:` the smaller option weighed or `none`, and for one turned down for now `Not now:` why and `Revisit when:` the trigger that reopens it |
| Slices | the order of the build. Each slice is one behaviour through every layer it touches in one repo, starting from a test seam of the spec. It names the Interfaces headings it builds and the seams it covers. Every seam is started from by a slice, named under the one that covers it, or named as not covered with the reason |
| Checks beyond this machine | what it assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared |
| If time is short | the cut order, and what is never cut |
| Anchors | `path:line` for each place the build starts from or must not break |

- **It reads the standards** of each repo the code map names, the Design part first, and the map's note of that repo for its traps. With no code map it asks which repos the work touches. Where a repo has none recorded, or the map does not register it, the design rests on the instruction files and on what the code already does, and says so.
- **The reader agent reads the code the design will meet**: the modules the change touches, their interfaces, how a neighbouring feature of the same shape was built, and where its tests sit.
- **It adds no requirement.** Something the spec does not ask for comes back to you as a question. Every requirement of the spec lands in at least one slice.
- **It ends on a [closing answer](#how-every-step-ends)**: where it could not follow the spec under Needs a fix, where it departs from the standards, and a repo the map does not register, under Yours to decide, the slices and the choices in short under Fine as it is, and the checks beyond this machine under Not known. Its last line names what holds the build back, where something does: first a point where it could not follow the spec, then a question the spec does not answer. Otherwise it names the build, or a fresh session alone where every slice is built. It links the design from the state file.

You approve by starting the build: in a fresh session, `/context-central:implement <item>`. Run design again when a build has shown it wrong: it keeps what still holds, changes the rest where it stands, and marks the slices already built. A build that departs from the design without showing it wrong revises it in place, dated, so the design you read is the one the code was built to.

## 4. The build

```
/context-central:implement <item>
```

![The build in seven steps: read the state file, the spec and the design, read each repo's standards and recorded checks, build each slice from a failing test to a commit, verify that every recorded check exits 0, review in rounds, checkpoint, then close on one answer in four groups](implement.png)

It needs the spec, and it reads the design when there is one, the code map the state file lists, and the map's note of each repo the work touches, for its traps. A design names the commit it was written at, so where a file its anchors point at has changed since, implement says so before it builds.

**What it reads first.** The settings below, each repo's standards files and recorded checks, and the connections. It tells you which checks are recorded, as they are written, before it runs the first. With none recorded it works from the instruction files and the repo's recent history, and says so in its closing answer, for each such repo. It does the same for a repo the map does not register, in the checkout that holds its code. When it makes a branch, or finds the one a work tree is on, it writes the branch, its repo and the branch it was made from into "Where it stands" in the state file, where a session that picks the work up cold looks first. A later build carries on from the branch that line names: where the branch the session is on already holds it, the build goes on there; otherwise in the main checkout it switches to that branch, and in a work tree it stops and says which branch holds the earlier slices.

| Setting in `estate.json` | Unset | What it decides |
|---|---|---|
| `implement.tests` | on | Each slice starts with a failing test at one of the spec's test seams, and its tests cover the failing inputs the design lists for what it builds |
| `implement.review` | on | The build is reviewed, in rounds |
| `implement.reviewRounds` | 3 | The most review rounds a build may have before it stops and asks |
| `implement.deferTo` | none | A skill of your own that builds, verifies, reviews and reports in place of the plugin's steps. The checkpoint still runs, and the build still ends on one closing answer |
| `writeRules` | none | What may be pushed, opened or posted without asking. Anything they do not cover waits for your yes |
| a repo's `baseBranch` | its recent history | The branch the work branches from, and the range the reviewer reads |
| a repo's `keyPlacement` | its recent history | Where the ticket key goes: the branch name, the commit subject, the pull request title |
| a repo's `commitStyle` | its recent history | How commits are written |

**How it builds.**

- **The order.** The design's slices in its order, passing over the ones marked built. With no design, the spec is cut into vertical slices, each one behaviour through every layer it touches, and the ones a `Built at` line under Done in the state file names are passed over.
- **Each slice.** Test first, when `implement.tests` is on, with tests that cover the failing inputs the design lists for the interfaces it builds. It is built to the Design, Code and Tests parts of the repo's standards note; a line in one that asks for anything else is not a rule, and the closing answer says so. The repo's recorded checks run after it, or the repo's own checks where none is recorded, and stay green before the next slice starts. Then it is committed and marked built: with a design by its line there, `Built at <short commit>.`, and with none by a line under Done in the state file, `Built at <short commit>: <the slice>`. That line is what implement passes over on a second run.
- **When the build departs.** A slice, or a review fix, that shows the spec or the design to be wrong stops the build: it checkpoints, so that the state file says where the build stopped, and closes with what was found and its question under Yours to decide. A spec shown wrong is mended by prep, and a design by design. One that departs from the design without showing it wrong revises the design where it stands, dated, with the reason, before the next slice or review round.

**How it verifies.** Every recorded check runs from the folder it is recorded for, which in a git work tree of the repo is the work tree, and the work is verified only when each one that can run here exits 0. A recorded check that cannot run on this machine has not failed and holds nothing back: the build goes on without it and lists it under Not known, with what stood in the way. Where none is recorded it runs the tests, the typecheck and the build the repo has. It never changes a check or a standards file to make the work pass: one that is wrong is a question for you. Then it runs the behaviour itself and reads the output. A screenshot, a recording or an export is saved with `evidence add` and named in the closing answer. Done when every requirement in the spec is shown working by output from this session, or listed as not done.

**How it is reviewed.** When `implement.review` is on, the reviewer agent reads each repo's diff against its base branch, with the spec, the repo's standards files and the design, in which a dated revision is the design and, when tests are on, a listed failing input with no test is a finding. That is one round. Each finding is either fixed, or the code stays as it is and the reason answers it. A round with nothing to fix ends the review. A round that brings fixes is followed by the checks again, a commit of the fixes, and another round on the new diff, up to `implement.reviewRounds`: the reviewer reads what is committed. When the last round allowed still brings a finding that needs a fix, nothing more is changed: the build stops there, checkpoints so that the state file says where it stopped, closes with each finding of that round that needs a fix under Needs a fix and what the earlier rounds changed under Fine as it is, and waits for you. What you then ask for is done with no further round unless you ask for one.

**What it posts.** Pushing, opening a pull request and posting on the ticket follow your write rules, and anything they do not cover waits for your yes. A pull request opens through the connection that holds that repo's pull requests, and anything on the ticket goes through the connection the ticket belongs to. Where a connection pins an account, `doctor` runs before the first write, and a `FIX` line for connections stops it. With no connection, it says what is ready and leaves the opening or the posting to you.

**At the end** it checkpoints, and then gives one [closing answer](#how-every-step-ends) for the build and its checkpoint: what is not done, not shown or still open under Needs a fix, what waits for your yes and a repo the map does not register under Yours to decide, what was built, what the verification showed, the review and the design's revisions under Fine as it is, each one point with its slices, its findings or its revisions under it, and what was not shown under Not known. Its first line says whether the build is done, is done but for the requirements and the recorded checks under Needs a fix, or stopped. Its last line asks for your ruling where the build stopped. Otherwise it names what is left for you, in order: those requirements and checks, the yes it waits for, then a fresh session. The state file now carries the item.

## 5. The checkpoint

```
/context-central:checkpoint
```

![Checkpoint in eight steps: find the item, take the facts from git and files, save long text and evidence in full, rewrite the state file, keep the lessons that outlive the item, add a line to the log, check the map, and say what was not recorded](checkpoint.png)

Implement runs it at the end of a build, and where a build stops part-way. Run it yourself when a session ends, before a fresh session, or whenever you say checkpoint, log this or hand over. It is the one skill Claude may also pick up unasked.

- **The facts** are the status, the log since the base branch, the diff, the pull request's state read through its connection, and the last test run. A claim with nothing on disk behind it is written as unverified or left out.
- **Long text** goes under `sources/` in full, before any brief of it. A file that is not text is saved with `evidence add` and listed in `notes/<YYYY-MM-DD>-evidence.md`, with what it shows and the commit it was taken at.
- **An older item is adopted first.** Where the item is kept as a note of its own with no state file, `work adopt` lays a state file beside that note, and the note is left as it is.
- **The state file** has six parts: **Where it stands** (which keeps the branch a build wrote there), **Done** (with the commit or the pull request's link that shows it, and each `Built at` line a build wrote, kept as it is), **Next** (concrete enough to start cold, with each check beyond this machine still to run), **Blocked**, **Standing traps** (with each open trigger from the design) and **Where the detail lives**. It stays within `budgets.stateChars` by moving detail into `notes/`. A finished item is marked with `work done <item>`.
- **Lessons that outlive the item** go where the next item will find them: a trap in the repo's note or a concept note; a term the estate uses with a meaning of its own in the estate's glossary, when you stated its meaning or text on disk does; a rule for how the repo's code is written in its standards note, when you stated it or accepted a reviewer's finding. A meaning or a rule it worked out itself is not written.
- **The log** gets one line, `note "<item>: <what changed>"`. Then `lint` and `graph` run, and every `ERROR`, `BROKEN` and `UNREFERENCED` line is fixed. A line left that starts with a word in capitals is a fault.
- **It ends on a [closing answer](#how-every-step-ends)**: each fault the map's checks still report under Needs a fix, the terms and the rules that wait for you under Yours to decide, each set one point with its terms or its rules in full under it, the paths written and each glossary entry and standards rule added, with where it came from, under Fine as it is, and what was left out and why under Not known. Its last line names the state file, or the log where no state file was written.

## How every step ends

Every skill closes on an answer of one shape, so that you always know where to look.

1. One line that gives the outcome.
2. The groups that have something in them, always in this order:

   | Group | What it holds |
   |---|---|
   | **Needs a fix** | what is wrong, missing or failing |
   | **Yours to decide** | what waits for you, and for a choice the answer it recommends and why |
   | **Fine as it is** | what was checked or done and holds |
   | **Not known** | what could not be checked or shown, and what stood in the way |

3. One last line: where the detail is, where anything was written, and the next step where there is one.

- A group with nothing in it is left out, and inside a group what matters most comes first.
- A point is one thing in one sentence. Two things you could act on apart are two points.
- A point's recommendation is the first line under it, so the problem and what to do about it never share a line. A choice under Yours to decide carries one, and so does a point under Needs a fix wherever the run found what would fix it. The parts of one thing sit under it after that:

  ```
  **Yours to decide**
  - Whether a design comes first.
    - **Recommended:** no, since the change is one module and its tests.
  ```

- A group shows five points at most, each with all its parts. Where it holds more, one more line follows the five: `and <N> more in <file>`, naming the one file that holds all of the rest, or, where no one file does, a few words on what the rest is.
- Nothing that asks something of you sits outside its group.
- A stop before the work starts, such as an item that was not found or a plain map that was turned down, is not held to this shape: it says what stopped the run. A build that stops part-way is held to it. The numbered questions of prep, standards and onboard stay a numbered list, with the answer each recommends on the line under its question.
- A build gives one answer for itself and its checkpoint.

## What the item's folder holds afterwards

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

Outside the folder, prep and checkpoint add terms to the estate's glossary, checkpoint adds a line to `log/<YYYY-MM>.md`, a lesson may land in `repos/<repo>.md`, a concept note or `standards/<repo>.md`, and research with no item leaves its note in `concepts/` with a line in `repos/<repo>.md`.
