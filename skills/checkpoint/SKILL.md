---
name: checkpoint
description: Write the session back into the context map so a fresh session can carry on. Use when the person says checkpoint, log this or hand over, when a piece of work ends, or before /clear.
allowed-tools: Bash(context-central *)
---

Write this session back into the map. The state file is a snapshot a cold session starts from, so it is rewritten, never appended to; history goes in the log.

## 1. Find the item

Run `context-central work list`. If it answers `no context map found`, tell the person there is no map here to write to and stop. Otherwise pick the item this session worked on. If the work has no item and is worth carrying on, create one with `context-central work new <item> --title "<title>"`. If it is not, skip to step 5.

Run `context-central work adopt <item>` before anything is written to the item. It gives an item kept as a note of its own a state file beside that note and leaves the note as it is; for an item that has a state file it changes nothing and says so. Never pass `--all`, and never write to the older note. If the command refuses, write nothing to the item, skip to step 5 and say in the closing report what it said. Then `context-central resolve <item> --absolute` gives the state file.

## 2. Establish the facts

Take them from git and files: `git status`, `git log <base branch>..HEAD --oneline`, `git diff --stat`, the PR's state, the last test run. `context-central config --get repos` gives each repo's base branch. The PR's state is read through the connection that holds that repo's pull requests, and `context-central connections` says how this machine reaches it. With no such connection, ask the person or leave the state out. Recollection of a long session drifts, so a claim with nothing on disk behind it is written as unverified or left out.

## 3. Save long text first

Any ticket, PR thread, meeting record or long output that this session holds and the map does not is saved in full to `work/<item>/sources/<NN>-<YYYY-MM-DD>-<what>-full-text.md` before any brief of it is written, where `NN` is one more than the highest number in that folder. The brief then names the file.

A file that is not text and shows what this session saw (a screenshot, a recording, an export) is saved with `context-central evidence add <file> --item <item>`, which copies it to `work/<item>/evidence/<YYYY-MM-DD>-<what>.<ext>`; a copy anywhere else is only a copy. `notes/<YYYY-MM-DD>-evidence.md` lists each by file name, with what it shows and the commit it was taken at.

## 4. Rewrite the state file

Its six parts, each replaced with what is true now:

- **Where it stands**: the present position in a few lines.
- **Done**: what is finished, with the commit or PR that shows it. A PR is written as its link, so that the link finds the item later.
- **Next**: the next action, concrete enough to start cold, and each check beyond this machine the design lists that has not been run.
- **Blocked**: what is waiting, and on whom or what.
- **Standing traps**: what would catch out someone new to this item, and each open trigger from the design's Choices.
- **Where the detail lives**: paths to the spec, the design when there is one, the notes, the saved sources and the evidence note.

Keep it within `context-central config --get budgets.stateChars` characters by moving detail into `notes/` and pointing at it.

When the item is finished, run `context-central work done <item>`.

## 5. Lessons that outlive the item

A trap or fact that the next item will also meet goes in the repo's note (`repos/<name>.md`) or a concept note (`context-central note --new concepts/<name>`), linked from the state file.

A term the estate uses with a meaning of its own (a word, an abbreviation, the name of a system) goes in the estate's glossary, the file `context-central where` names, in that file's entry format. Read the file first. Write a term only when its meaning was stated: by the person in this session, or in text on disk that you can name. A meaning you worked out yourself is not stated, even where this session wrote it down. When the person corrected a term, rewrite its entry where it stands and add the word they ruled out to its `_Avoid_` line; never add a second entry for one term. A new entry is written as the entries there are. Where they carry an `_Avoid_` line it has one too: it holds the words that were ruled out for the term, never synonyms of your own, and is left empty when none were. Where they carry none, add none. A term that was used and never defined is not written, and an entry that a source disagrees with is left as it is unless the person ruled on it. If the glossary is not there, or `where` says it is inside a repo, write nothing to it: the closing report says which and carries the terms and their stated meanings. A session that met no term leaves the glossary alone and says nothing about it.

A rule for how a repo's code is designed, written, tested or reviewed goes in that repo's standards note, the file `context-central standards <repo>` marks `(the standards note)`. Write a rule only when it was stated: by the person in this session, or as a reviewer's finding the person accepted. A rule you worked out yourself is not stated, even where the code follows it. Put it under the part it belongs to (Design, Code, Tests or Review) and end it with its source: who said it and the date, or the finding's `file:line`. When the person corrected a rule, rewrite it where it stands; never add a second rule for one matter. If no file is marked, the repo has no standards note and none is written, in any other file either: the closing report carries the rules and says that `/context-central:standards <repo>` makes the note. A session that met no such rule leaves the note alone and says nothing about it.

## 6. Log

Run `context-central note "<item>: <what changed, in one line>"`.

## 7. Check

Run `context-central lint` and `context-central graph`. Fix every `ERROR` and `BROKEN` line, and every `UNREFERENCED` file this session saved. Report the rest.

## 8. Say what was not recorded

End with the paths written, and anything from the session that was left out and why. Say when this session adopted the item. Name each glossary entry added or changed and where its meaning came from, each term left for the person to define, and each entry a source disagrees with. Name each standards rule added or changed and who stated it.
