---
name: checkpoint
description: Write the session back into the context map so a fresh session can carry on. Use when the person says checkpoint, log this or hand over, when a piece of work ends, or before /clear.
allowed-tools: Bash(context-central *)
---

Write this session back into the map. The state file is a snapshot a cold session starts from, so it is rewritten, never appended to; history goes in the log.

## 1. Find the item

Run `context-central work list`. If it answers `no context map found`, tell the person there is no map here to write to and stop. Otherwise pick the item this session worked on, then `context-central resolve <item> --absolute` for its state file. If the work has no item and is worth carrying on, create one with `context-central work new <item> --title "<title>"`. If it is not, skip to step 5.

## 2. Establish the facts

Take them from git and files: `git status`, `git log <base branch>..HEAD --oneline`, `git diff --stat`, the PR's state, the last test run. `context-central config --get repos` gives each repo's base branch. Recollection of a long session drifts, so a claim with nothing on disk behind it is written as unverified or left out.

## 3. Save long text first

Any ticket, PR thread, meeting record or long output that this session holds and the map does not is saved in full to `work/<item>/sources/<NN>-<YYYY-MM-DD>-<what>-full-text.md` before any brief of it is written, where `NN` is one more than the highest number in that folder. The brief then names the file.

A file that is not text and shows what this session saw (a screenshot, a recording, an export) goes to `work/<item>/evidence/<YYYY-MM-DD>-<what>.<ext>`, lower case with dashes for spaces; a copy anywhere else is only a copy. `notes/<YYYY-MM-DD>-evidence.md` lists each by file name, with what it shows and the commit it was taken at.

## 4. Rewrite the state file

Its six parts, each replaced with what is true now:

- **Where it stands**: the present position in a few lines.
- **Done**: what is finished, with the commit or PR that shows it.
- **Next**: the next action, concrete enough to start cold.
- **Blocked**: what is waiting, and on whom or what.
- **Standing traps**: what would catch out someone new to this item.
- **Where the detail lives**: paths to the spec, the notes, the saved sources and the evidence note.

Keep it within `context-central config --get budgets.stateChars` characters by moving detail into `notes/` and pointing at it.

When the item is finished, run `context-central work done <item>`.

## 5. Lessons that outlive the item

A trap or fact that the next item will also meet goes in the repo's note (`repos/<name>.md`) or a concept note (`context-central note --new concepts/<name>`), linked from the state file.

## 6. Log

Run `context-central note "<item>: <what changed, in one line>"`.

## 7. Check

Run `context-central lint` and `context-central graph`. Fix every `ERROR` and `BROKEN` line, and every `UNREFERENCED` file this session saved. Report the rest.

## 8. Say what was not recorded

End with the paths written, and anything from the session that was left out and why.
