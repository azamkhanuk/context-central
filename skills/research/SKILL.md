---
name: research
description: Answer a question from primary sources and save the findings as a note beside the work item.
argument-hint: <question> [item]
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The question, and the work item when one is named: $ARGUMENTS

## 1. Place the question

Run `context-central resolve <item or question> --absolute`. Read the first pointer, which for a work item is its state file, and only the other pointers the question needs.

When the answer says a reference reads as a ticket and no work item answers to it, the ticket is new to the map. Create its item before reading it: `context-central work new <item> --ticket "<reference>"`, where the item's name is the reference when that could be a folder's name, and a short plain name otherwise. Give it its title once the ticket has been read. In every command a reference goes in quotes, since a reference may start with `#`, which a shell reads as the start of a comment.

When no item is named and none resolves, the research has no item and its note goes in `concepts/`.

If the task arrived as work already in progress (a branch, an open PR, a half-finished ticket), read both the code diff against the repo's base branch and the ticket. The diff shows what was done and the ticket what was asked; either alone misleads. `context-central config --get repos` gives each repo's base branch.

## 2. Gather from primary sources

A primary source is the thing itself: the code at a named commit, the ticket, the PR, the vendor's own documentation, the meeting record. A summary, a recollection or an existing note in the map is a lead to check against its source.

Run `context-central connections` to see what the estate reaches and how this machine reaches each. Keep bulk out of this conversation by delegating:

- **Bulk reading** (many files, long files, anything in the deep tier) goes to the `context-central:reader` agent. Give it the exact absolute paths and the question. It starts without the instruction files, so the prompt carries everything it needs.
- **A ticket or a pull request** starts with fetch, which needs no agent: `context-central fetch ticket "<reference>" --item <item>` or `context-central fetch pr "<reference>" --item <item>` finds the connection the reference belongs to, saves the full text and prints a digest. With no reference, `fetch ticket` reads the item's own ticket. Never pick the connection yourself: an estate may hold tickets in more than one, and a guess reads the wrong system. When its answer says a session reads the connection, the reading goes to the fetcher. When it answers that more than one connection holds the kind, ask the person which one, and name it with `--connection`.
- **Anything else in a connection** (what fetch says a session reads, a thread, a meeting, a document) goes to the `context-central:fetcher` agent. Give it the connection's entry from `context-central config --get connections`, what to fetch, and the absolute path to save the full text to: `work/<item>/sources/<NN>-<YYYY-MM-DD>-<what>-full-text.md`, where `NN` is one more than the highest number in that folder.
- **What no connection reaches**, or a way that fails: ask the person to paste the text, and save it in full at such a path before anything else.

A setting that is absent makes `config --get` exit 1; treat it as unset. With no connection recorded, ask the person where the thing is and how to read it. With no item there is no `sources/` folder: save nothing and cite the address in the note.

## 3. Mark every claim

How it is known:

- `verified`: you or an agent read it in a primary source. Cite it: `path:line` at a commit, a URL, or the saved source file.
- `inferred`: reasoned from something else. Say from what.

What it asks of the person, as one of four groups:

- **Needs a fix**: something is wrong or missing.
- **Yours to decide**: a choice only the person can make. Give the answer you recommend and why.
- **Fine as it is**: it was checked and it holds.
- **Not known**: it could not be checked. Say what stood in the way.

A claim that would sit in two groups is two claims. Done when every claim carries its mark, its source and its group.

## 4. Write the note

With an item, run `context-central work adopt <item>` before anything is written to it. It gives an item kept as a note of its own a state file beside that note and leaves the note as it is; for an item that has a state file it changes nothing and says so. Never pass `--all`, and never write to the older note. If the command refuses, write nothing to the item: the note goes in `concepts/` as it does with no item, and the closing answer says what the command said, under Needs a fix. When it adopted the item, the closing answer says so, under Fine as it is.

- With an item: `work/<item>/notes/<YYYY-MM-DD>-research-<slug>.md`.
- Without: `context-central note --new concepts/<slug>`, then fill the file it prints.

The note holds the question, the answer in a few lines, then the claims under the four groups of step 3 in that order, each with its mark and its sources. A group with no claim says `none`. Name each file saved under `sources/` once by its file name: `context-central graph` reports a saved source that no note names.

With an item, add the note's path to "Where the detail lives" in the state file.

## 5. Answer

Reply in this shape, where a line in angle brackets is a kind of point, given once for each there is and left out where there is none:

```
<one line that answers the question>

**Needs a fix**
- <a claim that something is wrong or missing, and where> (<its mark>, <the one source that shows it best>)
  - <a part of it, where it has parts>
- <what the adopt command said, where it refused>

**Yours to decide**
- <a choice only the person can make>. Recommended: <the answer, and why>.

**Fine as it is**
- <a claim that was checked and holds> (<its mark>, <the one source that shows it best>)
- <the adoption, where there was one>

**Not known**
- <what could not be checked, and what stood in the way>

Note: <the path of the note>
```

The groups come in that order, the worst first inside each, and a group with no point is left out. A point is one thing in one sentence: two things that could be acted on apart are two points, and the parts of one thing go under it. A group shows five points at most, and where it holds more its last line is `and <N> more in the note`. A point the note does not hold is never left out, even past five. Nothing that asks something of the person goes outside its group, and nothing is said before the first line or after the last.
