---
name: design
description: Settle how a specified work item will be built before any code is written. Writes the modules, their interfaces and how each fails, each choice with its reason and the smaller option, the slices in order, the checks beyond this machine and what is cut if time is short into the item's design file.
argument-hint: <item>
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The work item: $ARGUMENTS

Write the design of a work item that has a spec, before its code is written, or revise the design when a build has shown it wrong. The spec says what is built and why. The design says how, in the repos it touches, and in what order. A small item needs none: `/context-central:implement <item>` builds from the spec alone.

Run `context-central draft <path>...` before a file of the map is read, edited, written or handed to an agent. A path is counted from the map's folder, or is an absolute path the plugin printed. For each it prints the absolute path of the file to use: the map's own, or in a git work tree whose map is in the main checkout a draft in the work tree, which starts as a copy of the map's file where the map has one. A file is in the work tree only once it has been drafted: where one is not there, draft it before saying that the map lacks it. `context-central take` puts the drafts into the map and removes them from the work tree: run it where a step says so and before a command that reads those files from the map, and after it run `context-central draft` on a file again before it is read or edited. It prints `took <path>` for each draft it took and `kept <path>: <why>` for one it left. A `kept` line that names a file to compare with means the map's file is not the one the draft was made from: read that file where it stands, with no draft of it, bring into the draft what it has and the draft lacks, then run `context-central take --over <path>`. A closing answer names a file by its place in the map, never by a draft's path, and a draft still kept goes under Needs a fix with its reason.

## 1. Load the item

Run `context-central resolve <item> --absolute`. Where it answers `no context map found`, no map covers this folder yet: run `context-central init --plain --dry-run`, show the person the lines it prints and ask once whether to make that plain map. On a yes run `context-central init --plain` and start this step again. On a no stop, and say that `/context-central:onboard` sets a map up. If either command refuses, stop and say what it said. Otherwise the item exists only when the first line reads `Context for work item <item>:`; any other answer is a near match, so stop and say the item was not found. Read the state file, the `SPEC.md` beside it and the code map note, when the state file names one. For each repo the code map is headed with read the map's note of that repo too, `repos/<repo>.md`, where there is one: it holds the repo's traps. With no spec, stop and suggest `/context-central:prep <item>`. When `DESIGN.md` is already there, this is a revision: read it, keep what still holds, change it where it stands, and mark a slice that is already built as built.

Run `context-central work adopt <item>` before anything is written to the item. It gives an item kept as a note of its own a state file beside that note and leaves the note as it is; for an item that has a state file it changes nothing and says so. Never pass `--all`, and never write to the older note. If the command refuses, write nothing to the item: stop and say what it said. When it adopted the item, say so in step 5.

## 2. Load the standards

Run `context-central config --get repos`, then `context-central standards <repo>` for each repo the work touches. The repos are the ones the code map is headed with. With no code map, ask the person which repos the work touches. Read each standards file, the Design part first. A standards note names the commit its lines were read at: where a file a rule cites has changed since, say so. Where a repo has none recorded, the design rests on the instruction files and on what the code already does, and says so. Where the command answers `no repo "<repo>" in this estate`, the map does not register that repo: the design rests on the same there and says so, and the repo's folder is the checkout the session is in, or the one the person names.

## 3. Read the code the design will meet

Delegate bulk reading to the `context-central:reader` agent. Give it each repo's folder, which is the `root` that `context-central standards <repo> --json` gives: the work tree, where the session is in a git work tree of that repo. Give it the anchors of the code map, which are counted from the repo's root, and the question each one answers. With no code map, its first question is where the modules the spec names live. Read for what is already there to build on: the modules the change meets, their interfaces, how a neighbouring feature of the same shape was built, where its tests sit, and, for each interface whose failures rest on a dependency, that dependency's source at the version the repo pins, or a run of it.

## 4. Write the design

Save `DESIGN.md` beside the spec, headed with each repo, its commit (`git rev-parse --short HEAD`, run in that repo's folder) and the date, with these seven parts in this order:

- **Shape**: the modules that change and the ones that are new, what each is for, and what may call what.
- **Interfaces**: each new or changed interface as it will be written in its repo, with what it takes, what it returns and how it fails on the failing inputs: the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused. A failure that rests on a dependency is written as that dependency's source at the version the repo pins, or a run of it, shows; what neither shows goes under Checks beyond this machine.
- **Choices**: each choice with its reason, the rule in the standards it follows (as the standards file's `path:line`), and the option turned down. A choice that departs from a rule says so and why. Each names the smaller option weighed, or `none`; one turned down for now says, on one line, `Smaller: <option>. Not now: <why>. Revisit when: <trigger>.`
- **Slices**: the order of the build. Each slice is one behaviour through every layer it touches, in the one repo it names, with the test seam of the spec it starts from, the Interfaces headings it builds and the seams it covers. Every test seam of the spec is either started from by a slice, named under the slice that covers it, or named as not covered with the reason. A built slice ends with one line, `Built at <short commit>.`
- **Checks beyond this machine**: what the design assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared, or `none`.
- **If time is short**: the order in which the work is cut, and what is never cut, or `none`.
- **Anchors**: `path:line`, counted from the root of the repo it names, for each place the build starts from or must not break.

The design names files and lines, which the spec does not, so it carries the commit it was written at. It adds no requirement: something the spec does not ask for goes back to the person as a question, not into the design. Every requirement of the spec lands in at least one slice. A seam with no slice and no reason is a question too.

## 5. Show it

Link the design from "Where the detail lives" in the state file, as `[DESIGN.md](DESIGN.md)`, unless the link is there, and rewrite "Where it stands" and "Next" to say the item is designed and how much of it is built. Run `context-central take`. Then close in this shape, where a line in angle brackets is a kind of point, given once for each there is and left out where there is none:

```
<one line saying the item is designed, and how much of it is built>

**Needs a fix**
- <a point where the design could not follow the spec>
- <a rule whose cited file has changed since the rule was read>
- <a draft still kept, with its reason>

**Yours to decide**
- <a point where the design departs from the standards, and why>. Recommended: <the answer>.
- <a question the spec does not answer>. Recommended: <the answer, and why>.

**Fine as it is**
- <the slices in their order, in short, with the ones already built>
- <a choice, in short>
- <the adoption, where there was one>

**Not known**
- <a check beyond this machine>

Design: <its path>. Next: <what holds the build back, where something does: first a point where the design could not follow the spec, then a question the spec does not answer; else `/clear`, then `/context-central:implement <item>`; or `/clear` alone where every slice is built>.
```

The groups come in that order, and a group with no point is left out. Inside a group what matters most comes first. A point is one thing in one sentence: two things that could be acted on apart are two points, and the parts of one thing go under it. A group shows five points at most, each with all its parts. Where it holds more, one more line follows the five: `and <N> more in <file>`, naming the one file that holds all of the rest, or, where no one file does, `and <N> more: <the rest, in short>`. Nothing that asks something of the person goes outside its group, and nothing is said before the first line or after the last. The person approves by starting the build.
