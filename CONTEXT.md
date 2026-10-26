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

**Closing answer**: What a skill says to the person when its run ends: one line that gives the outcome, then the groups that have a point, then one line saying where the detail is and, where there is one, the next step. A run that stops before its closing step gives none, and a list of questions put to the person is not one.
_Avoid_:

**Map-only rule**: What research keeps to from its start until the person types another skill: it reads, runs only what reads the estate as it is, and writes nothing but files of the map. It makes no fix, test, probe, stand-in or throwaway estate, and starts no other skill; what only new code could show is left under Not known, naming the step that can show it.
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

**Mark**: The word on a research claim that says how it is known: `verified`, read in a primary source, or `inferred`, reasoned from something else.
_Avoid_:

**Standards note**: The node under `standards/` named after one repo: how its code is designed, written, tested and reviewed, in four parts. A repo whose name cannot name a node takes the first file it lists in that folder that is not named after another repo. Every rule names its source, the file that shows it or the person who said it, and the note names the commit its lines were read at. A repo's own instruction files are listed under `standards` on its entry and never copied into it. The plugin ships none and knows no language.
_Avoid_: style guide, coding guidelines, rulebook, skill

**Instruction files**: The files the host loads as standing instructions: `CLAUDE.md` and `CLAUDE.local.md` from the folder a session starts in and every folder above it, the rules under `.claude/rules/`, and the same files in a folder below once a file there is read or edited. An `AGENTS.md` is read only where no `CLAUDE.md` sits in the start folder or above it. A repo's are listed under `standards` on its entry, never copied into its standards note.
_Avoid_: memory files, context files, agent instructions

**Recorded checks**: The commands on a repo's entry in the settings whose exit codes say whether its code passes. They run from the repo's folder, which in a work tree of the repo is the work tree, and work is verified only when every one exits 0.
_Avoid_: quality gate, pipeline, score

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
