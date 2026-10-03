---
name: implement
description: Build a work item from its spec, one slice at a time, verified, then checkpointed.
argument-hint: <item>
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The work item: $ARGUMENTS

## 1. Load the item

Run `context-central resolve <item> --absolute`. The item exists only when the first line reads `Context for work item <item>:`; any other answer is a near match, so stop and say the item was not found. Read the state file and the `SPEC.md` beside it. With no spec, stop and suggest `/context-central:prep <item>`.

## 2. Read the estate's settings

Run `context-central config --get implement` and `context-central config --get repos`. A setting that is absent makes `config --get` exit 1, and a key may be missing inside `implement`: `tests` absent means on, `review` absent means on, `deferTo` absent or empty means nothing to defer to.

- If `implement.deferTo` names an estate skill, invoke that skill with the item and the spec's path, and follow it in place of steps 3 to 6. Come back here for step 7.
- For each repo the work touches: branch from its `baseBranch`, put the key where `keyPlacement` says, and write commits in its `commitStyle`. Where one of these is unset, follow the repo's recent history.
- Pushing, opening a PR and posting to the tracker follow `context-central config --get writeRules`. Anything those rules do not cover waits for the person's yes.

## 3. Build in slices

Order the spec into vertical slices: each one behaviour, working through every layer it touches. Build one slice at a time.

When `implement.tests` is on, each slice starts with a failing test at one of the spec's test seams, then the code that passes it. Run the repo's own checks after each slice and keep them green before starting the next.

A slice that shows the spec to be wrong stops the build: say what was found and ask.

## 4. Verify

Run the tests, the typecheck, the build and the behaviour itself, and read the output. Done when every requirement in the spec is either shown working by output from this session or listed as not done.

## 5. Review

When `implement.review` is on, delegate to the `context-central:reviewer` agent. Give it the repo's absolute path, the diff range (`<base branch>...HEAD`) and the spec's absolute path. Fix each finding or say why it stands, then repeat step 4.

## 6. Report

Say what was built, what the verification showed, and what is left.

## 7. Checkpoint

Invoke the `context-central:checkpoint` skill so the state file, the notes and the log match what was done.

Then suggest `/clear`: the state file now carries the item.
