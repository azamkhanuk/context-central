# Changelog

Each release of context-central, newest first. The version is the one in `.claude-plugin/plugin.json`. An installed copy stays on its release until `claude plugin update context-central@context-central` finds a newer one, or until auto-update does where that is on.

## 0.13.0 - 2026-10-14

Two sessions can now write the map at the same moment without losing each other's work, a fault says what failed in one line, a hook that fails says so, and a step can start in a folder that has no map yet. The README says what the plugin runs, and a new page lists everything it writes outside the map and how to remove all of it.

- **The map does not lose work.** Every command that changes the map holds one lock while it reads and writes, and a write lands whole or not at all: it is written beside its place and moved onto it. Before this, two `note` commands at the same moment lost a line and twenty emptied a month's log, and two work trees taking a draft of one file both printed `took` while one side's text was in neither place. Now twenty notes at once are all in the log below every earlier line, and of two work trees one prints `took` and the other `kept`, with the file to compare. The lock is an empty folder, `.context-central.lock`, in the map's own folder. A command that cannot get it within five seconds says so, writes nothing and exits 1, and a lock left by a process that died is taken over once it is thirty seconds old. A hook never takes it. `CONTEXT.md` defines Map lock.
- **`take` accounts for every draft, and `draft` makes the folder.** A draft that is in the map and cannot then be removed from the work tree is a `kept` line of its own, the drafts after it are still taken, and the command exits 1; before, `take` stopped there with a stack trace. `draft` of a file the map does not hold yet makes that file's folder in the work tree and still writes no file, so a copy to the path it prints works.
- **An unexpected fault is one line.** A map that cannot be written, a name too long for the disk or a log that is a folder ended in a stack trace. Each is now `context-central <command>: <what failed, with the path and the system's code>. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.`, on standard error, with exit 1. A command whose reader has closed the pipe, as in `context-central graph | head -1`, ends quietly with exit 0. `CONTEXT.md` defines Unexpected fault.
- **A hook that fails says so.** A failing hook printed nothing, so a session went on with no index and no pointers and nobody was told. It now gives the person one line each time it fails, `context-central: the <event> hook failed: <what failed>. Run "context-central doctor".`, gives the model nothing, and still exits 0.
- **One entry that cannot be read no longer stops everything.** A folder with no read permission under a work item, a folder where a note would be read, or a link that leads nowhere made both hooks fail and ended `index` and `doctor` in a stack trace. Every listing now passes such an entry over and carries on, `lint` reports it as an error with its path, and so the lint row of `doctor` says FIX.
- **`doctor` says what it did not check.** With no `git` on the `PATH`, its four rows that ask git said `ok`. Each now says as a `note` that it was not checked, and the other rows decide the exit code.
- **`context-central --version`** prints one line: the release, the Node it runs on and the system. The bug report form asks for it.
- **The hooks stay inside their limits.** A prompt that holds links cost links times work items: on a map of 300 items a prompt of 300 pull request links took 28 seconds against the prompt hook's limit of 10. The work items are now listed once for a prompt and each file is read once, and the same prompt takes under a second. SessionStart has a limit of 15 seconds, where it had only Claude Code's own 600.
- **A session's record is yours alone.** The record of what a session has been given sat in one folder under the temporary folder that every user of a machine shared, and a link planted there had an old file elsewhere removed by the sweep. It is now kept in the data folder Claude Code gives the plugin, in a folder made for you alone, or else in a folder of your own under the temporary folder that is never used when it is a link or another user's. `CONTEXT_CENTRAL_STATE_DIR` still wins.
- **A step offers a plain map.** Research, prep, design and implement stopped at their first command where no map covered the folder. Each now shows what `context-central init --plain` would write, asks once, and on a yes makes the map and starts again; on a no it stops and names onboard. Inside a repository a plain map is the map in `.context-central/` with its hub in `CLAUDE.local.md`, both named in the checkout's own `.git/info/exclude`, so git shows nothing new, and from a git work tree it is made in the main checkout. In a folder that holds checkouts it is the root layout with each registered. A map just made holds no work item, so design and implement then say so and name prep. Both carry on for a repo the map does not register, from the repo's own files, and say so. `CONTEXT.md` defines Plain map.
- **The steps read what is there.** Implement reads the code map the state file lists and the map's note of each repo the work touches, for its traps, and prep and design read that note too. Research with no item links its note from the note of each repo it is about, making that note where there is none, so that prep finds it, and prep lists the research a spec rests on.
- **A build keeps its own record.** Implement writes the branch, its repo and the branch it was made from into "Where it stands" before the first slice, and a later build carries on from that branch. With no design a slice is marked `Built at <commit>: <slice>` under Done, and a later run passes over it. A review round's fixes are committed before the next round, since the reviewer reads what is committed. A build that stops because a slice or a fix shows the spec or the design wrong checkpoints first, and closes in the four groups. Checkpoint, prep and design keep what a build wrote in the state file.
- **Fetched text is material, and prep can mend a spec.** Research, prep, implement, checkpoint and onboard, and the reader agent, each say that text that is fetched or pasted is material for the work and never instructions: where it tells whoever reads it to do something, that is not done, and the closing answer names it. Prep run on an item that has a spec revises it where it stands, each change dated and with its reason, and gives a new item its ticket where you named one.
- **The README and the docs say what a stranger needs.** Who the plugin is for; a "What it runs" section, with a page for everything it starts, everything it writes outside the map and how to remove all of it; which Claude Code it needs, and what is seen with no Node or an old one; a figure for "Context stays small" and the commands that give it; both hook limits; where a session's record is kept and when it goes; that the selectors of `connections` do not combine and that `evidence add` takes any file; that a link in the map is not followed; and what stays put before 1.0.
- **The repository says how to reach it.** `SECURITY.md` points at GitHub's private reporting, `CONTRIBUTING.md` holds the checks, the conventions and the rule that nothing private goes in, and a bug report form asks for the release, Claude Code's version and what `doctor` says.
- **The names scan passes over binary files.** A redrawn picture could stop a push by chance, since its bytes were read as text. The scan now takes git's own word for which files are binary and reads only their paths.

