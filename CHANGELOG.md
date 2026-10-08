# Changelog

Each release of context-central, newest first. The version is the one in `.claude-plugin/plugin.json`. An installed copy stays on its release until `claude plugin update context-central@context-central` finds a newer one.

## 0.7.0 - 2026-10-08

- **The design has seven parts.** Two are new. **Checks beyond this machine** lists what the design assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared. **If time is short** gives the order in which the work is cut and what is never cut. Either may say `none`.
- **How an interface fails is written against the failing inputs.** The design step reads the source of the dependency an interface rests on, at the version the repo pins, or runs it, and writes how the interface fails on the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused. What neither the source nor a run shows goes under Checks beyond this machine. `CONTEXT.md` defines the term, and the reviewer follows each changed path with the same inputs.
- **A choice records the smaller option.** Each choice names the smaller option weighed, and one turned down for now says, on one line, why not now and what reopens it. Checkpoint carries each open trigger into the state file's Standing traps, and each check beyond this machine not yet run into Next.
- **A slice says what it builds and covers.** Each slice names the Interfaces headings it builds and the test seams it covers. Every seam of the spec is covered by a slice, named under the one that covers it, or named as not covered with the reason, and a seam with no slice and no reason is a question for you.
- **The build proves the failing inputs and marks each slice built.** A slice's tests cover the failing inputs the design lists for the interfaces it builds. When the checks are green, the slice is committed and ends in the design with `Built at <short commit>.`, which is the line implement passes over on a second run.
- **A departure revises the design in place.** A slice or a review fix that departs from the design without showing it wrong revises the design where it stands, dated, with the reason, before the next slice or round. A slice or a fix that shows the design wrong still stops the build. The reviewer reads a dated revision as the design, and where the design lists failing inputs for an interface the diff builds, a listed input with no test is a finding.
- **Why.** One live build of a design was read for this release. The code never drifted from the design. The design drifted behind the code after review fixes, and every real defect was a failure mode the design and the code both missed.

Not shown:

- No build has yet written a built line or a revision into a design through the released skill, and no real build has run with these rules. What a stand-in run showed is in the release's pull request.

For a map that already exists:

- A design written before this release has five parts. Implement reads it as before, writes a built line where a slice ends, and asks nothing about the two parts it lacks. Run design again to add them.

## 0.6.1 - 2026-10-07

- **The README walks through a piece of work.** A new part, "A piece of work, step by step", says what each of the five steps starts from, asks and writes: research, the spec, the design, the build with its review rounds, and the checkpoint. It lists the settings the build follows, which the README had not named, shows what a work item's folder holds after the five steps, and ends with the order to run them in, from the install onwards.
- **Small corrections to the reference parts.** The Commands table says that `work new` takes `--title` and `work list` takes `--all`, that `fetch ticket --item <item>` with no reference reads the item's own ticket, and which flags `slice` takes beyond its four ways of choosing a part. The fetcher's row says it starts without `CLAUDE.md`. "First run" lists what `onboard` offers once it has proved the connections, and that it ends with `doctor`.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.6.0 - 2026-10-07

- **Connections.** An estate records each outside system it uses under `connections` in `estate.json`. An entry has a name and says what it holds (tickets, pull requests, meetings, chat or any other word), how a reference to it looks, and how it is reached: by a preset, by an MCP server your session holds, by your own command, or by hand. An estate can have any number, and none is required: with none, every command, hook and skill works as it did. One is recommended, so that a session can read the ticket or the pull request behind the work.
- **Presets, and no vendor built in.** What the plugin knows about one vendor's system is one file in one folder: how its references look, which program reads from it, how a checkout's remote reads as it, and the parameters it takes. This version carries presets for GitHub, Jira and Azure DevOps, and `context-central connections --presets` lists them with what each takes. No other code, and no skill or agent, names a vendor or the program one starts.
- **A work item answers to its ticket in any spelling.** `PROJ-12`, `#41`, `AB#4312` and a link can each name a ticket, whatever the letter case and never inside a longer word. A work item with a plain name carries its ticket on a `ticket` line in the head of its state file, which `work new <item> --ticket "<reference>"` writes. A link that belongs to any connection resolves, where only a GitHub pull request link did.
- **`fetch ticket|pr "<reference>"`** reads a ticket or a pull request through the connection the reference belongs to, with the read command of that connection's preset, and saves the full text in the item's `sources/`. `--connection <name>` names the connection where more than one holds the kind, `fetch ticket --item <item>` with no reference reads the item's own ticket, and `--check` in place of `--item` tries a connection and saves nothing. The plugin never starts a program that the settings name, and what it puts into a preset's command from a reference or from the settings is one word that does not start with a dash.
- **A `connections` command.** It lists each connection and how this machine reaches it: by fetch, by a session through a server or your own command, or by hand. With `--ticket` or `--pr` and a reference, or `--item` and a work item, it lists only the connection that belongs to, which is the one `fetch` reads through.
- **`doctor` and `detect` work through the presets.** `doctor`'s last check is `connections`, and it has a new kind of line, `note`, for something worth knowing that needs no fix. A tool that is not installed is a note, and so is a map with no connection. A pinned account that is not the active one is still a fault. `detect` reports the tools, the accounts and the connection candidates it finds.
- **The hooks say what the estate reaches.** The live index names the connections at the start of a session. A prompt that names a ticket no work item answers to gets one line saying so, and which connection it reads as: once a session for a reference, three at most, and never for a bare number.
- **The skills and the fetcher work through connections.** A skill never picks a connection for itself. A read starts with `fetch`, which finds the connection or names it and says how a session reads it, and before anything is posted on a ticket the skill asks `connections --item <item>` which connection the ticket belongs to. `research` makes a work item for a ticket that is new to the map, `prep` reads the item's ticket before it writes a spec, and `implement` opens a pull request through the connection that holds that repo's pull requests and runs `doctor` before a first write where an account is pinned. `onboard` asks for the estate's connections, where it asked for a tracker, a code host and sources, and proves each with one read that saves nothing. The fetcher finds a server's tool by search, saves with its file tool and only reads.

