# Glossary

**Estate**: The set of repositories one person or team works across, together with the folder that holds their checkouts. One estate has one map.
_Avoid_: workspace, client, monorepo, project

**Map**: The folder of Markdown notes and the `estate.json` settings file that describe an estate. It sits at the estate root, or inside one repository under `.context-central/`.
_Avoid_: knowledge base, wiki, vault, docs

**Hub**: The one instruction file Claude Code loads at launch for the estate, `CLAUDE.md` by default. It holds the routing table and standing rules, never status.
_Avoid_: root file, index, readme

**Glossary**: The estate's terms, one entry each, with the words that are not used for each. It is the map's own `glossary.md`, at the root of the map, unless the settings name a file the estate already keeps. The resolver lists it for a question that is exactly one of its terms. One inside a registered repo is read and never written to.
_Avoid_: dictionary, vocabulary, terminology

**Node**: One Markdown file in the map about one lasting subject: a repo, an area, a concept, an edge between repos, a decision, or a repo's standards.
_Avoid_: page, doc, article

**Design**: A work item's `DESIGN.md`: how its spec will be built in this repo, in seven parts: Shape, Interfaces, Choices, Slices, Checks beyond this machine, If time is short and Anchors. It names files and lines, so it carries the commit it was written at. The build marks each slice built with its commit, and a departure from the design that does not show it wrong revises it where it stands, dated. A small item has none.
_Avoid_: technical spec, plan, architecture document

**Failing inputs**: The inputs a design lists for how an interface fails and a slice's tests cover: the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused.
_Avoid_: edge cases, error paths, negative tests

**Review round**: One run of the reviewer for each repo a build touches. The estate sets how many a build may have, three unless it says otherwise, and a build whose last round still brings a finding that needs a fix stops and asks.
_Avoid_: iteration, loop, pass

**Lesson**: What a review finding teaches a repo's standards note: a rule the note lacks, or a correction of one it has, worded, placed under its part and given its source. A build offers its lessons when the review rounds end and checkpoint offers the late ones, and one is written only on the person's yes.
_Avoid_: learning, takeaway, insight

**Late finding**: A finding on a work item's pull request that no review round of the build raised. Checkpoint offers it as a lesson, marked late with the round that passed it.
_Avoid_: post-merge finding, missed finding

**Review note**: The note in a work item that holds its build's review: each round with its findings, what was done with each and the written rule it rested on, and each lesson offered with how it was ruled. A yes given later is written from it, and a late finding is told by it.
_Avoid_: ledger, review log, findings file

**Closing answer**: What a skill says to the person when its run ends: one line that gives the outcome, then the groups that have a point, then one line saying where the detail is and, where there is one, the next step. A run that stops before its closing step gives none, and a list of questions put to the person is not one.
_Avoid_:

**Map-only rule**: What research keeps to from its start until the person types another skill: it reads, runs only what reads the estate as it is, and writes nothing but files of the map and the folder a hand-over is asked to copy a research into. It makes no fix, test, probe, stand-in or throwaway estate, and starts no other skill but one the estate names for research; what only new code could show is left under Not known, naming the step that can show it.
_Avoid_: read-only mode, plan mode, no-code mode

**Ruling**: The person's answer to a recommended answer or a choice, such as a yes to every recommendation. It is written where the choice was written and is no longer listed as waiting. After research it settles the step research names, and is never leave to build.
_Avoid_: approval, go-ahead, sign-off

**Group**: One of the four parts of a closing answer, named for what its points ask of the person: Needs a fix, Yours to decide, Fine as it is, Not known. They come in that order, and one with no point is left out.
_Avoid_:

**Point**: One line of a group: one thing, in one sentence. Two things that could be acted on apart are two points, and the parts of one thing may sit under it as sub-points. Its recommendation, where it has one, is the first line under it.
_Avoid_:

**Recommendation**: The line under a point that says what the run recommends: `- **Recommended:** <the answer, and why>`, nested under the point and before its parts. A choice under Yours to decide has one; a point under Needs a fix has one where the run found what would fix it. A numbered question put to the person has one under it the same way.
_Avoid_:

**Fresh session**: A session that starts with nothing of the last one in its context: `/clear` in the terminal, **+ New session** in the desktop app. Each step from the spec onwards can start in one, and the state file carries the item across.
_Avoid_:

**Mark**: The word on a fact of a research that says how it is known: `verified`, read in the source itself in that run, or `inferred`, reasoned from something else.
_Avoid_:

**Research**: One question's findings, kept as a folder of its own in the map under a short name: the fact sheet, the research brief, the log, the set-aside list, the reading and the saved sources. It is added to by rounds and never rewritten, and nothing in it names a step.
_Avoid_: research note, report