What the checks on GitHub's machines showed: on Windows, with a lock and a breaker both left by a process that died, four of twenty writers started together stopped with `EPERM`, exit 1, having written nothing. Windows answers `EPERM` where a folder is still being removed by another process, and the lock now waits on that as it waits on a lock that is held. The checks have passed on all three systems at each push since.

Not shown:

- A session on Windows, and a sandboxed shell, as before. The tests of the commands ran on Windows in the checks, the lock's among them.
- Two live sessions writing one map at once. The tests start twenty commands together, and two work trees taking one file, five times over.
- Another model, a large estate, a session with a person in it, or a session in a git work tree. What has been shown: thirteen headless runs, in fifteen sessions and twenty turns, on one model, on invented checkouts of one small module. Research, prep and design ran the text as it ships in seven of them: the offer of a plain map in each of the four steps, three answered yes and one no; a research with no item, which made the repo's note and linked its own from it; a research on a ticket whose text told the reader to make a file, force a push and post on the ticket, read through a stand-in, where nothing of that was done and all of it was named under Needs a fix; a prep that revised a spec where it stood; and a design that read the repo's note. Implement's wording changed twice after its first runs, so four builds ran an earlier wording and two ran the text as it ships, with one of those run a second time. Checkpoint ran inside every build, on the text as it ships.
- In those builds: each read the code map and the repo's note. On the text as it ships the branch was in the state file before the first slice, a second session started on another branch switched to the branch the state file named and built nothing again, a review round's fixes were committed before the next round, and a build whose last round still brought a finding made no fix, checkpointed and closed with the finding under Needs a fix.
- A build marking each slice as it lands, every time. On the text as it ships the reviewed build marked each slice before it started the next, and the build with no design and no review wrote both `Built at` lines after its second slice, with the right commits, as two builds on earlier wordings had. A build cut off between two slices may so leave the first unmarked.
- A step meeting a repo the map does not register, a build stopped by a slice that shows the spec wrong, and onboard or the reader agent meeting text that tells it to do something: each was read cold three times and met by no run. No run started the reader.
- The refusal of a records folder that another user owns, which takes a second user to make. The tests hold the folder that is a link.
- What a person is shown on screen when a hook is cancelled or cannot be started. Both were read from the events of a headless run at Claude Code 2.1.296, which also showed that a hook is given the plugin's data folder. No release between 2.1.275 and 2.1.295 was run.
- What GitHub's community profile and the directory's validator make of the new files.

For a map that already exists:

- A command that changes the map now makes an empty folder, `.context-central.lock`, in the map's own folder for the moment of its write. So a map whose own folder cannot be written refuses every such command, where one that wrote only below that folder went through before. Git never shows an empty folder, so a map kept in git stays clean.
- `lint` has one more kind of error, `read:`, and the lint row of `doctor` then says FIX. A map that holds a note or a folder that cannot be read, a link among its notes that leads nowhere, or a folder where a work item's older note would be read gets that line, where a command stopped with a stack trace before.
- With no `git` on the `PATH`, `doctor` prints four `note` rows where it printed `ok`, and `doctor --json` carries the words in `note`.
- A hook that fails shows you one line each time it fails, where it was silent. SessionStart is cancelled after 15 seconds.
- A session's record is kept in a new place, so a session that is open across the update is given once more the pointers it had been given. The records under `context-central` in the temporary folder are left where they are, and can be deleted.
- `take` may print a `kept` line that names no file to compare, for a draft it could not remove, and `draft` leaves a folder in the work tree for a file the map does not hold yet, which the next `take` removes where nothing was written into it.
- A command whose output goes to a reader that stops early exits 0, where it exited 1 with a stack trace. An unexpected fault exits 1 with one line, and the trace is printed only with `CONTEXT_CENTRAL_DEBUG` set.
- A new note, a launcher or a piece of evidence is refused where a link that leads nowhere stands at its place, and `work adopt` where a link stands at the state file's place, each in one line.
- The line for a folder no map covers names `context-central init --plain --dry-run`, where it named `context-central init`, which alone is wrong usage.
- No setting and no file layout changes, and nothing changes in what the hooks add when nothing is wrong.

