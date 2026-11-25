# Research

`/context-central:research <question> [item]` answers a question from primary sources and keeps what it found as a research: a folder of its own in the map, of numbered facts with every source saved beside them, which later runs add to, check and hand over. It writes no code, and with the plugin it ends by naming the step that comes next. It can be left to run with nobody there, and it can be taken alone, with no plugin.

[A piece of work, step by step](step-by-step.md#1-research) has where research sits among the steps. This page has the folder, a run, the runs on a research that is there, leaving it to run, the settings an estate extends it by, research taken alone, where a host cannot hold it, and what the runs of 0.21.0 showed.

## The folder

Every research is a folder under `research/` in the map, such as `research/gateway-limits/`, with an item or without. The command takes a name of letters, digits, dots, dashes and underscores that opens with a letter or a digit and does not end in a dot; the skill gives a new research a name in small letters, digits and dashes. An estate that keeps something else under that name gives research another folder with `researchDir`. `context-central research new <name>` makes the folder, and `context-central research open <name>` says where one stands.

```
research/gateway-limits/
  index.md       the fact sheet
  brief.md       the research brief: the questions, where the run looks, its depth, what is out of scope and the start line
  log.md         one entry for each round, and every fact that was superseded, word for word
  set-aside.md   what the run judged beside the point, each with its source and why
  reading.md     the reading: the four groups, or the estate's template, pointing at fact numbers, a dated part for each run
  sources/       every source in full, saved before anything is drawn from it and never edited
```

**The fact sheet** opens by saying how to read the folder, for a reader that knows nothing of the plugin. Then come the questions, the day to check it again by, what was not reached, the facts that stand and the sources, each with its kind. Past `budgets.researchSheetBytes`, 16,000 bytes unless set, the facts move to pages by subject, which the sheet links. Where `research open` says that day has passed, the first line of the reply of a run on the research says so, with the new day where the run wrote one.

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

`lint` holds every research to its layout: a number used once across the sheet and the log, a superseded fact in the log and the fact in its place naming it with the day and the reason, a fact marked verified naming its source, and no link out of the folder but a full address and, with an item, a link to that item's saved ticket or pull request. `graph` reads the folder too, and names a saved source no file names and a fact sheet nothing links. Neither says anything of a cited line that has moved or a day to check again by that has passed: `research moved` and `research open` say those.

No file of a research names a step of the plugin. A research note written before this release stays where it is and reads as before.

## A run

1. **The brief.** The run turns what you typed into questions about what is so, numbered `Q1` on, and writes the brief with them: where it will look, the depth, what is out of scope, and its start line. It shows you the brief once and waits for your yes, and that is the one thing it waits on. Your say over where it looks is the brief.
2. **The start line** says what the run goes with: each connection and how this machine reaches and searches it, each tool of the session the map does not record, with how to record it, each kind the question needs that nothing reaches, each skill of the estate's own the run will start, and whether git keeps the folder or ignores it.
3. **Rounds.** Once the brief is agreed, a repo's or the estate's own skill for research, where one is named, is started before the first round: it runs in the session, what it hands back is material and no reply to you, and the run goes straight on from it in the same turn. A connection's own skill is that connection's sweep instead, started in each round that sweeps the connection, in place of a sweeper. Each round opens with `research open`, has every lead read in full or set aside with its reason, and is written to the folder and taken into the map before the next round starts. The first round sweeps for leads every connection the start line names that is searched through its server, by a command of the estate or by a skill of the estate's own, and each tool of the session the start line names, at every depth and however many there are, each by a sweeper of its own or by the connection's skill, which alone searches that connection; only you strike one. A connection read by name only is not swept, and a later round sweeps only where an open lead calls for a search. A thing in a connection or on the web that a source names, such as a document a thread points to, is a lead of the next round: it is read in full there where a connection or the web reader can read it, is a gap where nothing can, and is never set aside unread. A gap is written when it is met: what was wanted, what pointed at it and how to connect it.
4. **The stop.** With you waiting, a run stops when every question is answered, when a round adds no fact and no lead, or at its depth's cap. It says which. Left alone, it does not stop at its answers: it follows the open leads until a round adds nothing, with the cap kept as a valve.
5. **The answer.** The reading gets this run's part, laid out by the estate's template where `readingTemplate` names one, and the closing answer gives the four groups, with what was not reached under Not known. Its first line answers the question, and says so where the day to check again by had passed. Its last line names the fact sheet and the next step: a step of the plugin or none, and where it names none, or research was taken alone, the next things to do in plain words.

**The depths** are quick, standard and deep, each a cap on rounds and on agents at once. Standard is the default with you waiting and deep with nobody there, and what you type wins.

| Depth | Rounds | Agents at once | Keys under `budgets` |
|---|---|---|---|
| quick | 1 | 2 | `researchQuickRounds`, `researchQuickAgents` |
| standard | 3 | 3 | `researchStandardRounds`, `researchStandardAgents` |
| deep | 6 | 5 | `researchDeepRounds`, `researchDeepAgents` |

**Who reads what.** Each kind of reading goes to its agent at every depth, and a sweep to a connection's own skill where the estate names one:

| Kind | Agent | What it may do |
|---|---|---|
| a sweep of one connection for leads | `context-central:sweeper`, or the skill the estate names for that connection | search and save nothing; it is denied the tools that write a file, and still holds a shell and the server's tools |
| many files, long files, saved sources | `context-central:reader` | read, with a shell for `slice` and git, and write no file |
| a ticket or a pull request | `context-central fetch`, and the fetcher where fetch says a session reads the connection | save the full text where it is told; the fetcher holds every tool of the session, and only its brief keeps it to that |
| anything else in a connection | `context-central:fetcher` | the same |
| a page on the web | `context-central:web-reader` | fetch and search the web, and nothing else |

Each agent is handed the brief's questions and never what you want built: the wish stays out of every prompt. The plugin's agents are handed no brief and no path of the skill, since their own text holds it. What sits in a system nothing reaches is a gap. Where no agent holds what a kind needs, the session does that reading itself where it can, and otherwise it is a gap with what the host lacks as how to connect it.

## A research that is there

A research is named by the first word you type: `/context-central:research gateway-limits <what next>`. The run first says in one line that it is on that research, which kind of run it is, and, where the day to check again by has passed, that it has. What follows the name says what the run does:

- **Nothing.** Where the research stands, and what can be asked of it. Nothing is gathered or written.
- **More questions.** A round on it: the questions join the brief, new facts take the next numbers, a fact that no longer holds is superseded, and the log gets its entry.
- **A plain question about it.** Answered from the sheet by fact number, and from the log for a number that was superseded, with nothing gathered.
- **Whether it still holds.** `context-central research moved <name>` lists the facts whose cited lines, at the commit each was read at, read another way at the head. The run reads again what moved, and a dated round writes the facts that supersede.
- **Whether a spec, a design or a diff agrees with it.** The run lists the facts it goes against, the facts it puts out of date and what it rests on that no fact covers, in a dated round, and rewrites nothing. A line the diff adds to a page, such as its README, goes with the diff's own code where that code does what it says. The reply's first line says no where it goes against a fact and yes otherwise, then names the facts it puts out of date, and then, where the day to check again by has passed, says so.
- **What a build learned.** A round you start reads what the build left where it lies, the item's review note, its state file, its saved pull request and the code at the commit it reached, and saves a copy of each note it rests on among the research's sources. No other step writes into a research.
- **A run that was cut off** is taken up where it stopped: the name with `carry on` after it.
- **A hand-over.** `context-central research handover <name> <folder>` copies the research into a folder outside the map that stands by itself, to attach to a feature or give to another planner. The item's saved ticket and pull request that the research links are copied in, `--without <kind>` leaves out the saved sources of a kind, such as mail, by the sheet's list of sources, whether or not a file can be read, and names the facts that rest on them alone, and `--reading` copies the reading too. It writes nothing where a link would lead outside the copy.

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
- The record `run.jsonl` holds every message of the run and its agents. Where its agents work in the background it ends more than once, since a run may end its turn to wait for an agent to come back, which is no stop, and the last `result` carries the whole run's cost.

## What an estate can set

An estate extends research through its settings and its own skills, with no change to the plugin:

- **Where it looks**: its connections. Every kind a connection holds has a part in research, and onboard asks for chat, mail, documents and designs beside tickets, pull requests and meetings. [Connections](connections.md) has how each is recorded.
- **How it looks there**: a skill of the estate's own for research, named by a repo's `steps.research`, by `researchSkill` for the estate as a whole, or by `researchSkill` on one connection, which then is that connection's sweep. The start line names each, and you can strike one in the brief.
- **How far it goes**: the depths, as the six keys under `budgets` above.
- **How the result is laid out**: `readingTemplate`, a file counted from the estate root, such as `templates/reading.md`, whose headings lay out each run's part of the reading. The fact sheet's layout is fixed.
- **Where it lives**: `researchDir`, a folder counted from the map's folder, `research` unless set. Where the folder is on the disk under another case of its letters, such as `Research/`, `research new` refuses and says to name it as the disk has it.

## Research taken alone

The research skill is in the open skill format, so it can be installed by itself, with no plugin and none of the other steps. Shown on Claude Code with no plugin loaded: the skill was put into a project by the installer of loose skills from a copy of this repository, and the command was linked from that copy by npm.

```sh
npx skills add <a clone of context-central> --skill research -a claude-code
npm install -g <a clone of context-central>
```

The command can also come from the package each release carries from 0.21.0, a file npm installs, made at release with the types taken out: `npm install -g ./context-central-0.21.0.tgz`. It is attached to the release on GitHub and published to no registry. Either way it needs Node 22.18 or later, as the skill's `compatibility` line says.

Taken alone, the skill asks that it work as it does with the plugin, save for two things. It names no step at the end, and gives the next things to do in plain words, such as handing the folder to whoever plans the work. And it holds none of the plugin's agents: each kind of reading is to go to a subagent of the host, whose prompt holds the agent's brief from the skill's `references/` folder, whole. In the three runs of release 0.21.0 taken alone on Claude Code, each named no step, but one swept its connection and no prompt held a brief whole; [the changelog](../CHANGELOG.md) has each run.

Other hosts read the open skill format, and research has not been run on one. Its folder holds `agents/openai.yaml`, the file one such host reads to keep a skill to the person who types it.

## Where a host cannot hold it

- **A skill kept to the person.** Claude Code starts research only when you type it, as its head says. A host that reads `agents/openai.yaml` is told the same. A host that reads neither may start research of its own accord.
- **An agent kept to reading.** With the plugin on Claude Code, the web reader holds two tools that fetch and nothing else. The sweeper is denied the tools that write a file and still holds a shell and every tool of its server, those that post among them, and the reader holds a shell: only their briefs keep them from writing through the shell or posting. The fetcher names no tools, so it holds every tool of the session, and only its brief keeps it to saving the one text at the one path it is given. Taken alone, the skill asks for a subagent denied the tools made to write or edit a file, a shell apart, where the host has one, as Claude Code's Explore is, for the reader, the sweeper and the web reader, and not for the fetcher, which writes what it saves. Where only subagents that can write hold what one of those three needs, it takes one of them, and its prompt says it writes nothing: only the brief's words then keep it from writing.
- **A session that reads for itself.** Where no subagent holds what a kind of reading needs, the session reads it itself, so the raw text comes into its own context.

The skill asks research to write nothing outside the map but a hand-over's folder, to post nothing, and to record no tool of the session in the settings. As the bullets above say, only the agents' briefs keep them from posting.

## What the runs of 0.21.0 showed

The runs were made on Claude Code 2.1.332, left to run with nobody there, on throwaway estates whose connections were stand-ins: small servers made for the runs, which answer as a real one would and write down what they are asked.

- **With the plugin.** A new question went on past the estate's own skill, searched the chat by its own skill, gave each sweeper one connection, read the document a thread named in a later round and asked nothing, in 3 of 3; but no run did all the text asks, and two of the three stopped after their second round with a lead open, each writing that its spending allowance had run short, a stop the text does not name. Checks of whether a research still holds or a diff agrees, and rounds of more questions, each put the passed day to check again by in the first line of the reply, 3 of 3, and a round wrote a gap for what it could not reach in 1 of 3.
- **Taken alone.** With no plugin loaded, the three runs swept their one connection in 1 of 3, and the one that swept took a subagent that can write where Explore was on offer; the two that swept nothing read the item's ticket in the session, without its comments; and no prompt held a brief whole. So taken alone, research does less than the skill asks on this host.

[The changelog](../CHANGELOG.md) of 0.21.0 has each run, the misses beside the passes.
