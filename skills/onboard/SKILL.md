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

Show what was found as a short list: each repo with its remote and default branch, the instruction files with their sizes, key candidates, MCP server names, which tools are installed, the `gh` accounts.

## 2. Ask once

Send every unsettled question in one message, numbered, each with the answer you recommend from the detection, so the person can reply "yes" or correct by number. Leave out a question the detection settles beyond doubt and state that value instead.

1. Estate name (short, lower case) and title.
2. Layout: `root` (the map sits at the estate root with the repos beneath it) or `inner` (the map sits inside one repo). Recommend `root` when repos were found one level down. And whether the map itself is kept in git.
3. Whether evidence that is not text (screenshots, recordings, exports) is committed. Recommend yes exactly when the map is kept in git, and say that `lint` then warns on any file over `budgets.evidenceBytes` (1 MB unless set). The answer may be no because a screenshot can show personal data, and no text check reads an image.
4. The repos to register and the role of each in a phrase.
5. Folders the plugin leaves alone (scratch space, archives, other people's checkouts).
6. Tracker: type (`jira`, `github`, `azure-devops`, `none`), site, project keys, and the key patterns as regular expressions. Recommend patterns from `keyCandidates`.
7. Tracker route: how a session reaches the tracker (an MCP server from `mcpServers`, `gh`, another CLI) and the exact tool or command for each of read issue, search, comment and transition.
8. Per repo: the base branch (recommend `defaultBranch`), where the key goes (branch name, commit subject, PR title) and the commit style.
9. Code host: type, organisation (recommend the detected `org`) and which `gh` account to pin (from `ghAccounts`).
10. Meeting and chat sources, and how each is reached.
11. Write rules: what may be posted outside the map (tracker comments, transitions, PR comments, pushes) and which of those need approval each time.
12. Whether implement writes tests, and whether it runs a review.
13. Estate skills the plugin should defer to for implementing.

Done when every question has an answer or an explicit "none".

## 3. Draft the config

Show the draft in this shape and wait for a yes. Omit a key that has no value.

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
    "tracker": {
      "type": "jira",
      "site": "https://tracker.acme.example",
      "projects": ["PROJ"],
      "keyPatterns": ["PROJ-\\d+"],
      "route": { "via": "the server or CLI", "tools": { "readIssue": "", "search": "", "comment": "", "transition": "" } }
    },
    "codeHost": { "type": "github", "org": "acme", "ghUser": "the pinned account" },
    "sources": { "meetings": "", "chat": "" },
    "writeRules": ["one rule per line, as the person worded it"],
    "implement": { "tests": true, "review": true, "deferTo": "" }
  }
}
```

When the file that will be the hub is already longer than the hub budget of 200 lines (`instructionFiles` gives its length), add `"budgets": { "hubLines": <its length plus 30> }` to the draft's config and tell the person the hub is over the recommended size. Otherwise the first `lint` fails on a file they have not touched.

## 4. Write the map

1. Save the approved draft as an answers file in a temporary directory outside the estate.
2. Run `context-central init <dir> --from <answers file> --dry-run` and show what it would create.
3. Run it again without `--dry-run`. It never overwrites: a `kept` line means the file was already there.

The commands in the steps below find the map from the working directory, so run them from `<dir>`.

## 5. Terminal launcher

Offer `context-central wrapper --write`, which lets the person run the CLI from an ordinary terminal. Run it on a yes.

## 6. Settings

Run `context-central init --print-settings` and show the JSON. Ask where it goes: `.claude/settings.json` (shared with everyone who uses the map) or `.claude/settings.local.json` (this machine only). Either sits in the folder sessions start from: the estate root or, for layout `inner`, the repo that holds `.context-central/`. Write it only on a yes, merging into the keys already in that file.

## 7. Settings a map-root session will not load

Layout `root` only. A session started at the estate root loads none of the repos' own settings. Read each registered repo's `.claude/settings.json`, `.claude/settings.local.json` and `.mcp.json`, and list every `permissions.deny` rule, `permissions.ask` rule and MCP server name found, by repo. Offer to copy them up into the map's settings and `.mcp.json`; copy only what the person picks.

## 8. Glossary

Seed `glossary.md` in the entry format `init` wrote there, from the terms the instruction files and `glossaryCandidates` define. Take a term only when its source states the meaning; list the terms that are used but undefined for the person to fill in.

## 9. Check

Run `context-central doctor`. Fix each `FIX` line you can and report the rest with what the person has to do.

Finish by telling the person to restart the session or run `/clear`, so the hub loads, and that `/context-central:standards <repo>` records how a repo's code is written and checked once work starts in it.