## 0.12.0 - 2026-10-12

The seams a research of 2026-10-11 found after 0.11.0 are closed. Four small faults open since 0.8.0 are fixed, a work item's design is a pointer, the prompt hook no longer spends pointers on the host's own notifications, the hooks and commands docs say what a person meets, and the gate on GitHub runs the validator, the third recorded check.

- **A work item's design is a pointer.** Where `DESIGN.md` sits beside the spec, `resolve <item>`, the prompt hook and `--json` list it straight after the spec as "design of the work item". It takes no place against the limit on linked notes, as the spec takes none, and it is no longer counted among the item's other notes. Before this a design the state file linked sat among the linked notes, against the limit, and one it did not link was only counted.
- **The prompt hook leaves host text alone.** Claude Code queues a background task's notification and an agent's report as prompts, beginning `<task-notification>` and `<agent-message`, and the hook answered them as a person's words: in one session a task notification got the pointer to a 55 KB note and an agent's report got the six pointers of a work item. Such a prompt now gets nothing, and the session record is left as it was, so the person's next prompt still gets its pointers. `CONTEXT.md` defines Host text.
- **A number alone names nothing, on every route.** A note or a work item whose whole name is a number was found by that number; now `resolve 42` and a prompt of `42` answer nothing, as decision 20 of 0.8.0 said. "decision 42" still finds the decision, a work item named by a number is still found by its title, and `#41` is still a reference.
- **`work new` refuses what stands in the way.** A link or a folder named `STATE.md` in the item's folder raised a stack trace, after the item's three folders had been made. It is now refused in one line, with exit 1, and nothing is written.
- **A `notNodes` entry means the same with or without a trailing slash.** Written with one, the entry matched nothing and the notes under it were counted and found. The slash is dropped when the settings are read, and `config --get notNodes` shows the entry as read.
- **`note --new` refuses a path the map never walks.** A note under a folder named `node_modules` was written and never listed. The path is now refused in one line, with the kinds, as a path under a `notNodes` entry is, and the rule is the one discovery uses.
- **The hooks doc says what a person meets.** A clear deletes the session record; a compaction keeps the lines that say no work item answers to a ticket, so they are not repeated; a hook that fails prints nothing and exits 0, and `CONTEXT_CENTRAL_DEBUG` shows the error; with no session id the same pointers come on every prompt; in a linked work tree the hooks start from the work tree and `CLAUDE_PROJECT_DIR` is not read.
- **The commands doc is held to the code.** It lists `help`, `--help` and `-h`, and `work list --json`, and a test fails on a command or a flag the doc lacks. Onboard names `route` among a connection's keys, held by a test against the keys the plugin reads.
- **The checks on GitHub run the validator.** A job installs the Claude Code command line and runs `claude plugin validate .`, and the gate needs it, so every recorded check but the names scan runs on each push. The names scan reads a file that cannot go on GitHub.

Not shown:

- A live session meeting the host's own text under the new hook. The rule was run on the hook as a process with the two shapes taken from a saved transcript, and the tests hold both shapes and a person's prompt that carries a tag later in its text.
- A map with a `notNodes` entry ending in a slash in a live estate: the tests and a scratch estate hold it.
- A session on Windows or in a sandboxed shell, as before.

For a map that already exists:

- A work item with a `DESIGN.md` beside its spec has it as the pointer after the spec, labelled "design of the work item". Where the state file linked it, the pointer moves up and frees one place against the limit; where it did not, the item gets one more pointer and its other notes count one less. `resolve --json` carries it in `pointers`.
- A prompt of a number alone gets no answer, and so does `resolve` of one, where a note or an item named by that number answered before.
- A `notNodes` entry written with a trailing slash now takes effect, so the notes under it drop out of `graph`, `lint`, `resolve` and the hooks, and `config --get notNodes` shows it without the slash.
- `note --new` under a folder named `node_modules` is refused where it wrote a file before, and `work new` with a link or a folder at the state file's place is refused where it died before.
- The host's own notifications get no pointers. Nothing else changes in what the hooks add, and no setting and no file layout changes.

## 0.11.0 - 2026-10-11