**Fact sheet**: The first file of a research, `index.md`, which a planner that knows nothing of the plugin can read: how to read the folder, the questions, the day after which it should be checked again, what was not reached, the numbered facts that stand and the list of sources.
_Avoid_: summary, index

**Fact**: One thing a research found, in one sentence, with its number, its mark and every source that says it. Two sources that say one thing are one fact. Its words never change and its number is never used again.
_Avoid_: claim, finding

**Disputed**: The state of a fact whose sources disagree. Both are shown and neither is dropped.
_Avoid_:

**Superseded**: The state of a fact that no longer stands. A newer fact takes its place on the fact sheet and names its number, the day and the reason. The superseded fact leaves the sheet and is kept in the research's log, word for word under its number.
_Avoid_: outdated, replaced

**Research brief**: The file of a research that is written before any gathering and agreed once: the questions, as questions about what is, the sources to cover, the depth, what is out of scope and the start line. A later round adds its questions to it. The brief prep writes for a ticket is another thing.
_Avoid_: plan

**Start line**: What a research run says before it gathers, to the person and into the research brief: the connections it goes with and how each is reached and searched, the session's tools that the map does not record, and each kind the question needs that nothing reaches.
_Avoid_:

**Research round**: One pass of a research run. It gathers, then writes one entry into the research's log before the next starts: what was answered, what is open, the new leads, the leads set aside and why, the gaps met, and for a run's last round the test that stopped it. A check of a research ends in one too.
_Avoid_: iteration, pass

**Depth**: How far a research run goes: quick, standard or deep, each a cap on rounds and on agents at once, kept under `budgets`. Standard is the default with the person waiting and deep with nobody there, and what the person types wins. A run left alone stops at the round that adds nothing, and its cap is kept as a valve.
_Avoid_: effort, level

**Sweep**: A search of one connection for leads on the research brief's questions, through the search its entry names or its server offers. It returns leads and writes nothing.
_Avoid_:

**Lead**: Something a sweep or a source points at that may bear on a question: a title, an address, a date and why. It is fetched in full or set aside with its reason, and never dropped.
_Avoid_:

**Gap**: Something a research wanted and could not reach, written down when it is met: what was wanted, what pointed at it and how to connect it.
_Avoid_:

**Set-aside list**: The file of a research that holds what the researcher judged beside the point, each entry with its source and one line of reason. The person moves an entry in or out, and a later round keeps to those marks.
_Avoid_:

**Reading**: The file of a research written for the person: the four groups, pointing at fact numbers, with the recommendations and their rulings, and a dated part for each run. It is laid out by a template the estate can name.
_Avoid_:

**Hand-over**: A copy of one research in a folder outside the map that stands by itself. Each file of its item's saved sources that the research links is copied in, the kinds of source the person names are left out, and no link in it leads outside it but a full address.
_Avoid_: export, archive

**Taken alone**: Research installed and run as a skill by itself, with no plugin loaded: it names no step at the end, and hands each kind of reading to a subagent of the host with the agent's brief.
_Avoid_: standalone

**Standards note**: The node under `standards/` named after one repo: how its code is designed, written, tested and reviewed, in four parts. A repo whose name cannot name a node takes the first file it lists in that folder that is not named after another repo. Every rule names its source, the file that shows it, the person who said it or the review it was learned from, and the note names the commit its lines were read at. A repo's own instruction files are listed under `standards` on its entry and never copied into it. The plugin ships none and knows no language.
_Avoid_: style guide, coding guidelines, rulebook, skill

**Citation**: A `path:line` in a rule of a standards note: the rule's source or its pointer to real code. It has moved when that line no longer reads as it did at the commit the rule names, or at the note's where the rule names none, or when its file is gone.
_Avoid_: reference, link, anchor

**Refresh**: What the standards skill does to a standards note that exists: it reads each citation again, points one that moved at the line that shows its rule now, puts to the person each rule the code no longer shows, and sets the note's commit and date again.
_Avoid_: sync, regenerate, rebuild

**Instruction files**: The files the host loads as standing instructions: `CLAUDE.md` and `CLAUDE.local.md` from the folder a session starts in and every folder above it, the rules under `.claude/rules/`, and the same files in a folder below once a file there is read or edited. An `AGENTS.md` is read only where no `CLAUDE.md` sits in the start folder or above it. A repo's are listed under `standards` on its entry, never copied into its standards note.
_Avoid_: memory files, context files, agent instructions

**Recorded checks**: The commands on a repo's entry in the settings whose exit codes say whether its code passes. They run from the repo's folder, which in a work tree of the repo is the work tree, and work is verified only when every one exits 0 at the head of its branch, with nothing uncommitted. The session runs them and the plugin never does: it records what each exited with in the item's proof record.
_Avoid_: quality gate, pipeline, score