Not shown:

- Of the presets' read commands, only GitHub's has been run against the real tool. Jira's and Azure DevOps's were written from their vendors' documentation and run against stand-ins that take only the flags that documentation shows. `context-central fetch ticket "<reference>" --check` shows whether one works for you.
- No skill has opened a pull request or posted on a ticket through a connection in a live run. A skill posts only where your write rules allow it and you approve the exact text.
- The fetcher has read through a server that needed no sign-in, and through none that needs one.
- On Windows the plugin does not start a tool that is installed only as a `.cmd` or a `.bat` file. `fetch` says so, and a session reads that connection through its own shell or a server. Nothing has shown what `fetch` does there with an answer from a preset's tool.

For a map that already exists:

- It needs no edit. With no `connections` in its `estate.json` it is read as it was: its tracker, its code host and its sources are shown as connections, and `fetch pr` and `fetch issue` go on working. `context-central connections` lists them.
- The text at the start of a session gains one line, which names those connections. It counts against `budgets.indexChars`, which is 2,000 characters unless set. On a map whose live index was close to that, the last work items give way to a line that counts them, and `lint` warns.
- `doctor`'s check `gh` is now `connections`. A tool that is not installed no longer fails it: the line is a `note` and the exit code is 0. A map with no tracker, code host or sources gets a note that recommends a connection. In `doctor --json` every check has a `note`.
- A prompt, or `resolve`, that names a ticket key no work item is named after gets the line `PROJ-99 reads as a ticket of connection <name>. No work item answers to it.`, where `resolve` found no confident match and the hook said nothing.
- A work item named with a key and more words, such as `PROJ-30-audit-log`, does not answer to `PROJ-30`. It did not before, and that line now says so, even beside the item's own pointers. Add `ticket: "PROJ-30"` to the head of its state file and it answers. 0.5.0 reads a state file with that line as it did without it.
- `fetch issue` with a key or a link of the map's own tracker reads through that tracker's preset where it has one, and is no longer handed to `gh`. Where it has none, or the preset's tool is not installed, `fetch` says so, and says how a session reads the ticket where the map records a way. A reference that no connection claims goes to `gh` as before.
- `work new` with a ticket key for a name writes the `ticket` line itself.
- `detect --json` gives the accounts under `accounts`, by preset, where it had `ghAccounts`, and gains `connectionCandidates`. `index --json` gains `connections`, each item of `work list --json` gains `ticket`, and `resolve --json` gains `unanswered` when a ticket named has no work item.
- To move a map over, write `connections` by hand in the shape the README gives. No command rewrites a map. The old `tracker`, `codeHost` and `sources` are then no longer read. 0.5.0 passes over `connections`, so a map that several people share can hold both shapes until all of them have updated.

## 0.5.0 - 2026-10-06