A session in a git work tree now works as one in the main checkout does: it reads and writes the map by itself through two new commands, with no file staged by hand and no question asked, and there is nothing to set up. Before this the skills left most of the map's writing to a session's editing tools, and Claude Code refuses those tools on the main checkout once it has put a session in a work tree, which is where a map kept out of git is. A session there staged its files and asked for a yes to copy them: five times in two sessions on one machine, with waits of up to 22 minutes. A session started with `claude --worktree` could not read the map either. The checks were run in the main checkout, a work tree outside the estate root had no map, and a copy of the map in a work tree was taken for the map and deleted with it.

- **Two commands stand between a session and the map's files.** `draft <path>...` prints the file to use for each file of the map named: the map's own in the main checkout, and in a work tree whose main checkout holds the map a draft at the same place under the work tree, copied from the map's file where there is one. `take` puts the drafts into the map and removes them from the work tree. Every skill has a file of the map read, written and handed to an agent at the path `draft` prints, in the same words wherever the session runs.
- **`take` does not undo another session's lines.** It keeps a draft whose file in the map changed after it was drafted, or that was not made from the map's file, with the reason and exit 1. Beside it `take` leaves a copy of the map's file as it now is, under `.in-the-map` in the drafts folder, and names it, so a session whose host keeps its tools to the work tree can compare the two, and `take --over <path>` takes the draft once they are compared. Drafted settings are read before they replace the map's. A draft that was only read is kept up to date by `draft` and dropped by `take` without a word.
- **`take` and `draft` leave the folder they were run from.** `take` removes the drafts folder with its last draft, but never a folder a shell is standing in, so the next command there still runs.
- **One estate has one map.** A file at the map's place in a work tree is a draft unless git tracks it there, whatever else the folder holds. So a copy of the map made there, by hand or by a list of ignored files to copy into new work trees, is no longer taken for the map: `take` drops what is the same and keeps what differs. Where git gives no answer, `draft` and `take` say so and do nothing.
- **The repo's folder is the work tree.** `standards` gives the work tree as the folder the repo's checks run from, and as `root` in its JSON, and a standards file inside the repo as the work tree's copy. Standards, design and implement take a repo's folder from there, for the reader, the checks and the reviewer, and a build in a work tree stays on the branch the work tree is on.
- **A work tree anywhere finds its map.** Under the checkout, beside it or elsewhere, a work tree with no map of its own finds its main checkout's, and coverage counts its folders as the checkout's, so a work tree of a registered repo is covered as that repo.
- **The index says so.** In a work tree the live index names the work tree and its checkout, says that a file of the map is read and written at the path `draft` prints, and counts the drafts that wait. `where` names the work tree and the drafts folder, and its JSON carries `workTree` and `drafts`.
- **The hooks start from the session's own folder in a work tree**, so a work tree with a map of its own, kept in git, is answered from that map under a host that keeps the project folder at the main checkout.
- **`doctor` names what waits.** A new check, `worktrees`, names each work tree of the map's checkout in which drafts wait, with how many, and says when the map itself sits in a work tree where git ignores it.
- **`work done` and `work reopen` refuse while an edited draft of the item's state file waits**, since they write the map's own file.
- **`detect` tells a work tree from a repo.** Onboard stops in a work tree, names the main checkout and says that a session started there sets the map up.
- **Each closing answer has a place for a draft that `take` kept**: under Needs a fix, with its reason.
- **The docs say how.** The map page has a part on work trees, the limits page says what is not built, and `CONTEXT.md` defines Work tree, Main checkout and Draft.

Not shown:

- A session on Windows. The tests of the commands run there in the checks. No session in a work tree was run there.
- A sandboxed shell. Whether the plugin's own writes into the main checkout pass one was not tried.
- Another model, a large estate, a long session, a session with a person in it, or two live sessions writing at once. What has been shown: 72 turns of 57 headless runs of the seven skills, on one model, on invented estates of one small repo whose map is kept out of git. Forty-six ran the text as it stood at each step, which three review rounds, three cold reads, the runs themselves and five fixes then changed. The last eleven ran the text as it ships: ten in a work tree the host made for the session, covering each of the seven skills, and one checkpoint in the main checkout.
- In those eleven: no edit of the map was refused and nothing was asked of a person. The work tree sessions wrote each file of the map as a draft, `take` took all 24 of them, and no draft was left in any work tree. The session in the main checkout wrote the map's own files and had nothing to take. A build stayed on the work tree's branch, ran its check there, and handed its reviewer the work tree and the spec's draft. Onboard stopped at its first step and wrote nothing, on the reply as well.
- A draft kept, beyond two stand-ins. In both, another writer changed the glossary once the session had edited its draft. `take` kept the draft and named a copy of the map's file, and the session read the copy, brought the other entry into its draft and took it with `--over`, so the map held both entries. One of the two sessions was refused every read outside its work tree. Before `take` left that copy, such a session could only leave its draft and name it under Needs a fix.
- A file read through `draft` at the first try, every time. In four of the last ten work tree runs the session reached for the map's own path at some point and was refused by the host: three then drafted the file, and one went on without it. Three batches earlier, three sessions read a file they had not drafted, beside the drafts they had: two said the map lacked it and one that it had looked in the wrong place. The words changed, and in the 33 runs since none did.
- A draft written from the shell at the first try, every time. `draft` makes no folder for a file the map does not hold yet, so a shell copy to the path it prints fails until the folder is there. Two of the last ten work tree sessions met that and wrote the file with their editing tool, which makes the folder.
- A shell left standing in the drafts folder, beyond the tests. In an earlier batch two sessions were left in a folder `take` had removed, and their next command died. `take` now leaves that folder, and in the 22 runs since no command met a folder that was gone.
- A map kept in git, a root layout, a work tree outside the checkout's folder, a work tree moved by hand and a map partly in git, in a live session. Each is held by tests of the commands alone.
- The desktop app, beyond the one session that built this release. That session wrote the work item's own spec, design and state file as drafts with its editing tools, and `take` put them into the map.

