# A research's folder

One research is one folder of the map, made by `context-central research new`, and everything a run finds goes into it. It is written to be read by someone who has the folder and nothing else, such as another planner. So:

- Every file is plain Markdown.
- A file links only the research's own files, by a path counted from the file itself, and a full address. With an item it may also link a file of that item's `sources/`.
- No file the run writes names a step, a skill or a command that starts one. What comes next is said in the closing answer and, with an item, in its state file, never here.
- A fact's words never change once it is written, a number is never used again, and a saved source is never edited: it is kept as it came, whatever it says.

`research new` wrote five files and an empty `sources/`. Each file has its headings already: write under them, and leave the headings and the lines above them as they are. The plugin reads the lines below in the form given here. `context-central research open` counts them and `context-central lint` warns of one it cannot read, so keep each to its form.

## The fact sheet

`index.md` holds what was found, under its five headings:

- `## Questions`: the questions, numbered `Q1` on. Each asks what is so, never what is wanted.
- `## Check again by`: one day, as `<YYYY-MM-DD>`, then why that day. Take it from the `dates:` line of `research open`: the later of the two days it gives where what was found is settled, such as released code, and the nearer where it moves, such as open work.
- `## Not reached`: each thing the questions needed that the run could not reach, one a line: what was wanted, what pointed at it, and how it could be reached, in plain words. A line that says `none` where there is none.
- `## Facts`: the facts that stand, in the order of their numbers.
- `## Sources`: every source a fact names, on the sheet or in the log, once, with its kind.

````
## Questions

- Q1: How many times does the gateway retry a failed call?
- Q2: What limit does the gateway set on calls a minute?

## Check again by

2026-11-29: the limiter is being rebuilt, so what is here may move.

## Not reached

- The notes of the last outage | the second comment on the ticket points at them | connect the place the notes are kept, or paste them

## Facts

- **F7** `verified` The gateway retries a failed call three times.
  - Source: [03-2026-11-22-chat-retries-full-text.md](sources/03-2026-11-22-chat-retries-full-text.md)
  - Source: `api/src/gateway.js:41-58` at `3f2a9c1`
  - Supersedes F3, 2026-11-22: the count was raised from two.
- **F8** `inferred` An export retries the same way, since it calls the gateway.
  - From: F7 and `worker/src/export.js:12` at `9c04e7d`
- **F9** `verified` `disputed` The limit is 100 calls a minute by one source and 60 by the other.
  - Source: [04-2026-11-22-mail-limits-full-text.md](sources/04-2026-11-22-mail-limits-full-text.md): 100
  - Source: https://example.com/limits: 60
- **F10** `verified` Every client is given the same limit.
  - Source: [01-2026-01-09-PROJ-12-full-text.md](../../work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md)

## Sources

- [02-2026-11-21-pr-88-full-text.md](sources/02-2026-11-21-pr-88-full-text.md): pull-requests
- [03-2026-11-22-chat-retries-full-text.md](sources/03-2026-11-22-chat-retries-full-text.md): chat
- [04-2026-11-22-mail-limits-full-text.md](sources/04-2026-11-22-mail-limits-full-text.md): mail
- [01-2026-01-09-PROJ-12-full-text.md](../../work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md): tickets
- https://example.com/limits: web
- `api` at `3f2a9c1`: code
- `worker` at `9c04e7d`: code
````

**A fact** is a list item at no indent: `- **F<n>** `, its mark in backticks, then one sentence that says one thing.

- It says the thing itself, and never that a source says it: `Export files are kept for seven days`, with a `Source` line for each source that says so, and not `The thread says that files are kept for a week`. Who said a thing, and where, is what its `Source` lines are for. The one fact that is about a source is what a source says against what holds, as below.
- Its number is the next one: the `facts:` line of `research open` gives it when the round is opened, and each fact written after it takes one more.
- The first mark, `verified`, is earned only where the source itself was read in this run, by the session or by an agent that was handed the source and gives the lines it read: the code at a commit, the saved text of a ticket or a thread, the page at its address. A search result, a digest, a summary, a recollection and a note of the map are leads and not sources: read what they point at, or mark the fact `inferred`.
- Under a fact marked `verified` there is a `- Source:` line for every source that says it, and under one marked `inferred` one `- From:` line, with the facts it was reasoned from, by number, and anything else.
- Two sources that say one thing are one fact with a `Source` line for each, never two facts, however differently they word it: a thread that says a week, a record that says seven days and the code that sets 7 say one thing. The same holds where the question names the sources: what they say is not a fact for each of them.
- Where sources disagree and the run cannot tell which holds, write one fact that says what each holds, with `disputed` in backticks after its mark, a `Source` line for each, and after each a colon and what that source says. Where the run can tell, as where one of them is the thing itself, such as the code that runs, nothing is disputed: one fact says what holds, with every source that says so, and what another source says against it is a fact of its own, about that source. That fact names the source, what it gives and the number of the fact it goes against, as `The page at https://example.com/limits gives the limit as 100 calls a minute, against F7`, with that source under it. Its mark is `verified`, since the source itself was read.
- A fact that no longer holds is superseded, never rewritten. The fact that takes its place has the next number and a line under it, `- Supersedes F<n>, <YYYY-MM-DD>: <the reason>`. The older fact leaves the sheet for the log, as below.

