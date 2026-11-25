# Research

`/context-central:research <question> [item]` answers a question from primary sources and keeps what it found as a research: a folder of its own in the map, of numbered facts with every source saved beside them, which later runs add to, check and hand over. It writes no code, and with the plugin it ends by naming the step that comes next. It can be left to run with nobody there, and it can be taken alone, with no plugin.

[A piece of work, step by step](step-by-step.md#1-research) has where research sits among the steps. This page has the folder, a run, the runs on a research that is there, leaving it to run, the settings an estate extends it by, and research taken alone.

## The folder

Every research is a folder under `research/` in the map, named in small letters, digits and dashes, such as `research/gateway-limits/`, with an item or without. An estate that keeps something else under that name gives research another folder with `researchDir`. `context-central research new <name>` makes the folder, and `context-central research open <name>` says where one stands.

```
research/gateway-limits/
  index.md       the fact sheet
  brief.md       the research brief: the questions, where the run looks, its depth, what is out of scope and the start line
  log.md         one entry for each round, and every fact that was superseded, word for word
  set-aside.md   what the run judged beside the point, each with its source and why
  reading.md     the reading: the four groups, pointing at fact numbers, a dated part for each run
  sources/       every source in full, saved before anything is drawn from it and never edited
```

**The fact sheet** opens by saying how to read the folder, for a reader that knows nothing of the plugin. Then come the questions, the day to check it again by, what was not reached, the facts that stand and the sources, each with its kind. Past `budgets.researchSheetBytes`, 16,000 bytes unless set, the facts move to pages by subject, which the sheet links.

**A fact** is one thing in one sentence, with its number, its mark and every source that says it:

```
- **F7** `verified` The gateway retries a failed call three times.
  - Source: [03-2026-11-22-chat-retries-full-text.md](sources/03-2026-11-22-chat-retries-full-text.md)
  - Source: `api/src/gateway.js:41-58` at `3f2a9c1`
```

- Two sources that say one thing are one fact, with a `Source` line for each, however differently they word it.
- `verified` is earned by reading the source itself in that run, never a search result or a summary. `inferred` has a `From` line instead, with the facts and anything else it was reasoned from.
- Where sources disagree and the run cannot tell which holds, one fact carries `disputed` and shows what each says.
- A fact that no longer holds is superseded: a newer fact takes the next number and names the one it replaces, the day and the reason, and the old fact leaves the sheet for that round's entry in the log, word for word. A number is never used twice.
- Code is cited by its line at a commit, a page on the web by its full address, and anything else by its saved file.

**Where it is linked from.** With an item, the item's state file lists the fact sheet under where the detail lives. With none, the note of each repo it is about links it, `repos/<repo>.md`, made where the map has none. A research about no repo the map registers is linked from nothing, and the closing answer says so.

`lint` holds every research to its layout: a number used once across the sheet and the log, a superseded fact in the log and the fact in its place naming it with the day and the reason, a fact marked verified naming its source, each saved source named by some file, and no link out of the folder but a full address and, with an item, a link to that item's saved ticket or pull request. `graph` reads the folder too. Neither says anything of a cited line that has moved or a day to check again by that has passed: `research moved` and `research open` say those.

No file of a research names a step of the plugin. A research note written before this release stays where it is and reads as before.

## A run

1. **The brief.** The run turns what you typed into questions about what is so, numbered `Q1` on, and writes the brief with them: where it will look, the depth, what is out of scope, and its start line. It shows you the brief once and waits for your yes, and that is the one thing it waits on. Your say over where it looks is the brief.
2. **The start line** says what the run goes with: each connection and how this machine reaches and searches it, each tool of the session the map does not record, with how to record it, and each kind the question needs that nothing reaches.
3. **Rounds.** Each round opens with `research open`, sweeps every connection for leads, has every lead read in full or set aside with its reason, and is written to the folder and taken into the map before the next round starts. The first round sweeps every place the brief covers, however many there are. A gap is written when it is met: what was wanted, what pointed at it and how to connect it.
4. **The stop.** With you waiting, a run stops when every question is answered, when a round adds no fact and no lead, or at its depth's cap. It says which. Left alone, it does not stop at its answers: it follows the open leads until a round adds nothing, with the cap kept as a valve.
5. **The answer.** The reading gets this run's part, laid out by the estate's template where `readingTemplate` names one, and the closing answer gives the four groups, with what was not reached under Not known.

**The depths** are quick, standard and deep, each a cap on rounds and on agents at once. Standard is the default with you waiting and deep with nobody there, and what you type wins.

| Depth | Rounds | Agents at once | Keys under `budgets` |
|---|---|---|---|
| quick | 1 | 2 | `researchQuickRounds`, `researchQuickAgents` |
| standard | 3 | 3 | `researchStandardRounds`, `researchStandardAgents` |
| deep | 6 | 5 | `researchDeepRounds`, `researchDeepAgents` |

**Who reads what.** Each kind of reading goes to an agent of the plugin, at every depth:

| Kind | Agent | What it may do |
|---|---|---|
| a sweep of one connection for leads | `context-central:sweeper` | search; it is denied the tools that write a file and saves nothing |
| many files, long files, saved sources | `context-central:reader` | read, with a shell for `slice` and git, and write no file |
| a ticket or a pull request | `context-central fetch`, and the fetcher where fetch says a session reads the connection | save the full text where it is told, and nothing else |
| anything else in a connection | `context-central:fetcher` | the same |
| a page on the web | `context-central:web-reader` | fetch and search the web, and nothing else |

Each agent is handed the brief's questions and never what you want built: the wish stays out of every prompt. What sits in a system nothing reaches is a gap. Where no agent holds what a kind needs, the session does that reading itself where it can, and otherwise it is a gap with what the host lacks as how to connect it.

## A research that is there

A research is named by the first word you type: `/context-central:research gateway-limits <what next>`. What follows the name says what the run does:

- **Nothing.** Where the research stands, and what can be asked of it. Nothing is gathered or written.
- **More questions.** A round on it: the questions join the brief, new facts take the next numbers, a fact that no longer holds is superseded, and the log gets its entry.
- **A plain question about it.** Answered from the sheet by fact number, and from the log for a number that was superseded, with nothing gathered.
- **Whether it still holds.** `context-central research moved <name>` lists the facts whose cited lines, at the commit each was read at, read another way at the head. The run reads again what moved, and a dated round writes the facts that supersede.
- **Whether a spec, a design or a diff agrees with it.** The run lists the facts it goes against, the facts it puts out of date and what it rests on that no fact covers, in a dated round, and rewrites nothing.
- **What a build learned.** A round you start reads what the build left where it lies, the item's review note, its state file, its saved pull request and the code at the commit it reached, and saves a copy of each note it rests on among the research's sources. No other step writes into a research.
- **A run that was cut off** is taken up where it stopped: the name with `carry on` after it.
- **A hand-over.** `context-central research handover <name> <folder>` copies the research into a folder outside the map that stands by itself, to attach to a feature or give to another planner. The item's saved ticket and pull request that the research links are copied in, `--without <kind>` leaves out the saved sources of a kind, such as mail, and names the facts that rest on them alone, and `--reading` copies the reading too. It writes nothing where a link would lead outside the copy.

## Leaving it to run

Nobody is there where what you type says so, such as "Nobody is here, so do not wait for me", or where the host gives the run no way to ask. Then the run asks nothing: the brief is taken as written, each thing it would have asked goes under Not known with what would settle it, the depth is deep unless you typed one, and the run does not stop at its answers. One thing it never does unasked: where no map covers the folder it writes nothing and ends on `context-central init --plain`, the command that makes a plain map, unless what you typed says yes to one.

On Claude Code a run can be started with no terminal, from the folder the map covers:

```sh
claude -p "/context-central:research Nobody is here, so do not wait for me. How does the gateway limit a shop's calls? Run it at the quick depth." \
  --permission-mode acceptEdits \
  --allowedTools "Bash(context-central *)" "Bash(git *)" "Skill" "WebFetch" "WebSearch" "mcp__<server>__<tool>" \
  --disallowedTools ScheduleWakeup CronCreate \
  --output-format stream-json --verbose < /dev/null > run.jsonl
```

- `acceptEdits` lets the run write its files, and `--allowedTools` lets it run the plugin's command and git, start a skill the estate names for research, read the web, and use each tool of a server by its name, `mcp__<server>__<tool>`. Name the tools that read and none that post.
- The run goes with the connectors of the account that are signed in. One that waits for a sign-in gives no tool, so the start line names what it reaches as a gap.
- `< /dev/null` closes its input, without which the run waits on it. `--disallowedTools ScheduleWakeup CronCreate` keeps a run that waits on an agent from setting itself a wake-up that starts it again after it has ended.
- The record `run.jsonl` holds every message of the run and its agents. Where its agents work in the background it ends more than once, and the last `result` carries the whole run's cost.

## What an estate can set

An estate extends research through its settings and its own skills, with no change to the plugin:

- **Where it looks**: its connections. Every kind a connection holds has a part in research, and onboard asks for chat, mail, documents and designs beside tickets, pull requests and meetings. [Connections](connections.md) has how each is recorded.
- **How it looks there**: a skill of the estate's own for research, named by a repo's `steps.research`, by `researchSkill` for the estate as a whole, or by `researchSkill` on one connection, which then is that connection's sweep. The start line names each, and you can strike one in the brief.
- **How far it goes**: the depths, as the six keys under `budgets` above.
- **How the result is laid out**: `readingTemplate`, a file at the estate root whose headings lay out each run's part of the reading. The fact sheet's layout is fixed.
- **Where it lives**: `researchDir`, a folder counted from the map's folder, `research` unless set.

## Research taken alone

The research skill is in the open skill format, so it can be installed by itself, with no plugin and none of the other steps. Shown on Claude Code with no plugin loaded: the skill was put into a project by the installer of loose skills from a copy of this repository, and the command was linked from that copy by npm.

```sh
npx skills add <a clone of context-central> --skill research -a claude-code
npm install -g <a clone of context-central>
```

The command can also come from the package each release carries from 0.21.0, a file npm installs, made at release with the types taken out: `npm install -g ./context-central-0.21.0.tgz`. It is attached to the release on GitHub and published to no registry. Either way it needs Node 22.18 or later, as the skill's `compatibility` line says.

Taken alone, it works as it does with the plugin, save for two things. It names no step at the end, and gives the next things to do in plain words, such as handing the folder to whoever plans the work. And it holds none of the plugin's agents: each kind of reading goes to a subagent of the host, handed the agent's brief from the skill's `references/` folder by its path.

Other hosts read the open skill format, and research has not been run on one. Its folder holds `agents/openai.yaml`, the file one such host reads to keep a skill to the person who types it.

## Where a host cannot hold it

- **A skill kept to the person.** Claude Code starts research only when you type it, as its head says. A host that reads `agents/openai.yaml` is told the same. A host that reads neither may start research of its own accord.
- **An agent kept to reading.** With the plugin on Claude Code, the sweeper is denied the tools that write a file and the web reader holds two tools that fetch and nothing else. Taken alone, a subagent is chosen that is denied those tools where the host has one, as Claude Code's Explore is. Where a host has none, only the brief's words keep an agent from writing.
- **A session that reads for itself.** Where no subagent holds what a kind of reading needs, the session reads it itself, so the raw text comes into its own context.

Research never posts outside the map, and never records a tool of the session in the settings.
