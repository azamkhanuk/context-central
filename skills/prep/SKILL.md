---
name: prep
description: Turn the conversation and the research on a work item into its spec, a code map and a tracker brief.
argument-hint: <item>
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

The work item: $ARGUMENTS

## 1. Load the item

Run `context-central resolve <item> --absolute`. The item exists only when the first line reads `Context for work item <item>:`; any other answer is a near match. If it does not exist yet, create it with `context-central work new <item> --title "<title>"`, which prints the state file's path. Read the state file and the research notes it points to.

## 2. Ask once

List every question the spec needs answered that neither the conversation nor the notes settle. Send them all in one message, numbered, each with the answer you recommend and why. Wait for the reply.

Done when no decision in the spec would be your guess.

## 3. Write the spec

Save `SPEC.md` beside the state file, with these parts:

- **Problem**: what is wrong or missing, for whom, and how that is known.
- **Solution**: the behaviour once this is built, in the estate's own terms.
- **Decisions**: each choice with its reason and the option turned down.
- **Test seams**: where behaviour is observed from outside, and what each test would show.
- **Out of scope**: what a reader might expect and will not get.

The spec names behaviour and modules, and holds no file paths: paths move as the code changes and a spec that cites them goes stale.

## 4. Write the code map

Code anchors go in `notes/<YYYY-MM-DD>-code-map.md` in the item's folder. Head it with each repo, its commit (`git rev-parse --short HEAD`) and the date, so a later reader can tell how far the code has moved. Then one line per anchor: `path:line` and what is there.

## 5. Glossary

Add each new domain term to `glossary.md` in the map, in that file's entry format, and use the glossary's wording in the spec.

## 6. Tracker brief

After the spec is saved, write a brief for the ticket in three parts: why, what, done when. The spec stays in the map; the tracker gets the brief only.

Run `context-central config --get writeRules` and `context-central config --get tracker.route`. Post the brief through that route only when the write rules allow it and the person approves the exact text. Otherwise show the text for the person to post. A setting that is absent makes `config --get` exit 1; treat that as "not allowed".

## 7. Update the state file

Rewrite "Where it stands" and "Next" for an item that is specified and not built, and list the spec and the code map under "Where the detail lives".

## 8. Hand over

Suggest a fresh session for the build: `/clear`, then `/context-central:implement <item>`. The state file and the spec carry everything the build needs. Where the work needs its structure settled first, suggest `/context-central:design <item>` before the build.
