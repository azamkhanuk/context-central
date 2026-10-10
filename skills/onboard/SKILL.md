---
name: onboard
description: Set up a context map for this estate. Detects what is on disk, asks only what is unsettled, writes the config and the map, then checks it.
disable-model-invocation: true
allowed-tools: Bash(context-central *)
---

Set up the map in the directory named here, or the working directory when none is named: $ARGUMENTS

Names only throughout: tokens and the content of env files are never read, shown or written.

## 1. Detect

Run `context-central detect --json` (add the directory when one was named).

If `existingMap` is set, a map already covers this place: say where it is, run `context-central doctor`, and stop unless the person asks to set it up again.

Show what was found as a short list: each repo with its remote and default branch, the instruction files with their sizes, key candidates, MCP server names, which tools are installed, the accounts and the connection candidates.

Then add what the disk cannot show: the MCP servers and connectors this session itself holds, read from the names in its own tool list. A tool named `mcp__<server>__<tool>` belongs to the server `<server>`.

## 2. Ask once

Send every unsettled question in one message, numbered, each with the answer you recommend from the detection, so the person can reply "yes" or correct by number. Leave out a question the detection settles beyond doubt and state that value instead.

1. Estate name (short, lower case) and title.
2. Layout: `root` (the map sits at the estate root with the repos beneath it) or `inner` (the map sits inside one repo). Recommend `root` when repos were found one level down. And whether the map itself is kept in git.
3. Whether evidence that is not text (screenshots, recordings, exports) is committed. Recommend yes exactly when the map is kept in git, and say that `lint` then warns on any file over `budgets.evidenceBytes` (1 MB unless set). The answer may be no because a screenshot can show personal data, and no text check reads an image.
4. The repos to register and the role of each in a phrase.
5. Folders the plugin leaves alone (scratch space, archives, other people's checkouts).
6. Connections: each outside system the estate uses, one for each kind of thing it holds: tickets, pull requests, meetings, chat or any other. For each: a short name, what it holds, how a reference to it looks (a pattern from `keyCandidates`, a link) and how it is reached: a preset from `connectionCandidates`, a server this session holds, the estate's own command, or by hand. For a preset, `context-central connections --presets` lists the parameters it takes: ask for each one the candidate does not give. Recommend each candidate, and each server that plainly belongs to one. Recommend at least one connection, so that a session can read the ticket or the pull request behind the work, and accept "none".
7. For each connection, one reference the person can read through it (a ticket, a pull request), so that step 5 can prove it.
8. Per repo: the base branch (recommend `defaultBranch`), where the key goes (branch name, commit subject, PR title), the commit style, and which connection holds its pull requests when more than one does.
9. Write rules: what may be posted outside the map (ticket comments, transitions, PR comments, pushes) and which of those need approval each time.
10. Whether implement writes tests, whether it runs a review, and how many review rounds it allows before it stops and asks. Recommend three.
11. Estate skills the plugin should defer to for implementing.
12. The estate's glossary: a file it already keeps, from `glossaryCandidates`, or the map's own. Recommend a candidate only where it holds the estate's terms.

Done when every question has an answer or an explicit "none".

## 3. Draft the config

Show the draft in this shape and wait for a yes. Omit a key that has no value. Where the estate keeps its own glossary, add `"glossary"` to the config with the file's path from the estate root: `init` then lays out none and never changes that file. A connection carries only the keys that are true of it: `references`, `preset` with that preset's own parameters, `server`, `commands`, `how`, `account`, `repos`.

```json
{
  "layout": "root",
  "git": true,
  "config": {
    "contextCentral": 1,
    "name": "acme",
    "title": "Acme estate",
    "repos": [{ "name": "web", "path": "web", "role": "front end", "baseBranch": "main", "keyPlacement": "branch name and PR title", "commitStyle": "conventional" }],
    "leftAlone": ["scratch"],
    "evidence": { "commit": true },
    "connections": {
      "tracker": { "holds": "tickets", "references": ["PROJ-\\d+"], "server": "the name of the server" },
      "code": { "holds": "pull-requests", "preset": "a preset from the candidates", "account": "the pinned account", "repos": ["web"] },
      "notes": { "holds": "meetings", "how": "how a person gets at them" }
    },
    "writeRules": ["one rule per line, as the person worded it"],
    "implement": { "tests": true, "review": true, "deferTo": "", "reviewRounds": 3 }
  }
}
```

When the file that will be the hub is already longer than the hub budget of 200 lines (`instructionFiles` gives its length), add `"budgets": { "hubLines": <its length plus 30> }` to the draft's config and tell the person the hub is over the recommended size. Otherwise the first `lint` fails on a file they have not touched.

## 4. Write the map

1. Save the approved draft as an answers file in a temporary directory outside the estate.
2. Run `context-central init <dir> --from <answers file> --dry-run` and show what it would create.
3. Run it again without `--dry-run`. It never overwrites: a `kept` line means the file was already there.

The commands in the steps below find the map from the working directory, so run them from `<dir>`.

## 5. Prove each connection

Run `context-central connections`. For each connection, read the reference the person named for it:

- where the line says it is read by fetch: `context-central fetch ticket "<reference>" --check` or `context-central fetch pr "<reference>" --check`, which runs the read and saves nothing. The reference goes in quotes, since one may start with `#`;
- where it is reached through a server: find the server's tool for reading that kind of thing with tool search, by the server's name and what the connection holds, and call it;
- where it is the estate's own command: run it with the reference in place of `{id}`.

A read that fails is reported with what was printed, and the connection stays as written unless the person changes it. Say which connections were proven and which were not. A connection reached by hand is not proven and needs no proof.

Then offer allow rules for the read tools just used, for `.claude/settings.local.json` on this machine only. A server's tool is allowed by its full name, `mcp__<server>__<tool>`. Write them only on a yes.

## 6. Terminal launcher

Offer `context-central wrapper --write`, which lets the person run the CLI from an ordinary terminal. Run it on a yes.

## 7. Settings

Run `context-central init --print-settings` and show the JSON. Ask where it goes: `.claude/settings.json` (shared with everyone who uses the map) or `.claude/settings.local.json` (this machine only). Either sits in the folder sessions start from: the estate root or, for layout `inner`, the repo that holds `.context-central/`. Write it only on a yes, merging into the keys already in that file.

Then say what decides whether the plugin loads. Claude Code reads project settings only from the folder a session starts in, and applies those that add a marketplace only once that folder's trust prompt has been accepted in a session with a person in it: in a headless run of a folder nobody has trusted, nothing loads. The printed entry turns auto-update on, so a release reaches everyone who has the plugin this way. For layout `root`, a session started inside a repo is not given the plugin by the estate root's settings. Offer the two ways round: install it for the person, with `claude plugin install context-central@context-central`, or put the same JSON in each registered repo as well, asking for each, as above, whether shared or for this machine only. A copy installed for the person loads in every session with no trust prompt to wait for, and a release reaches it by `claude plugin update context-central@context-central`, or by itself where auto-update is on. One installed for a single project, with `--scope project` or `--scope local`, loads in sessions started in that project once its folder has been trusted, and is updated the same way. A launcher finds a copy only where Claude Code has recorded an install: the one for the project the launcher's own file sits in, or else the person's. With neither, `CONTEXT_CENTRAL_CLI` names the plugin's `bin/context-central` file.

## 8. Settings a map-root session will not load

Layout `root` only. A session started at the estate root loads none of the repos' own settings. Read each registered repo's `.claude/settings.json`, `.claude/settings.local.json` and `.mcp.json`, and list every `permissions.deny` rule, `permissions.ask` rule and MCP server name found, by repo. Offer to copy them up into the map's settings and `.mcp.json`; copy only what the person picks.

## 9. Glossary

Where the glossary is the map's own, seed `glossary.md` in the entry format `init` wrote there, from the terms the instruction files and `glossaryCandidates` define. Where the estate named its own, seed nothing: `context-central where` says where it is. Take a term only when its source states the meaning; list the terms that are used but undefined for the person to fill in.

## 10. Check

Run `context-central doctor` and fix each `FIX` line you can.

Close with one line saying the map is set up, then these groups in this order, each name in bold on a line of its own with its points listed under it, and a group with no point left out: **Needs a fix**, each `FIX` line left, with what the person has to do, and each connection whose read failed; **Yours to decide**, each term that is used and not defined; **Fine as it is**, what was written, each connection proven and each `note` line as it is; **Not known**, each connection not proven. A point is one thing in one sentence: two things that could be acted on apart are two points, and the parts of one thing go under it. The worst comes first, and a group shows five points at most. Where it holds more, its last line says where the rest is, as `and <N> more in the map`, or what the rest is where the map does not hold it, as `and <N> more: <the rest, in short>`. Nothing that asks something of the person goes outside its group.

End on one last line: where the map is, that the person restarts the session or runs `/clear`, so the hub loads, and that `/context-central:standards <repo>` records how a repo's code is written and checked once work starts in it. Say nothing after it.
