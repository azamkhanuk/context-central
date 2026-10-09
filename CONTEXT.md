# Glossary

**Estate**: The set of repositories one person or team works across, together with the folder that holds their checkouts. One estate has one map.
_Avoid_: workspace, client, monorepo, project

**Map**: The folder of Markdown notes and the `estate.json` settings file that describe an estate. It sits at the estate root, or inside one repository under `.context-central/`.
_Avoid_: knowledge base, wiki, vault, docs

**Hub**: The one instruction file Claude Code loads at launch for the estate, `CLAUDE.md` by default. It holds the routing table and standing rules, never status.
_Avoid_: root file, index, readme

**Glossary**: The map's `glossary.md`: the estate's terms, one entry each, with the words that are not used for each. It sits at the root of the map and is not a node, so the resolver never lists it.
_Avoid_: dictionary, vocabulary, terminology

**Node**: One Markdown file in the map about one lasting subject: a repo, an area, a concept, an edge between repos, a decision, or a repo's standards.
_Avoid_: page, doc, article

**Design**: A work item's `DESIGN.md`: how its spec will be built in this repo, in seven parts: Shape, Interfaces, Choices, Slices, Checks beyond this machine, If time is short and Anchors. It names files and lines, so it carries the commit it was written at. The build marks each slice built with its commit, and a departure from the design that does not show it wrong revises it where it stands, dated. A small item has none.
_Avoid_: technical spec, plan, architecture document

**Failing inputs**: The inputs a design lists for how an interface fails and a slice's tests cover: the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused.
_Avoid_: edge cases, error paths, negative tests

**Review round**: One run of the reviewer for each repo a build touches. The estate sets how many a build may have, three unless it says otherwise, and a build whose last round still brings a finding that needs a fix stops and asks.
_Avoid_: iteration, loop, pass

**Standards note**: The node under `standards/` named after one repo: how its code is designed, written, tested and reviewed, in four parts. A repo whose name cannot name a node takes the first file it lists in that folder that is not named after another repo. Every rule names its source, the file that shows it or the person who said it. The plugin ships none and knows no language.
_Avoid_: style guide, coding guidelines, rulebook, skill

**Recorded checks**: The commands on a repo's entry in the settings whose exit codes say whether its code passes. They run from the repo's folder, and work is verified only when every one exits 0.
_Avoid_: quality gate, pipeline, score

**Work item**: One piece of work in flight or done, kept as a folder under `work/` and named by a ticket key or a plain name.
_Avoid_: ticket, task, issue, story

**State file**: A work item's `STATE.md`: where it stands, what is done, what is next, what blocks it, its standing traps, and where the detail lives. It is the first pointer the resolver lists for the item, and it is kept under 10,000 characters.
_Avoid_: status file, handover, start-here note

**Entry file**: The file a work item is entered through: its state file, or for an older item its start-here file, its single note or its README.
_Avoid_: start file, landing file, index file

**Deep tier**: The full text saved behind the short files: everything under a `sources/` folder and any file named `*-full-text.md`. It is counted and pointed to as a whole, never listed one by one.
_Avoid_: archive, raw notes, attachments

**Evidence**: Any file under a work item's `evidence/` folder. The folder is for what was seen and is not text: a screenshot, a recording, an export. The commands count every file there, whatever its kind, and never open one. A note names each.
_Avoid_: attachments, assets, artefacts

**Live index**: The list of work items in flight, one line each, that the session-start hook puts in context. It is built fresh each time, so it holds nothing that can go stale.
_Avoid_: status board, in-flight table, dashboard

**Resolver**: The part of the plugin that turns a prompt or query into pointers. It answers for a work item, a link that belongs to a connection, a repo name or free text, and says nothing when it is not confident. Beside its answer it says which ticket named has no work item. On the command line it has a last route, item words: when a query has two or more words of three letters or more that are not stop words, and all of them are in one work item's name and title and in no other's, the answer is that item.
_Avoid_: router, search, retriever

**Pointer**: One line the resolver returns: a file's path, its size, and why it is listed. A pointer is a fact about where something is, never an instruction to read it.
_Avoid_: link, reference, result, hit

**Coverage**: Whether the map answers for a given folder: the estate root, a registered repo, a node folder, or anywhere inside an inner-layout repository. Where there is no coverage the hooks stay silent.
_Avoid_: scope, reach, ownership

**Connection**: A named way the estate reaches one outside system for one kind of thing: tickets, pull requests, meetings, chat or any other. An estate may have any number, and none is required.
_Avoid_: route, tracker route

**Reference**: Text that names one thing in a connection: a key such as `PROJ-12`, `#41` or `AB#4312`, or a link.
_Avoid_:

**Ticket**: The thing in a tracker that a work item answers to. A work item is the map's folder for the work, never the ticket itself.
_Avoid_: work item

**Preset**: What the plugin knows about one vendor's system: how its references look and which commands read from it. It is optional knowledge, kept in one folder with a file for each vendor, and a connection needs none.
_Avoid_:
