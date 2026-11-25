# A run

A run is one start of this skill on one research. It writes the research brief and says what it goes with, gathers in rounds, writes each round into the research's folder before the next, and stops by a test it names. The brief is the one thing a run waits on: after it, the run puts no question to the person, and what it cannot settle is a gap or goes under Not known.

## Nobody there

Nobody is there where what the person typed says so, such as "nobody is here", "leave it to run" or "do not wait for me", or where the host gives this run no way to ask the person anything. Then the run asks nothing and waits on nothing:

- The brief is taken as written: it is written and taken into the map as below, shown to nobody, and the gathering starts in the same turn.
- Each thing the run would have put to the person goes under Not known in the closing answer, with what would settle it, and the run goes on without it.
- With no depth typed the depth is deep.
- It does not stop at its answers, as the stops below have it.
- One thing is never done unasked: a map is not made, and where no map covers the folder the run ends as step 1 of this skill has it.

## The brief

Write the brief before anything is gathered, in `brief.md`, at the path `context-central draft` prints for it:

- **Questions.** Turn what the person typed into questions about what is so, numbered `Q1` on. A wish, such as something to build or to change, is no question: ask what it rests on, such as how the thing works today and what is decided already. A question may name what the wish is about, such as a plan or a file, where it asks what is so of it. What a build would have to fit is asked the same way, as what is so today of the thing it would touch. The wish itself, what is wanted and that it is wanted, is written under none of the brief's headings.
- **Sources to cover.** Where the run will look, a line each: every connection by its name, each tool of the session that the map does not record and that reaches a kind of source the questions could need, each repo the run will read, each page or kind of page. This is the person's say over where a run looks: they strike a line or add one.
- **Depth.** One of quick, standard and deep: the one the person typed, and with none typed standard with the person waiting and deep with nobody there. Each depth caps the rounds of one run and the agents started at once, and the estate sets the numbers:

  | Depth | Rounds | Agents at once | The plugin's own |
  |---|---|---|---|
  | quick | `context-central config --get budgets.researchQuickRounds` | `context-central config --get budgets.researchQuickAgents` | 1 and 2 |
  | standard | `context-central config --get budgets.researchStandardRounds` | `context-central config --get budgets.researchStandardAgents` | 3 and 3 |
  | deep | `context-central config --get budgets.researchDeepRounds` | `context-central config --get budgets.researchDeepAgents` | 6 and 5 |

  Run the two commands of the depth, each as a line of its own, and write the word with both numbers, as `deep: at most 6 rounds, and 5 agents at once`, with `round` or `agent` where the number is 1. A budget is never absent: each command prints the estate's number, or the plugin's own where the estate sets none. A cap is a whole number of 1 or more. Where a command prints anything else, such as `0`, `2.5`, a word or `null`, the estate holds what a run cannot use: go by the plugin's own number for that cap, from the last column of the table, say so on the same line, after the numbers, as `(budgets.researchQuickAgents holds 0, which is no cap: the plugin's own 2 is used)`, and name the key in the closing answer, under Needs a fix.
- **Out of scope.** What the person said to leave out, a line each, or `none`.
- **Start line.** What the run goes with, as below.

**The start line.** Run `context-central connections --json`. Write a line for each connection it gives: its name, what it `holds`, how this machine reaches it and how it is searched. One that carries `unasked` is a connection the map does not record: on a map made before connections a preset applies it unasked, a ticket or a pull request can be read through it, and its line says that the map does not record it.

How this machine reaches a connection is its `by`:

- `fetch`: the plugin's own fetch reads a ticket or a pull request from it here.
- `server`, `command` or `route`: a session reads it the way its entry says, by its `server`, its `commands` or its `route`. The fetcher is handed that entry.
- `hand`: neither the plugin nor a server, a command or a route reaches it here. Where `missing` names a program, that program is what this machine lacks. Where its entry holds a `how`, those words say how it is read: a fetcher handed the entry follows them where a session can do what they say, and where only a person can, nothing here reads it, and its line says so. What the questions need from it and nothing gets is a gap, unless the person gives its text.

How it is searched is the `by` of its `search`:

- `server`: through the server named there. Whether that server has a tool that searches is known once its sweep has looked. A sweep that found no tool of the server at all is first handed on, as `references/agents.md` has it. Where no agent and not the session holds its tools once it is handed on, the connection is not swept and is a gap, as `references/agents.md` has it. Where its tools hold none that searches, the connection is read by name only, and its line of the start line is changed to say so, a change that is taken with the round. That records what the sweep found and changes nothing that was agreed: the brief is not shown again, and the closing answer says under Not known that the connection could not be searched.
- `command`: with the estate's own command for `search`, in the entry's `commands`.
- `name`: nothing searches it, so the run reads from it only what it can name.
- `skill`: through a skill of the estate's own for searching that one connection, which its `skill` names. The run sweeps the connection with that skill, as `references/agents.md` has it, and its line names the skill.

Then, where there are any, a line for each of these:

- A tool this session holds that reaches a system no connection's entry names, such as a server or a connector of the person's own. The run uses it as it uses a connection, under the server's own name, and records nothing in the settings: the line says how the person records it, as an entry under `connections` in the estate's settings with what it `holds` and its `server`. An agent is handed an entry made for it, `{ "holds": "<what it reaches>", "server": "<the server's name>" }`, and is told that the estate does not record it, and a source read through it has what it reaches as its kind.
- A kind of source the questions need that nothing reaches, such as chat, mail, documents or meetings. Each is a gap: it is said here, and written in the first round as the gaps below are.
- Each skill of the estate's own for research that the run will start, by its name: the estate's, where `context-central config --get researchSkill` prints one, and a repo's, where `context-central standards <repo>` prints one, run for the repos step 2 of this skill names. The line says that the run starts it once the brief is agreed, as `references/agents.md` has it.
- What `research new` answered as `git`: for `kept`, that the map is kept in git and this folder goes into it with every source it saves, and for `ignored`, that git ignores the folder, so the research stays on this machine. Where it answered neither, git does not hold the map, and the start line says nothing of it.

**Agreeing it.** Run `context-central take`. With nobody there the brief is taken as written: it is shown to nobody, no turn ends, and the run goes straight on. With the person there, give them the brief, whole, with its start line, and end the turn there. Anything the run needs from the person is asked here and nowhere later: which of two connections holds a ticket, a text only they can paste. Their yes starts the gathering. A reply that changes the brief is a yes to the brief as changed: write the change in, take it, and start, without showing it again. A source they say to leave out is struck from Sources to cover and written under Out of scope, and its line of the start line says that the person left it out. A skill of the estate's own they say not to start, or a repo's skill whose repo they strike, is written under Out of scope the same way and is not started. A repo they add is looked up with `context-central standards <repo>`, as step 2 of this skill has it, and its skill is added to the start line.

## Rounds

The first round is wide, and each round after it goes after what the round before left open. The estate's own skills for research are started as `references/agents.md` has it: one for a repo or for the estate as a whole once the brief is agreed and before the first round is opened, and one for a connection as its sweep. A round is opened, gathered and written, in that order, and the next is not opened until it is written:

1. **Open the round.** Run `context-central take`, then `context-central research open <name>`. Its `rounds:` line gives the last round the folder holds: this round is one more, or 1 where it says `none`. Its `facts:` and `sources:` lines give the numbers this round's first fact and first saved source take, and its `dates:` line the day, as the one it gives for today. Where the `rounds:` line does not give the round that was last gathered, that round is not in the folder: write it and take it before anything else is done.
2. **Sweep.** In the first round, sweep every connection the start line names that is searched by `server`, by `command` or by `skill`, and every tool of the session it names, but one the person struck, as `references/agents.md` has the sweep. All of them are swept in that round, at every depth, however many there are, and whatever the code or the map seems to answer already: no connection is left unswept because the run judged it not needed. The cap on agents says how many run at one time, never how many sweeps a round has. Each sweep is of one connection, by a sweeper of its own or by the connection's skill. The skill runs in the session and the cap does not count it; where there are more sweepers than the cap lets run at once, the rest wait for one to come back, and no sweeper is handed a second connection. In a later round, sweep only where an open lead calls for a search.
3. **Take each lead.** A lead is read in full, the way step 2 of the skill reads its kind, or it is set aside with its reason on the set-aside list, as `references/folder.md` has it. None is dropped, and nothing is drawn from a lead's line in a search result alone. A thing in a connection or on the web that a source read in a round names, such as a document a thread points to, is a lead of the next round, as below: there it is read in full where a connection or the web reader can read it, and is a gap where nothing can. It is never set aside unread, whatever it seems to hold. No lead is set aside because the code or the map seems to answer its question already. A lead that an agent hands back unread is a gap, written as Gaps has it, save where the agent said it held no tool of the connection's server: `references/agents.md` passes that work on. Where the fetcher stopped for a reference, the reference is not changed to get it through, and the session does not run the connection's command itself.
4. **Read** the code, the saved sources and the pages the questions need.
5. **Write the round** into the folder: the new facts on the fact sheet, with each source in its list, and the round's own entry at the end of the log, then `context-central take`. The first round also writes the sheet's questions, as the brief has them, and the last its day to check again by. Until the round is written and taken, nothing of the next round is started: no agent, no fetch and no read of a lead this round left open. A run that is cut off then leaves every round it finished, which is what the entry is for.

What a source read in a round points at, in a connection or on the web, is not read in that round. It goes in the entry's `New leads`, and those are the open leads the next round takes. Code is not held to this: a round reads the code its questions need, wherever one file leads. A lead into a system nothing reaches is no open lead: it is a gap.

No more agents are started at once than the depth allows: where there is more to hand out, the rest wait for one to come back. A run may end its turn to wait for an agent to come back: that is no stop and no reply, its message names only the agents it waits on, and the run goes on in the turn the agent's return starts.

## The stops

A question is answered once a fact on the sheet answers it. A fact that carries `disputed` answers none: its question stays open. When a round's reading is done, before its entry is written, try these in this order. The run stops at the first that holds, and the entry of that round carries it as its `Stopped` line:

- `every question is answered`: with the person waiting only.
- `a round added no fact and no lead`, or `no lead is open, so another round would add no fact and no lead`.
- `the cap of the depth was reached`, then a colon and the rounds it allows, as `the cap of the depth was reached: 3 rounds`, or `1 round`.

Left alone, with nobody there, a run does not stop at its answers. While a lead is open it runs another round, to read that lead or set it aside, and it stops when a round added no fact and no lead or left no lead open. The cap is kept as a valve: it stops a run left alone as it stops any other.

A lead still open when a run stops is not lost. It stays in the last round's `New leads`, and the closing answer lists it under Not known, as what was left unread and why.

## Gaps

A gap is something the questions needed and the run could not reach. It is written when it is met, in the `Gaps` line of the round and under `## Not reached` on the fact sheet, as what was wanted, what pointed at it and how to connect it, in plain words. One met at the brief is written in the first round. The sheet holds one line for one thing: where a later source points at the same thing, its line is not written twice. What is out of reach and beside the point is set aside, under the name the source gives it. Each of these is a gap:

- A lead into a system that nothing reaches.
- A connection that failed or was cut short, or whose sweep ran and gave nothing.
- A lead that an agent handed back unread: a reference the fetcher stopped for and ran nothing, or a thing an agent could not read and no other agent nor the session could either, where `references/agents.md` passes it on. What pointed at it is the source or the sweep that gave the lead, and how to connect it is what the agent said stood in the way.
- A connection that nothing on this machine reaches, where the questions need something from it: the question, by its number, is what pointed at it.
- A kind of source in the brief, or a term of the estate's glossary, with nothing behind it that reaches it: no connection and no tool of the session. `context-central where` prints the place of the glossary, which is a file of the map.
- A ticket or a pull request that more than one connection could hold, where neither the brief nor a sweep says which.
- A text that only the person could paste, and did not.

The closing answer lists what was not reached, under Not known.
