# The map

A map is a folder of Markdown with one settings file, `estate.json`. An estate is the set of repositories you work across, with the folder that holds their checkouts. One estate has one map. [CONTEXT.md](../CONTEXT.md) defines the plugin's terms.

## How a map is laid out

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
- A file named `README.md` or `index.md` directly under `work/` is neither a work item nor a node, in any letter case. Neither is anything under `work/` that `notNodes` lists: no command makes a work item in a folder listed there, or saves anything for one there. A note that links to such a file still gives it as a pointer.

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

Two more budgets shape what [the hooks](hooks.md) do:

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