For a map that already exists:

- In the main checkout nothing moves: `draft` prints the map's own file and `take` has nothing to take, so the skills write the files where they did, after one more command.
- A copy of the map in a work tree, where git does not track it, stops being that work tree's map. The commands there read and write the main checkout's map, `doctor` counts the files of the copy that differ as drafts, and `take` there drops the files that are the same as the map's and keeps each that differs, with its reason. Where a list of ignored files copies the map into new work trees, take the map out of that list. A map that git tracks in the work tree stays the work tree's own.
- In a work tree, `standards` gives the work tree as the folder a repo's checks run from, where it gave the folder the settings name.
- `doctor` prints one more line, `worktrees`, and its JSON one more entry. `where --json` has two more keys, `workTree` and `drafts`. `detect --json` has one more key, `workTree`, and its text one more line.
- In a work tree the live index has up to three more lines, `detect` names the repo after its main checkout, and onboard stops.
- `work done` and `work reopen` refuse while an edited draft of the item's state file waits in the work tree they are run from.
- No setting and no file layout changes.

## 0.10.0 - 2026-10-10

Every skill ends on an answer of one shape: one line that gives the outcome, then four groups, then where the detail is. Before this a skill named what its last answer should mention and never its shape, and research asked for "a digest of at most ten lines". Of 22 research digests measured on one machine none was grouped: what worked sat beside what did not, sometimes in one point, and what waited for the person had no fixed place.

- **Every skill closes in four groups.** Needs a fix, Yours to decide, Fine as it is and Not known, in that order, each named for what its points ask of you. A group with nothing in it is left out, what matters most comes first, and a point is one thing in one sentence, with the parts of one thing under it. A group shows five points at most, each with all its parts. Where it holds more, one more line follows the five: it names the one file that holds all of the rest, or says in short what the rest is where no one file does. Nothing that asks something of you sits outside its group. Each skill says what its own groups hold, and onboard says it in one paragraph.
- **Research sorts its claims.** Each claim gets one of the four groups. One that needs a fix or is fine carries its mark, `verified` or `inferred`: in the answer with the one source that shows it best, in the research note with every source. The note holds the claims under the four groups, with `none` under an empty one.
- **A build gives one answer, after its checkpoint.** Under Fine as it is the slices, the review and the design's revisions are one point each, with every slice and its commit, every finding fixed or left as it is with the reason, and every revision under it, so a long build cuts none of them. Each finding still open is under Needs a fix. The first line says whether the build is done, is done but for the requirements and the recorded checks under Needs a fix, or stopped. The last line asks for your ruling where the build stopped at its last round, and otherwise names what is left for you, in order: those requirements and checks, a yes it waits for, then `/clear`. A recorded check that cannot run on the machine has not failed: the build goes on without it and lists it under Not known. A build that `implement.deferTo` hands to a skill of your own closes in the same shape. A checkpoint that a build runs gives no answer of its own.
- **Nothing is posted before you answer.** Where your write rules allow prep to post its brief and the connection has a way to post, the brief is shown under Yours to decide and the last line asks for your yes or no. A yes posts it, and any other reply posts nothing.
- **Design's last line names what holds the build back**: first a point where it could not follow the spec, then a question the spec does not answer. Otherwise it names the build, or `/clear` alone where every slice is built.
- **What only the answer holds is given in full.** The terms a glossary could not take, in prep and checkpoint, and the rules of a repo with no standards note, in checkpoint, are one point each with every term or rule under it, so none is cut at five. A checkpoint that wrote no state file ends on the log.
- **A fault of the map's checks is told by how its line begins.** A fault is a line that starts with a word in capitals: of `lint`, `graph` or `doctor` in standards, and of `lint` or `graph` in checkpoint. So an `ok` or a `note` line is not listed as one. A test holds the three commands to that.
- **What is asked part-way stays as it was.** The numbered questions of prep, standards and onboard are still a numbered list, and a stop part-way, such as an item that was not found, is not held to the shape.
- **The docs say once how every step ends**, in the step-by-step doc, and each step links it. The README says it in a line. Two pictures are redrawn: research sorts its claims and answers in four groups, and a build checkpoints before its one answer. `CONTEXT.md` defines Closing answer, Group, Point and Mark.