**Step skill**: A skill of the estate's own that a repo names on its entry for one of research, prep, design and implement, under `steps`. The step runs it for work touching that repo, on top of its own steps: research and prep before they write, design before it writes the design, and implement after verifying and before its review rounds. `standards` prints a repo's step skills after its checks. A repo that names none behaves as before, and under `implement.deferTo` the deferred skill is handed them with the rest.
_Avoid_: hook, kit, plug-in skill

**Work item**: One piece of work in flight or done, kept as a folder under `work/` and named by a ticket key or a plain name. A `README.md` or an `index.md` directly under `work/` is not one, and neither is anything there the settings list under `notNodes`.
_Avoid_: ticket, task, issue, story

**State file**: A work item's `STATE.md`: where it stands, what is done, what is next, what blocks it, its standing traps, and where the detail lives. It is the first pointer the resolver lists for the item, and it is kept under 10,000 characters.
_Avoid_: status file, handover, start-here note

**Entry file**: The file a work item is entered through: its state file, or for an older item its start-here file, its single note or its README.
_Avoid_: start file, landing file, index file

**Older item**: A work item whose entry file is not a state file: a start-here file, a single note or a README.
_Avoid_: legacy item, flat item, unmigrated item

**Adopt**: To give an older item a state file without moving or changing any file it has. The state file is laid out beside what is there and links the older entry file and what that file pointed to.
_Avoid_: migrate, convert, import, flatten, move

**Deep tier**: The full text saved behind the short files: everything under a `sources/` folder and any file named `*-full-text.md`. It is counted and pointed to as a whole, never listed one by one.
_Avoid_: archive, raw notes, attachments

**Evidence**: Any file under a work item's `evidence/` folder. The folder is for what was seen and is not text: a screenshot, a recording, an export. The commands count every file there, whatever its kind, and never open one. A note names each.
_Avoid_: attachments, assets, artefacts

**Live index**: The list of work items in flight, one line each, that the session-start hook puts in context, with one line for the repo the session starts in, where that repo has a note. It is built fresh each time, so it holds nothing that can go stale.
_Avoid_: status board, in-flight table, dashboard

**Resolver**: The part of the plugin that turns a prompt or query into pointers. It answers for a work item, a link that belongs to a connection, a repo name or free text, and says nothing when it is not confident. Beside its answer it says which ticket named has no work item. On the command line it has one more route, item words: when a query has two or more words of three letters or more that are not stop words, and all of them are in one work item's name and title and in no other's, the answer is that item. Only where none of these answers, it answers for a node's identifier, then a node's name, then a term of the glossary.
_Avoid_: router, search, retriever

**Pointer**: One line the resolver returns: a file's path, its size, and why it is listed. A pointer is a fact about where something is, never an instruction to read it.
_Avoid_: link, reference, result, hit

**Host text**: Text the host queues as a prompt that no person typed: a background task's notification or an agent's report, which in Claude Code begin `<task-notification>` and `<agent-message`. The prompt hook gives it no pointers and leaves the session record as it was.
_Avoid_: system message, injected prompt, notification prompt

**Plain map**: A map made by `init --plain` with no questions asked, which a step offers where it finds no map. Inside a repository it is the person's own: the map in `.context-central/`, its hub in `CLAUDE.local.md`, nothing that git tracks touched, and that repository registered. In a folder that holds checkouts it is the root layout with those checkouts registered. A shared map kept in git is onboard's to make.
_Avoid_: bare map, default map, quick map

**Map lock**: What a command holds while it reads and writes the map, so that two sessions writing at the same moment cannot lose each other's work. One lock serves the whole map, a command that cannot get it within five seconds stops and writes nothing, and a hook never takes it. It is an empty folder in the map's own folder.
_Avoid_: lock file, mutex, semaphore

**Unexpected fault**: A failure a command did not throw as an expected failure: the system refused something, or the code is wrong. It is one line and exit 1, with the trace only under `CONTEXT_CENTRAL_DEBUG`. In a hook it is one line to the person and exit 0.
_Avoid_: crash, exception, internal error

**Identifier**: What a node is known by besides its words: the `id` and each of the `aliases` in its frontmatter, and for a numbered node its kind and number.
_Avoid_: key, slug, reference

**Code name**: A word in a query that names something in the code: one with an underscore in it, a path, or a span in backticks with a mark of code, such as a dot between letters, a digit or a capital after a small letter. A slash between two plain words is prose, and a web address, with its scheme or without, is never one. The last route finds the notes that mention it, most often first.
_Avoid_: symbol, identifier

