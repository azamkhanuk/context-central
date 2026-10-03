---
name: research
description: Answer a question from primary sources and save the findings as a note beside the work item.
argument-hint: <question> [item]
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The question, and the work item when one is named: $ARGUMENTS

## 1. Place the question

Run `context-central resolve <item or question> --absolute`. Read the first pointer, which for a work item is its state file, and only the other pointers the question needs. When no item is named and none resolves, the research has no item and its note goes in `concepts/`.

If the task arrived as work already in progress (a branch, an open PR, a half-finished ticket), read both the code diff against the repo's base branch and the ticket. The diff shows what was done and the ticket what was asked; either alone misleads. `context-central config --get repos` gives each repo's base branch.

## 2. Gather from primary sources

A primary source is the thing itself: the code at a named commit, the ticket, the PR, the vendor's own documentation, the meeting record. A summary, a recollection or an existing note in the map is a lead to check against its source.

Keep bulk out of this conversation by delegating:

- **Bulk reading** (many files, long files, anything in the deep tier) goes to the `context-central:reader` agent. Give it the exact absolute paths and the question. It starts without the instruction files, so the prompt carries everything it needs.
- **Tracker, PR, thread and meeting payloads** go to the `context-central:fetcher` agent. Give it the route from `context-central config --get tracker.route` (or `context-central config --get sources` for meetings and chat), what to fetch, and the absolute path to save the full text to: `work/<item>/sources/<NN>-<YYYY-MM-DD>-<what>-full-text.md`, where `NN` is one more than the highest number in that folder.
- **A GitHub PR or issue** needs no agent: `context-central fetch pr <ref> --item <item>` or `context-central fetch issue <ref> --item <item>` saves the full text and prints a digest.

A setting that is absent makes `config --get` exit 1; treat it as unset and ask the person for the route.

## 3. Mark every claim

- `verified`: you or an agent read it in a primary source. Cite it: `path:line` at a commit, a URL, or the saved source file.
- `inferred`: reasoned from something else. Say from what.

Done when every claim in the answer carries one mark and its source.

## 4. Write the note

- With an item: `work/<item>/notes/<YYYY-MM-DD>-research-<slug>.md`.
- Without: `context-central note --new concepts/<slug>`, then fill the file it prints.

The note holds the question, the answer in a few lines, the claims with their marks and sources, and what is still unknown.

With an item, add the note's path to "Where the detail lives" in the state file.

## 5. Answer

Reply with a digest of at most ten lines and the path of the note.