Not shown:

- Another model, a large estate, a long session, or a session with a person in it. What has been shown: 67 turns of 43 headless runs of the changed skills, on one model, on invented estates with one small repo. The first 27 ran the text as it stood at each step, which three rounds of review and an audit then changed. Two audits listed the places where a session that follows the words to the letter had to guess; the words were changed to settle them, and the last 16 runs followed that change. Eleven of those ran the text as it ships: ten of the six skills other than implement, and one build. Three more builds ran it but for one phrase of the first line, and two before the last line changed as well.
- In those 16: every answer came in the groups, in order. Of the nine groups that held more than five points, eight showed five and one more line, which named the one file that held the rest or said in short what the rest was. Prep showed its brief and posted nothing, posted nothing again on a reply that was not a yes, and on a yes posted the same three parts through the estate's own command. A checkpoint gave six rules and two terms in full, each set under one point, and one with no work item ended on the log. A design named the line of the spec it could not meet ahead of the build, and one whose slices were all built ended on `/clear` alone. Two builds of two slices gave the slices, the review and the revisions as one point each, with each finding fixed or left as it is under the review. One build said in its first line that it was done but for one recorded check, said in its last what is left for the person, in order, and listed the check that could not run under Not known. One stopped at its only round with the open findings under Needs a fix and the ruling it waits for as its last line. Standards listed a `WARN` line under Needs a fix and left a `note` line out.
- No group over five points, every time. One research answer of two showed six in one group: five claims and the adoption.
- A closing answer with nothing before its first line, every time. Onboard's came after the settings to place, in the same message, in both of its last runs, and one earlier checkpoint opened on a line of its own.
- A point held to one sentence, every time. The parts of a brief ran to two or three sentences, as did a point here and there.
- A research note that holds the question, the answer and the groups and nothing else. One of the last two carried a part more, as most of the earlier ones did.
- A rule with no standards note kept out of every file. One checkpoint gave the six rules and the two terms in its answer and also wrote them into the state file.
- A build handed to a skill of your own on the text as it ships. It ran once, on the text of an earlier step, and gave one answer in the same shape.
- The points no estate gave, among them a refusal to adopt, a design that departs from the standards, an evidence file, a run with nothing for any group, a requirement left not done at the end of a build, a build across two repos, a post that fails after the yes, a comment posted by a server's tool, and a group whose rest is partly in one file and partly in none.

For a map that already exists:

- Every skill's closing answer changes shape.
- A research note written from now on is laid out in the four groups. A note already in a map is left as it is, and nothing reads the headings.
- A build that `implement.deferTo` hands to a skill of your own now ends on the closing answer as well, after that skill has reported.
- Where your write rules allow prep to post its brief, it now shows the brief in its closing answer and posts only on your yes.
- No command, setting, hook or file layout changes.

## 0.9.1 - 2026-10-10

- **The README is the short version.** It keeps what the plugin does, how it helps, the core idea, how it works for you, the install and the five steps of a piece of work, and is about a fifth as long as it was.
- **The detail of each part has a file of its own under `docs/`.** There are nine, listed in the README under "Where the detail lives": install, update and turn off, with two accounts on one machine; a piece of work, step by step; the map; connections; standards and checks; what the hooks put in context; commands, skills and agents; working from a terminal; and what it does not do. The text of each is the README's own, moved as it was, and each diagram went with the part it shows.
- **The licence line links the licence.**
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.9.0 - 2026-10-09

The parts of the map reach a session where they did not. A research of 2026-10-09 read the code and ran the plugin against stand-in estates in both layouts, and found four places a pointer was missing and three things the text left unsaid.

- **A work item's pointers carry the standards of its repos.** Where an item links or names a repo, that repo's standards note follows the repo note at once, as it does in the repo route: listed once, and taking no place against the limit on linked notes.
- **A link into the repo is a pointer in both layouts.** In a map kept inside a repo, a link from a note to a file of that repo, such as an ADR or the repo's own instruction file, is listed as the root layout already listed it. A link that leaves the estate stays unlisted, and the graph checks these links as before.
- **A compaction forgets what the session was given.** The state file of the active item comes back as before, and a later prompt that names a repo, an item or a note gets its pointers again, which the summary may have lost. A resume and a clear are as they were.
- **The live index names the repo a session starts in.** One line after the hub names that repo's note and, where it has one, its standards note, in either layout, so a session started inside a repo is pointed at both without a prompt naming the repo. `index --json` carries it as `repo`.
- **Instruction files are listed, never copied.** The standards skill and the README say that a repo's own `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md` and rule files go under `standards` on its entry, first, and that the note holds what they do not say. The README defines instruction files and says that the host does not read a repo's `AGENTS.md` while the estate has a hub.
- **A standards note names its commit.** A new note carries a line naming the repo, the commit and the date, which the standards skill fills and sets again when it changes the note. Design and implement say when a file a rule cites has changed since.
- **The reviewer says what it does when the rules disagree.** Where a standards file and the instruction files disagree, it holds the diff to neither on that point and reports the disagreement as a finding on the rules.