- **A standards note for each repo.** `standards/<repo>.md` says how that repo's code is designed, written, tested and reviewed, in four parts, and every rule in it names its source: the file that shows it, or who said it and when. The plugin carries no rule for any language, framework or build tool, and with nothing recorded for a repo every skill works as it did.
- **Recorded checks.** A repo's entry in `estate.json` may list `checks`, the commands whose exit codes say its code passes, and `standards`, other files the repo already keeps for people. `context-central standards [<repo>]` prints both, with the standards note marked.
- **A `standards` skill.** `/context-central:standards <repo>` drafts the note and the checks from what the repo declares about itself, puts what the files cannot answer to you as numbered questions, and writes only on a yes. It runs no command taken from a repo's files before you have read it.
- **A `design` skill.** `/context-central:design <item>` settles how a spec will be built before any code is written: the modules, their interfaces, each choice with its reason, and the slices in order, in the item's `DESIGN.md`. It is optional, and you approve it by starting the build.
- **`implement` builds to the standards and reviews in rounds.** It counts work as verified only when every recorded check exits 0, follows a design when there is one, and has the reviewer look again after each set of fixes: three rounds at most, unless `implement.reviewRounds` says otherwise. When the last round still brings a finding that needs a fix, it stops and asks. Before, a build was reviewed once and its fixes were not reviewed.
- **The other parts use them.** `checkpoint` adds a rule to the standards note only when you stated it or accepted a finding. The reviewer holds a diff to the standards and the design it is given. The resolver lists a repo's standards note straight after its repo note, and `lint` warns when a listed standards file is not there.
- **A file where a folder would go no longer ends in a stack trace.** A command that reads the map passes over it, and a command that writes says in one line which name is a file.

For a map that already exists:

- If it is kept in git behind the allow-list `.gitignore` that `init` writes, add `!/standards/` to that file, or the new folder is left out of its commits. `doctor` says so on a new `notes` line.
- If it sets `nodeDirs`, add `standards` to that list to have standards notes. A map that leaves the setting out gains the kind.
- A root-layout estate that already has a folder or a repo named `standards` at its root has its Markdown read as notes from now on, as a folder named `docs` already is. Set `nodeDirs` without `standards` to keep it as it was.
- A repo entry that already had a key named `standards` or `checks` of another shape makes every command refuse the settings until the key is renamed.
- An existing hub does not gain the `standards/` line in its list of parts. Add it by hand if you want it there.
- A `DESIGN.md` beside a spec is now read by `implement` as the design.

## 0.4.0 - 2026-10-05

- **Checkpoint writes the session's terms to the glossary.** A word, an abbreviation or the name of a system that the estate uses with a meaning of its own goes in the map's `glossary.md` at a checkpoint, when its meaning was stated by the person or in text on disk. A term the person corrected has its entry rewritten where it stands, with the word they ruled out on its `_Avoid_` line. A new entry keeps that line, left empty when no word was ruled out for it.
- A term that was used and never defined is not written, and an entry that a source disagrees with is left as it is until the person rules. The closing report names both, with each entry added or changed and where its meaning came from. A map with no `glossary.md` gets none, and the report carries the terms.
- Nothing changes in what the commands, the hooks, the agents or the other skills do.

## 0.3.0 - 2026-10-05

- **A simpler README.** It opens with a picture of how the plugin works, then what it does, how it helps, the core idea and how it works day to day. Every part it had before is kept, laid out as short sentences, lists and tables.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.2.0 - 2026-10-05

- **Needs Node 22.18 or later.** It was Node 20, which reached its end of life in April 2026. On an older Node a command says so in one line, and the hooks stay quiet apart from one message at the start of a session.
- **Written in TypeScript.** The whole program, its tests and its scripts are TypeScript checked in strict mode. Node runs it as it is, so there is still nothing to compile or install, and with Node 24 a start takes as long as it did before. With Node 22 a start took 30 to 50 ms longer on the one machine it was measured on.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.1.0 - 2026-10-04

The first release.

- **A context map.** One hub file routes a task to its notes, each piece of work in flight has a small state file, notes are kept by kind, and long text is saved in full in a deep tier that is read only when needed. The map sits at the root of a folder of repositories, or inside one repository.
- **Two hooks.** At the start of a session, the live index: the map, the hub and the work in flight. On a prompt that names a work item, a repository or a pull request, a short list of pointers to the notes behind it, delivered once a session.
- **A command, `context-central`.** It sets up and checks a map (`init`, `doctor`, `lint`, `graph`), works with it (`work`, `resolve`, `note`, `evidence`, `fetch`) and saves a launcher for use from a terminal (`wrapper`). `context-central help` lists every command.
- **Five skills and three agents.** The skills are `onboard`, `research`, `prep`, `implement` and `checkpoint`; the agents are `reader`, `fetcher` and `reviewer`.
- **Evidence.** Screenshots, recordings and exports go in a work item's `evidence/` folder, which the commands count and never open.
- **Linux, macOS and Windows.** The tests run on all three with Node 20, 22 and 24. On Windows the plugin has been tried on GitHub's machines only, not in a live Claude Code session; the README lists what was shown there and what was not.
