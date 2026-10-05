# Changelog

Each release of context-central, newest first. The version is the one in `.claude-plugin/plugin.json`. An installed copy stays on its release until `claude plugin update context-central@context-central` finds a newer one.

## 0.2.0 - 2026-10-05

- **Needs Node 22.18 or later.** It was Node 20, which reached its end of life in April 2026. On an older Node a command says so in one line, and the hooks stay quiet apart from one message at the start of a session.
- **Written in TypeScript.** The whole program, its tests and its scripts are TypeScript checked in strict mode. Node runs it as it is, so there is still nothing to compile or install, and with Node 24 a start takes as long as it did before. With Node 22 it took about 30 ms longer on the one machine it was measured on.
- Nothing changes in what the commands, the hooks, the skills or the agents do.

## 0.1.0 - 2026-10-04

The first release.

- **A context map.** One hub file routes a task to its notes, each piece of work in flight has a small state file, notes are kept by kind, and long text is saved in full in a deep tier that is read only when needed. The map sits at the root of a folder of repositories, or inside one repository.
- **Two hooks.** At the start of a session, the live index: the map, the hub and the work in flight. On a prompt that names a work item, a repository or a pull request, a short list of pointers to the notes behind it, delivered once a session.
- **A command, `context-central`.** It sets up and checks a map (`init`, `doctor`, `lint`, `graph`), works with it (`work`, `resolve`, `note`, `evidence`, `fetch`) and saves a launcher for use from a terminal (`wrapper`). `context-central help` lists every command.
- **Five skills and three agents.** The skills are `onboard`, `research`, `prep`, `implement` and `checkpoint`; the agents are `reader`, `fetcher` and `reviewer`.
- **Evidence.** Screenshots, recordings and exports go in a work item's `evidence/` folder, which the commands count and never open.
- **Linux, macOS and Windows.** The tests run on all three with Node 20, 22 and 24. On Windows the plugin has been tried on GitHub's machines only, not in a live Claude Code session; the README lists what was shown there and what was not.