Not shown:

- A live session after a compaction. The hook's record was cleared and the pointers given again in runs of the hook as a process, not in a Claude Code session.
- A session started inside a repo in the root layout loading the plugin at all. Project settings are read from the folder a session starts in, as 0.8.0's text says, so the new line reaches such a session only where the plugin is installed for the person or for that repo.

For a map that already exists:

- A prompt that names a work item may get one more pointer for each repo the item links or names: the repo's standards note.
- In a map kept inside a repo, a note that links a file of the repo now has that file among its pointers; a link that leaves the estate is still left out.
- The live index gains one line in a session started inside a registered repo that has a repo note, and `index --json` gains `repo`, null where there is no line.
- After a compaction, pointers given earlier in the session may be given again.
- A standards note made from now on carries the commit line. An older one does not, and nothing asks for it until the standards skill next changes the note.

## 0.8.2 - 2026-10-10

- **The opening image of the README is redrawn** as one diagram of the whole loop: the connections that bring tickets, pull requests and threads into the map, the three tiers of the map, what a session is given from each and when, the five skills that do the work, and every step writing its files back to the map. It names the seven skills, where the mind map before it named five.
- **Every image is drawn at the README's own width.** The opening image and the eight panels that 0.8.1 added were drawn twice as wide as the page shows them, so their text came out at about half the size of the text around it. They are redrawn 880 pixels wide, with text at about the size of the README's own.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.8.1 - 2026-10-09

- **The README shows each step as a diagram.** Eight panels under `docs/`: the five steps of a piece of work and what each writes, one for each of research, prep, design, the build and the checkpoint, one for standards and checks, and one for how a reference is read through a connection. Each sits beside the part of the README it shows.
- **The walk-through is shorter where a diagram carries it.** The parts of the spec and of the design are tables. The table of steps no longer lists what each step writes, and "How it builds" is three points. "Running it, in order" is gone: "How it works for you" and the table of steps give the order.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.8.0 - 2026-10-09

A second person put the plugin on an estate that already had its own notes, glossary, accounts and installs, and wrote down what went wrong. This release closes those gaps, in the order of the harm.

Safe on an estate that is not new:

- **An older work item is adopted, never rewritten.** `work adopt <item>` gives a work item kept as a single note, a start-here file or a README a state file beside that note, and `work adopt --all` does so for every one. It moves nothing and changes no file that is there. The state file links the older note and everything that note pointed to, and the resolver lists the older note after the state file and the spec, whatever the limit. Checkpoint, prep, design and research adopt the item they are working on before they write to it, and never write to the older note. Before this, a checkpoint could write a hand-kept note anew as a summary.
- **A stray file is not work.** A `README.md` or an `index.md` directly under the work folder is neither a work item nor a node, and neither is anything there that `notNodes` lists. `work new` refuses a name whose folder is listed there, and never writes over a state file. A README there used to be work in flight in every session, and answered any prompt that mentioned a readme.
- **`fetch` reads only as the pinned account.** Where a preset says how its tool hands out one account's token, `fetch` asks for the pinned account's and gives it to the tool it starts, in that tool's environment and nowhere else, whichever account is active. With no token, the read goes ahead only if the tool already runs as that account on the connection's own host. Otherwise nothing is read or saved. GitHub's preset hands out a token.
- **`doctor` gives a pinned account three answers.** `ok` where the tool runs as it. A `note` where another account is active and the tool holds the pinned one, saying how to run one command of your own as it. `FIX` where the tool cannot run as it here, saying how to sign it in and how to put the former account back. No advice tells you to switch the machine's active account, and `implement` starts its commands the way the note says.
- **A launcher starts the copy of the plugin that belongs to its map.** It takes the install record whose project folder is the nearest at or above its own file, then the copy installed for you, and never another project's. `wrapper --write` says when a saved launcher is not the one this release writes.

The map finds what is in it:

- **A node is found by an identifier.** That is the `id` in its frontmatter or one of its `aliases`, and for a numbered node its kind and number, so "decision 7" finds a decision.
- **A node is found by its name.** Its file name or its title answers when that is the whole of the question, so a name of one word now finds its note.
- **A term of the glossary is found**, with the line it is on.
- **The three come after every route there was.** No prompt that had an answer gets another. In the prompt hook they answer only a short prompt, and everywhere they leave out the work folder, the log and the deep tier.
- **The hub is not a linked pointer.** A link to the hub no longer takes one of the pointers given for a work item or a repo note.

