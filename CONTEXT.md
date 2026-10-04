# Glossary

**Estate**: The set of repositories one person or team works across, together with the folder that holds their checkouts. One estate has one map.
_Avoid_: workspace, client, monorepo, project

**Map**: The folder of Markdown notes and the `estate.json` settings file that describe an estate. It sits at the estate root, or inside one repository under `.context-central/`.
_Avoid_: knowledge base, wiki, vault, docs

**Hub**: The one instruction file Claude Code loads at launch for the estate, `CLAUDE.md` by default. It holds the routing table and standing rules, never status.
_Avoid_: root file, index, readme

**Node**: One Markdown file in the map about one lasting subject: a repo, an area, a concept, an edge between repos, or a decision.
_Avoid_: page, doc, article

**Work item**: One piece of work in flight or done, kept as a folder under `work/` and named by a ticket key or a plain name.
_Avoid_: ticket, task, issue, story

**State file**: A work item's `STATE.md`: where it stands, what is done, what is next, what blocks it, its standing traps, and where the detail lives. It is the first pointer the resolver lists for the item, and it is kept under 10,000 characters.
_Avoid_: status file, handover, start-here note

**Entry file**: The file a work item is entered through: its state file, or for an older item its start-here file, its single note or its README.
_Avoid_: start file, landing file, index file

**Deep tier**: The full text saved behind the short files: everything under a `sources/` folder and any file named `*-full-text.md`. It is counted and pointed to as a whole, never listed one by one.
_Avoid_: archive, raw notes, attachments

**Live index**: The list of work items in flight, one line each, that the session-start hook puts in context. It is built fresh each time, so it holds nothing that can go stale.
_Avoid_: status board, in-flight table, dashboard

**Resolver**: The part of the plugin that turns a prompt or query into pointers. It answers for a work item, a pull request link, a repo name or free text, and says nothing when it is not confident. On the command line it has a last route, item words: when every counted word of a query is in one work item's name and title and in no other's, the answer is that item.
_Avoid_: router, search, retriever

**Pointer**: One line the resolver returns: a file's path, its size, and why it is listed. A pointer is a fact about where something is, never an instruction to read it.
_Avoid_: link, reference, result, hit

**Coverage**: Whether the map answers for a given folder: the estate root, a registered repo, a node folder, or anywhere inside an inner-layout repository. Where there is no coverage the hooks stay silent.
_Avoid_: scope, reach, ownership
