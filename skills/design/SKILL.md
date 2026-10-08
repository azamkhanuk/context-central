---
name: design
description: Settle how a specified work item will be built before any code is written. Writes the modules, their interfaces, the order of the slices and the reason for each choice into the item's design file.
argument-hint: <item>
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The work item: $ARGUMENTS

Write the design of a work item that has a spec, before its code is written, or revise the design when a build has shown it wrong. The spec says what is built and why. The design says how, in the repos it touches, and in what order. A small item needs none: `/context-central:implement <item>` builds from the spec alone.

## 1. Load the item

Run `context-central resolve <item> --absolute`. The item exists only when the first line reads `Context for work item <item>:`; any other answer is a near match, so stop and say the item was not found. Read the state file, the `SPEC.md` beside it and the code map note, when the state file names one. With no spec, stop and suggest `/context-central:prep <item>`. When `DESIGN.md` is already there, this is a revision: read it, keep what still holds, change it where it stands, and mark a slice that is already built as built.

## 2. Load the standards

Run `context-central config --get repos`, then `context-central standards <repo>` for each repo the work touches. The repos are the ones the code map is headed with. With no code map, ask the person which repos the work touches. Read each standards file, the Design part first. Where a repo has none recorded, the design rests on the instruction files and on what the code already does, and says so.

## 3. Read the code the design will meet

Delegate bulk reading to the `context-central:reader` agent. Give it each repo's absolute path, the anchors of the code map, which are counted from the repo's root, and the question each one answers. With no code map, its first question is where the modules the spec names live. Read for what is already there to build on: the modules the change meets, their interfaces, how a neighbouring feature of the same shape was built, where its tests sit, and, for each interface whose failures rest on a dependency, that dependency's source at the version the repo pins, or a run of it.

## 4. Write the design

Save `DESIGN.md` beside the spec, headed with each repo, its commit (`git rev-parse --short HEAD`) and the date, with these seven parts in this order:

- **Shape**: the modules that change and the ones that are new, what each is for, and what may call what.
- **Interfaces**: each new or changed interface as it will be written in its repo, with what it takes, what it returns and how it fails on the failing inputs: the empty, the largest, the repeated and the failing case, and for a call that leaves the process the unreachable, the slow and the refused. A failure that rests on a dependency is written as that dependency's source at the version the repo pins, or a run of it, shows; what neither shows goes under Checks beyond this machine.
- **Choices**: each choice with its reason, the rule in the standards it follows (as the standards file's `path:line`), and the option turned down. A choice that departs from a rule says so and why. Each names the smaller option weighed; one turned down for now says, on one line, `Smaller: <option>. Not now: <why>. Revisit when: <trigger>.`
- **Slices**: the order of the build. Each slice is one behaviour through every layer it touches, in the one repo it names, with the test seam of the spec it starts from, the Interfaces headings it builds and the seams it covers. Every test seam of the spec is either started from by a slice, named under the slice that covers it, or named as not covered with the reason. A built slice ends with one line, `Built at <short commit>.`
- **Checks beyond this machine**: what the design assumes and only a system this machine cannot reach can show, each run once by hand before the work is switched on anywhere shared, or `none`.
- **If time is short**: the order in which the work is cut, and what is never cut, or `none`.
- **Anchors**: `path:line`, counted from the root of the repo it names, for each place the build starts from or must not break.

The design names files and lines, which the spec does not, so it carries the commit it was written at. It adds no requirement: something the spec does not ask for goes back to the person as a question, not into the design. Every requirement of the spec lands in at least one slice. A seam with no slice and no reason is a question too.

## 5. Show it

Link the design from "Where the detail lives" in the state file, as `[DESIGN.md](DESIGN.md)`, unless the link is there, and rewrite "Where it stands" and "Next" to say the item is designed and how much of it is built. Then show the person the Choices and the Slices in short, with every point where the design departs from the standards or could not follow the spec.

The person approves by starting the build. Suggest a fresh session: `/clear`, then `/context-central:implement <item>`.