**Counted run**: A run of letters and digits in a query that is not a stop word and is not one or two letters alone; a run that holds a digit always counts. The routes for a node's name and a glossary term match on counted runs, and so does an identifier of one word once they have no answer; a query with none is answered by none of them, nor by the route for an identifier.
_Avoid_: token, keyword

**Coverage**: Whether the map answers for a given folder: the estate root, a registered repo, a node folder, or anywhere inside an inner-layout repository. A folder in a work tree counts as the same folder of its main checkout. Where there is no coverage the hooks stay silent.
_Avoid_: scope, reach, ownership

**Work tree**: A second checkout of a repository that git keeps beside the main one, on a branch of its own. A session in one works on the code there, and the estate's map stays the one map: a work tree holds a map only where git tracks the map and checks it out there.
_Avoid_:

**Main checkout**: The checkout a work tree was made from, whose folder holds the repository's own git folder. A map kept out of git lives there.
_Avoid_:

**Draft**: A file of the map as a session in a work tree reads and writes it: a file at the same place under the work tree, which starts as a copy of the map's file and which `take` puts into the map once it is edited. A file at the map's place in a work tree that git does not track there is a draft, never part of a second map. In the main checkout there is no draft, and the map's own file is used.
_Avoid_:

**Connection**: A named way the estate reaches one outside system for one kind of thing: tickets, pull requests, meetings, chat or any other. An estate may have any number, and none is required.
_Avoid_: route, tracker route

**Pinned account**: The account a connection names under `account`. Its tool must run as that account, whichever one is active on the machine.
_Avoid_: active account, default account

**Reference**: Text that names one thing in a connection: a key such as `PROJ-12`, `#41` or `AB#4312`, or a link.
_Avoid_:

**Ticket**: The thing in a tracker that a work item answers to. A work item is the map's folder for the work, never the ticket itself.
_Avoid_: work item

**Preset**: What the plugin knows about one vendor's system: how its references look and which commands read from it. It is optional knowledge, kept in one folder with a file for each vendor, and a connection needs none.
_Avoid_:

**Eval suite**: The cases kept in the plugin's own `evals/` folder for the host's `claude plugin eval`, which runs each with the plugin and without and reports the difference. It is a measure taken by hand: it is not one of the checks, and nothing waits on its score.
_Avoid_: benchmark, test suite, evals

**Case**: One folder of the eval suite: a prompt a person might type, the scaffold that makes the estate it starts from, and the graders that say whether the session did right.
_Avoid_: test, scenario, example

**Arm**: One side of a case's runs: with the plugin loaded, or without it. Both arms start from the same files, so the plugin is the one thing they differ in.
_Avoid_: variant, baseline, condition

**Grader**: One pass or fail on what a run produced. The eval suite uses only the host's free kinds: a pattern in the reply, in the session's trace or in a file, or a tool that was used or was not. None calls a judge model.
_Avoid_: assertion, judge, check

**Difference**: A case's score with the plugin minus its score without. A difference of none is a finding, and it is reported as found.
_Avoid_: uplift, gain, improvement

**Scaffold**: A case's shell script, which makes the case's estate in the run's empty workspace before the session starts. The host runs it only when a run is given `--scaffold`.
_Avoid_: setup script, fixture script, seed

**Case group**: Cases of the eval suite kept in one folder because they need the same grants, and run alone. The cases that only read are one, and cases that need other grants are a case group of their own.
_Avoid_: suite, tag, category

**Full run**: Every case of the eval suite, three runs each, in both arms. Its cost ceiling, like that of any run, is 10 USD unless another figure is given, and it is the run whose figures go on the docs page.
_Avoid_: complete run, real run

**Trial run**: A paid run of one case in one arm, once, made before a full run to show what only the host can.
_Avoid_: smoke run, dry run

**Proof record**: A work item's record of the recorded checks run for it, `proof.jsonl` in its folder: for each run the repo, the check as it is recorded, what it exited with, the commit and the branch, whether anything was uncommitted, the date and the system. One command, `context-central proof`, writes it, taking the exit code on the session's word and reading the rest itself, and `lint`, `doctor`, the live index and `work done` read it.
_Avoid_: test report, score, status badge

**Proof**: What an item's proof record shows of a commit. It is whole for a repo when every check that repo records exited 0, with nothing uncommitted, on the same code as the head of the branch it ran on; otherwise a check has no run, a run was made on uncommitted changes, a run is older than the head, or a check is red at the head. The readers say which and stop nothing.
_Avoid_: score, gate, verified status

**Try**: One run of a slice's checks, made once the slice's code is written, in which one comes back red. A slice has three, and after the third the build makes no further fix and stops as it does after the last review round. A run that only shows a new test failing is not one.
_Avoid_: attempt, retry, loop