Less friction when an estate is adopted:

- **The glossary can be a file the estate already keeps.** Name it with `glossary` in `estate.json`, counted from the estate root. `init` then lays out none and never changes that file, `where` says where the glossary is, and `lint` reports one that is named and not there. A glossary inside a registered repo is read and never written to: prep and checkpoint list the terms in their report instead.
- **A node can be made in a folder below its kind**, to any depth: `note --new docs/runbooks/month-end`. A decision and a standards note take no folder.
- **The install text says what decides whether the plugin loads.** The README and onboard say, for each way of having the plugin, when it loads, how a release reaches it and whether a launcher finds it. `init --print-settings` now prints auto-update for the marketplace, so a release reaches everyone who enabled the plugin from project settings.
- **Old session records are swept.** A record of what a session was given is removed once no session has used it for fourteen days.

Not shown:

- That the plugin loads from project settings once a person accepts the folder's trust prompt, and that auto-update moves a copy to a new release. Both are as Claude Code documents them, and no check of this repository can show either.
- A GitHub Enterprise host. The token call for a named host, and an account listing that covers two hosts, were run against a stand-in for the tool.
- On Windows, the cmd launcher's choice of an install by project folder. It has run there only against a record of a copy installed for the person.
- The skills' new steps, beyond one headless run: a checkpoint on a throwaway map that held one hand-kept note left the note's bytes as they were and laid a state file beside it.

For a map that already exists:

- A prompt that got no answer may get one: an identifier, a node's name, a glossary term. No prompt that had an answer gets another, with one exception: a work item that has a state file and links its own start-here file, single note or README has that file listed after the state file and the spec, for sure.
- A `README.md` or an `index.md` under the work folder stops being a work item and a node.
- A folder under the work folder that `notNodes` lists stops being a work item, and is no part of an item whose single note sits beside it. No command makes a work item there or saves anything for one there.
- `fetch` reads as the pinned account. Where that account is not signed in and another is active, a read that went ahead as the other now stops.
- `doctor`'s line for a pinned account that is not the active one turns from `FIX` to `note` where the tool holds that account.
- A launcher saved before this release keeps the old rule until you delete it and run `wrapper --write` again. A new one, with no install for its map or for you, says the plugin was not found where the old one started another project's copy.
- Nothing is adopted until a command or a skill meets an older item.
- `resolve --json` may name three more routes, `id`, `name` and `term`, and `where --json` has two more keys, `glossary` and `glossaryRepo`.

## 0.7.0 - 2026-10-08

- **The design has seven parts.** Two are new. **Checks beyond this machine** lists what the design assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared. **If time is short** gives the order in which the work is cut and what is never cut. Either may say `none`.
- **How an interface fails is written against the failing inputs.** The design step reads the source of the dependency an interface rests on, at the version the repo pins, or runs it, and writes how the interface fails on the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused. What neither the source nor a run shows goes under Checks beyond this machine. `CONTEXT.md` defines the term, and the reviewer follows each changed path with the same inputs.
- **A choice records the smaller option.** Each choice names the smaller option weighed, or `none`, and one turned down for now says, on one line, why not now and what reopens it. Checkpoint carries each open trigger into the state file's Standing traps, and each check beyond this machine not yet run into Next.
- **A slice says what it builds and covers.** Each slice names the Interfaces headings it builds and the test seams it covers. Every seam of the spec is started from by a slice, named under the one that covers it, or named as not covered with the reason, and a seam with no slice and no reason is a question for you.
- **The build proves the failing inputs and marks each slice built.** A slice's tests cover the failing inputs the design lists for the interfaces it builds. When the checks are green, the slice is committed and ends in the design with `Built at <short commit>.`, which is the line implement passes over on a second run.
- **A departure revises the design in place.** A slice or a review fix that departs from the design without showing it wrong revises the design where it stands, dated, with the reason, before the next slice or round. A slice or a fix that shows the spec or the design wrong still stops the build. The reviewer reads a dated revision as the design, and where the design lists failing inputs for an interface the diff builds, a listed input with no test is a finding.
- **Why.** One live build of a design was read for this release. The code never drifted from the design. The design drifted behind the code after review fixes, and every real defect was a failure mode the design and the code both missed.

Not shown:

- No real build has yet run with these rules. What has: a headless run of the unreleased skills on a throwaway estate with one small repo and a spec of two seams. The design skill wrote the seven parts, with every slice naming its seam and five choices carrying a `Smaller:` line; it named the three remote failing inputs by case and not the empty, the largest and the repeated. The implement skill built five slices, ended each in the design with its built line, and, meeting a helper committed after the design, imported it and revised the design where it stands, dated, with the reason. The pull request has the numbers.

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
