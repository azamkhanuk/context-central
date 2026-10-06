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

Every rule ends with its source: the file that shows it, as `path:line`, or the person who said it and the date. An example is a pointer to real code in the repo, never a snippet pasted in and never one made up. A habit seen in the code and written down nowhere is a question for the person, not a rule: the code shows what was done, not what is wanted. Leave a part empty when nothing in it has a source.

Draft the checks as a list of commands, each taken from the repo's own configuration or its continuous integration, with the file that names it. Take only a command that inspects the code and writes nothing outside the repo's folder: one that builds it, tests it or checks how it is written. Leave out any step that publishes, deploys, changes stored data or needs a secret, and list what was left out. Run none of them yet: a command from a repo's files is run only after the person has read it.

## 4. Ask once

Show the draft note and the draft checks. Below them list every question the files could not answer and every habit from step 2 that needs a ruling, numbered, each with the answer you recommend. Wait for the reply.

Done when no rule in the note would be your guess.

## 5. Write

On a yes:

1. Run `context-central note --new standards/<repo>`, which prints the note's path in the map, and fill its four parts. If the note is already there, edit it where it stands. If the command refuses, read the kinds its message lists. When `standards` is not among them, the map sets its own `nodeDirs`: ask the person to add `standards` to that list in `estate.json`. When it is, the repo's name cannot be a note's name: ask the person for a name of letters, digits, dots, dashes and underscores that no repo has, and write the note under that.
2. In `estate.json`, on the repo's entry, set `checks` to the approved commands. An entry written as a bare name becomes `{ "name": "<repo>" }` first. The note needs no entry, because the plugin finds it by the repo's name. Under `standards` list only what the plugin cannot find that way: a file the repo already keeps for people, such as its contributing notes, or a note written under another name. Each is a path counted from the estate root, and is listed, not copied into the note.
3. Link the note from the repo's note, `repos/<repo>.md`. Make that with `context-central note --new repos/<repo>` if it is not there yet.
4. Run each approved check once from the repo's folder and say what it exited with. A check that cannot run on this machine is reported as such and stays recorded.

## 6. Check

Run `context-central standards <repo>`, `context-central lint`, `context-central graph` and `context-central doctor`. Fix a file marked `(missing)` or `(a folder)`, every `ERROR` and every `BROKEN` line. A `FIX` line for `notes` means git would leave the new note out of the map's commits: show it to the person. Report the paths written and each question left open.