**A source under a fact** is one of three things:

- A saved file, as a link, `[<file>](sources/<file>)`. A file the item saved is linked the same way, by its path from the sheet's folder.
- A page on the web, by its full address.
- A line of code, as `` `<path>:<line>` at `<short commit>` `` or with a range, `<first>-<last>`, in place of the line. The path is counted from the estate root, which `context-central where` prints, and the commit is the one of that repo the line was read at, which `git -C <the repo's folder> rev-parse --short HEAD` prints. Two places in one file are cited apart, each as its own `<path>:<line>`, and never as one with a comma.

**The list of sources** gives each source once, then a colon and its kind. For what came through a connection the kind is the word that connection `holds`, as `context-central connections --json` gives it. Otherwise it is `web` for a page, `paste` for pasted text, `note` for a copy of a note of the map, and `code` for a repo, written as its name and the commit read. `context-central graph` reports a saved source that no file names.

Where the `sheet:` line of `research open` says the sheet is past its size, move facts, whole and word for word, to pages beside it named `facts-<subject>.md`, a subject in small letters, digits and dashes, and list each page under `## Facts` with the numbers it holds.

## The brief

`brief.md` holds what was asked and where the run looked:

- `## Questions`: the same questions as the sheet, with their numbers.
- `## Sources to cover`: each place the run will look, a line each: a connection, a repo, a page.
- `## Depth`: the depth of the run, with its two caps.
- `## Out of scope`: what the person said to leave out, a line each, or `none`.
- `## Start line`: what the run goes with: each connection and how it is reached and searched, each tool of the session that the map does not record, each kind the questions need that nothing reaches, and whether git keeps the folder.

It is written before anything is gathered, and `references/run.md` has how.

## The log

`log.md` gets one entry for each round, added at its end when that round's reading is done, before the next round is opened, and never changed afterwards. Two rounds are never written in one go. A round's number is one more than the `rounds:` line of `research open` gives when the round is opened, and 1 where that line says `none`. Its day is the one the `dates:` line gives.

````
## Round 3, 2026-11-22

- Answered: Q1 by F7 and F8
- Open: Q2, which F9 leaves disputed
- New leads: Retry policy review | https://example.com/wiki/retry-policy | 2026-11-02 | it may give the reason for three tries
- Set aside: Release notes 4.1 | they name the gateway only in passing
- Gaps: The notes of the last outage | the second comment on the ticket | connect the place the notes are kept, or paste them
- Stopped: a round added no fact and no lead

### Superseded

- **F3** `verified` The gateway retries a failed call twice.
  - Source: [02-2026-11-21-pr-88-full-text.md](sources/02-2026-11-21-pr-88-full-text.md)
````

- `Answered` and `Open` name the questions by number, with the facts that answer each. Several are joined by commas, as `Q1 by F7 and F8, Q2 by F9`, and a line with nothing to name says `none`.
- `New leads`, `Set aside` and `Gaps` hold one thing each in the forms above, the parts parted by ` | `. For more than one, the line is written again for each, and a line with none says `none`. A lead is something that may bear on a question and was not read: its title, its address, the date the source gives it, and why it may bear. One judged beside the point is set aside with its reason, never dropped. A gap is what was wanted and could not be reached.
- `Stopped` is written at no indent, in the last round of a run only: the test that stopped the run, as `references/run.md` words it. A check of a research that is there writes an entry of its own form, which `references/checks.md` gives.
- `### Superseded` is there only in a round that superseded a fact. The fact is moved under it from the sheet, word for word, with the lines under it.

## The set-aside list

`set-aside.md` holds what was judged beside the point, a line each under `## Set aside`, as `- <title> | <its address or its saved file> | <why>`. The person moves a line under `## Bring in` to have it read, and no round uses what is still under `## Set aside`.

## The reading

`reading.md` is the judgement of the facts, written for the person. Each run adds one part at its end, headed `## <YYYY-MM-DD>` with the day of the run: the questions, as the brief has them, the answer in a few lines, then the four groups of the closing answer in its order, Needs a fix, Yours to decide, Fine as it is and Not known, each a heading `### <group>` with its points under it, or `none`. It holds the points that rest on what was found, what was not reached and each lead left open among them, under Not known, and not the ones about the run itself, such as a link that is missing or a command that refused. A point starts on a line of its own and names the facts it rests on by number, as `(F7, F8)`. Its recommendation, where it has one, is the line under it, as `- **Recommended:** <the answer, and why>`. A fact's sources are not repeated in the reading: its number leads to them.
