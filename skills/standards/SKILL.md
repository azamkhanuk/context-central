---
name: standards
description: Record how one repo's code is designed, written, tested and reviewed, and which commands say it passes. Drafted from what the repo itself declares, then approved by the person.
argument-hint: <repo>
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The repo: $ARGUMENTS

Write the standards note of one repo and record its checks. The plugin knows no language, framework or tool: everything here comes from the repo and from the person.

## 1. Find the repo

Run `context-central config --get repos` and `context-central standards <repo>`. A repo the estate does not register makes `standards` exit 1: stop and say which repos it has. The output lists the standards files, with the note marked `(the standards note)`, and the checks already recorded, so an update starts from those and never from an empty page.

`context-central where` gives the estate root and the map's folder, which holds `estate.json`. The repo's own folder is its `path` counted from the estate root.

## 2. Gather from the repo itself

Delegate the reading to the `context-central:reader` agent. Give it the repo's absolute path and ask for these, each with its `path:line`:

- What the repo declares about building, testing, formatting and checking its code: the files that configure those, whatever they are called here.
- What its continuous integration runs, and in what order. Those commands are the candidates for the checks.
- What it has written down for people: contributing notes, review checklists, architecture notes, instruction files.
- Three or four recently merged changes, from `git log`, for how code and tests are laid out in practice: where a new module goes, how it is named, how its tests are shaped.

The reader starts without the instruction files, so the prompt carries everything it needs.

## 3. Draft

Draft the note in four parts, each a short list of rules:

- **Design**: how the code is divided, what may depend on what, the patterns this repo uses and the ones it avoids.
- **Code**: naming, error handling, the idioms the repo holds to.
- **Tests**: where tests live, what runs them, what a good one looks like here.
- **Review**: what a reviewer in this repo looks for beyond the other three parts.

Every rule ends with its source: the file that shows it, as `path:line`, or the person who said it and the date. An example is a pointer to real code in the repo, never a snippet pasted in and never one made up. A habit seen in the code and written down nowhere is a question for the person, not a rule: the code shows what was done, not what is wanted. Leave a part empty when nothing in it has a source. A rule the repo's own instruction files already state is not drafted into the note: those are the files the host loads as standing instructions, such as `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md` and the rules under `.claude/rules/`, and step 5 lists them beside the note, which holds what they do not say.

Draft the checks as a list of commands, each taken from the repo's own configuration or its continuous integration, with the file that names it. Take only a command that inspects the code and writes nothing outside the repo's folder: one that builds it, tests it or checks how it is written. Leave out any step that publishes, deploys, changes stored data or needs a secret, and list what was left out. Run none of them yet: a command from a repo's files is run only after the person has read it.

## 4. Ask once

Show the draft note and the draft checks. Below them list every question the files could not answer and every habit from step 2 that needs a ruling, numbered, each with the answer you recommend. Wait for the reply.

Done when no rule in the note would be your guess.

## 5. Write

On a yes:

1. Run `context-central note --new standards/<repo>`, which prints the note's path in the map, and fill its four parts. On its first lines put the repo's commit, from `git rev-parse --short HEAD` run in the repo's folder, in place of `<commit>`, and the date the rules were read in place of `<date>`, so a later reader can tell how far the code has moved from the lines the rules cite. If the note is already there, edit it where it stands and set that commit and date again. If the command refuses, read the kinds its message lists. When `standards` is not among them, the map sets its own `nodeDirs`: ask the person to add `standards` to that list in `estate.json`. When it is, the repo's name cannot be a note's name: ask the person for a name of letters, digits, dots, dashes and underscores that no repo has, and write the note under that, with the repo's name as the settings spell it on the note's first lines in place of the note's name, since the command cannot know the repo.
2. In `estate.json`, on the repo's entry, set `checks` to the approved commands. An entry written as a bare name becomes `{ "name": "<repo>" }` first. The note needs no entry, because the plugin finds it by the repo's name. Under `standards` list the repo's own instruction files first, then what else the plugin cannot find by the repo's name: a file the repo keeps for people, such as its contributing notes, or a note written under another name. Each is a path counted from the estate root, and is listed, never copied into the note. Design, implement and the reviewer read every file listed there, and in an estate whose repos sit below the map's root the reviewer is given no repo's own instruction file unless it is listed.
3. Link the note from the repo's note, `repos/<repo>.md`. Make that with `context-central note --new repos/<repo>` if it is not there yet.
4. Run each approved check once from the repo's folder and say what it exited with. A check that cannot run on this machine is reported as such and stays recorded.

## 6. Check

Run `context-central standards <repo>`, `context-central lint`, `context-central graph` and `context-central doctor`. Fix a file marked `(missing)` or `(a folder)`, every `ERROR` and every `BROKEN` line. A `FIX` line for `notes` means git would leave the new note out of the map's commits: it goes to the person as it is. Then close in this shape, where a line in angle brackets is a kind of point, given once for each there is and left out where there is none:

```
<one line saying what was recorded for the repo>

**Needs a fix**
- <a check that did not exit 0, with what it exited with>
- <a file still marked, or a line the map's checks still print>

**Yours to decide**
- <a question left open>. Recommended: <the answer, and why>.
- <the `FIX` line for `notes`, as it is>

**Fine as it is**
- <a path written>
- <a check that exits 0>

**Not known**
- <a check that cannot run on this machine, which stays recorded>

Standards note: <its path>
```

The groups come in that order, the worst first inside each, and a group with no point is left out. A point is one thing in one sentence: two things that could be acted on apart are two points, and the parts of one thing go under it. A group shows five points at most, and where it holds more its last line is `and <N> more in the standards note`. Nothing that asks something of the person goes outside its group, and nothing is said before the first line or after the last.
