# A run

A run is one start of this skill on one research. It writes the research brief and says what it goes with, gathers in rounds, writes each round into the research's folder before the next, and stops by a test it names. The brief is the one thing a run waits on: after it, the run puts no question to the person, and what it cannot settle is a gap or goes under Not known.

## Nobody there

Nobody is there where what the person typed says so, such as "nobody is here", "leave it to run" or "do not wait for me", or where the host gives this run no way to ask the person anything. Then the run asks nothing and waits on nothing:

- The brief is taken as written: it is written and taken into the map as below, shown to nobody, and the gathering starts in the same turn.
- Each thing the run would have put to the person goes under Not known in the closing answer, with what would settle it, and the run goes on without it.
- With no depth typed the depth is deep.
- It does not stop at its answers, as the stops below have it.
- One thing is never done unasked: a map is not made. Where no map covers the folder and what the person typed does not say yes to one, the run writes nothing and answers nothing from the code: its reply is the lines `context-central init --plain --dry-run` printed and the command that makes that map, `context-central init --plain`, and it stops there.

## The brief

Write the brief before anything is gathered, in `brief.md`, at the path `context-central draft` prints for it:

- **Questions.** Turn what the person typed into questions about what is so, numbered `Q1` on. A wish, such as something to build or to change, is no question: ask what it rests on, such as how the thing works today and what is decided already. A question may name what the wish is about, such as a plan or a file, where it asks what is so of it. What a build would have to fit is asked the same way, as what is so today of the thing it would touch. The wish itself, what is wanted and that it is wanted, is written under none of the brief's headings.
- **Sources to cover.** Where the run will look, a line each: every connection by its name, each tool of the session that the map does not record and that reaches a kind of source the questions could need, each repo the run will read, each page or kind of page. This is the person's say over where a run looks: they strike a line or add one.
- **Depth.** One of quick, standard and deep: the one the person typed, and with none typed standard with the person waiting and deep with nobody there. Each depth caps the rounds of one run and the agents started at once, and the estate sets the numbers:

  | Depth | Rounds | Agents at once |
  |---|---|---|
  | quick | `context-central config --get budgets.researchQuickRounds` | `context-central config --get budgets.researchQuickAgents` |
  | standard | `context-central config --get budgets.researchStandardRounds` | `context-central config --get budgets.researchStandardAgents` |
  | deep | `context-central config --get budgets.researchDeepRounds` | `context-central config --get budgets.researchDeepAgents` |

  Run the two commands of the depth and write the word with both numbers, as `deep: at most 6 rounds, and 5 agents at once`, with `round` or `agent` where the number is 1.
- **Out of scope.** What the person said to leave out, a line each, or `none`.
- **Start line.** What the run goes with, as below.

**The start line.** Run `context-central connections --json`. Write a line for each connection: its name, what it `holds`, how this machine reaches it, which is its `by`, and how it is searched, which is the `by` of its `search`:

- `server`: through the server named there. Whether that server has a tool that searches is known once its sweep has looked: where it has none, the connection is read by name only, and its line of the start line is changed to say so.
- `command`: with the estate's own command for `search`, in the entry's `commands`.
- `name`: nothing searches it, so the run reads from it only what it can name.

Then, where there are any, a line for each of these:

- A tool this session holds that reaches a system no connection's entry names, such as a server or a connector of the person's own. The run uses it as it uses a connection, under the server's own name, and records nothing in the settings: the line says how the person records it, as an entry under `connections` in the estate's settings with what it `holds` and its `server`. An agent is handed an entry made for it, `{ "holds": "<what it reaches>", "server": "<the server's name>" }`, and is told that the estate does not record it, and a source read through it has what it reaches as its kind.
- A kind of source the questions need that nothing reaches, such as chat, mail, documents or meetings. Each is a gap: it is said here, and written in the first round as the gaps below are.
- What `research new` answered as `git`: for `kept`, that the map is kept in git and this folder goes into it with every source it saves, and for `ignored`, that git ignores the folder, so the research stays on this machine. Where it answered neither, git does not hold the map, and the start line says nothing of it.

**Agreeing it.** Run `context-central take`, then give the person the brief, whole, with its start line, and end the turn there. Anything the run needs from the person is asked here and nowhere later: which of two connections holds a ticket, a text only they can paste. Their yes starts the gathering. A reply that changes the brief is a yes to the brief as changed: write the change in, take it, and start, without showing it again. A source they say to leave out is struck from Sources to cover and written under Out of scope, and its line of the start line says that the person left it out. With nobody there the brief is taken as written.

## Rounds

The first round is wide, and each round after it goes after what the round before left open. Where a repo names a skill of the estate's own for research, that one is run once the brief is agreed and before the first round is opened, as step 2 of this skill has it. A round is opened, gathered and written, in that order, and the next is not opened until it is written:

1. **Open the round.** Run `context-central take`, then `context-central research open <name>`. Its `rounds:` line gives the last round the folder holds: this round is one more, or 1 where it says `none`. Its `facts:` and `sources:` lines give the numbers this round's first fact and first saved source take, and its `dates:` line the day, as the one it gives for today. Where the `rounds:` line does not give the round that was last gathered, that round is not in the folder: write it and take it before anything else is done.
2. **Sweep.** In the first round, sweep every connection the brief covers that is searched by `server` or by `command`, and every tool of the session it covers, as below. All of them are swept in that round, however many there are: the cap on agents says how many run at one time, never how many sweeps a round has. In a later round, sweep only where an open lead calls for a search.
3. **Take each lead.** A lead is read in full, the way step 2 of the skill reads its kind, or it is set aside with its reason on the set-aside list. None is dropped, and nothing is drawn from a lead's line in a search result alone. A line the person moved under `## Bring in` is read, and nothing under `## Set aside` is used.
4. **Read** the code, the saved sources and the pages the questions need.
5. **Write the round** into the folder: the new facts on the fact sheet, with each source in its list, and the round's own entry at the end of the log, then `context-central take`. The first round also writes the sheet's questions, as the brief has them, and the last its day to check again by. Until the round is written and taken, nothing of the next round is started: no agent, no fetch and no read of a lead this round left open. A run that is cut off then leaves every round it finished, which is what the entry is for.

What a source read in a round points at, in a connection or on the web, is not read in that round. It goes in the entry's `New leads`, and those are the open leads the next round takes. Code is not held to this: a round reads the code its questions need, wherever one file leads. A lead into a system nothing reaches is no open lead: it is a gap.

No more agents are started at once than the depth allows: where there is more to hand out, the rest wait for one to come back.

## The sweep

A sweep is a search of one connection for leads on the brief's questions. It goes to the `context-central:sweeper` agent: one sweeper for each connection, and one connection for each sweeper. Where the session holds that agent, the sweep is the agent's to make, and the session does not search a connection itself. Where the session holds no such agent, hand the brief in `references/sweeper.md` to a subagent the host has, and with none, do what that brief says in the session. Give it the brief's questions, the connection's name, its entry, which `context-central connections --json` gives as `entry`, and how it is searched. It returns leads, one a line, and what it could not reach, and it saves nothing. A sweeper that finds no tool that searches says so: the connection is then read by name only, which is no gap.

A connection searched by `name` is not swept. The start line says so, and the run reads from it only what a source or the person names.

## What an agent is handed

Every agent that gathers, the reader, the fetcher, the sweeper and the web reader, is handed the brief's questions as they are written there, with what to read or where to look, and nothing of what the person wants built or changed. This holds however the question was typed: the wish stays out of every prompt.

A page on the web is read by the `context-central:web-reader` agent, whose tools cannot write: give it the questions and the addresses, or what to look for. Where the session holds no such agent, hand the brief in `references/web-reader.md` to a subagent the host has, and with none, read the page in the session.

## The stops

A question is answered once a fact on the sheet answers it. When a round's reading is done, before its entry is written, try these in this order. The run stops at the first that holds, and the entry of that round carries it as its `Stopped` line:

- `every question is answered`: with the person waiting only.
- `a round added no fact and no lead`, or `no lead is open, so another round would add no fact and no lead`.
- `the cap of the depth was reached`, then a colon and the rounds it allows, as `the cap of the depth was reached: 3 rounds`, or `1 round`.

Left alone, with nobody there, a run does not stop at its answers. While a lead is open it runs another round, to read that lead or set it aside, and it stops when a round added no fact and no lead or left no lead open. The cap is kept as a valve: it stops a run left alone as it stops any other.

A lead still open when a run stops is not lost. It stays in the last round's `New leads`, and the closing answer lists it under Not known, as what was left unread and why.

## Gaps

A gap is something the questions needed and the run could not reach. It is written when it is met, in the `Gaps` line of the round and under `## Not reached` on the fact sheet, as what was wanted, what pointed at it and how to connect it, in plain words. One met at the brief is written in the first round. The sheet holds one line for one thing: where a later source points at the same thing, its line is not written twice. What is out of reach and beside the point is set aside, under the name the source gives it. Each of these is a gap:

- A lead into a system that nothing reaches.
- A connection that failed, gave nothing or was cut short.
- A kind of source in the brief, or a term of the estate's glossary, with nothing behind it that reaches it: no connection and no tool of the session.
- A ticket or a pull request that more than one connection could hold, where neither the brief nor a sweep says which.
- A text that only the person could paste, and did not.

The closing answer lists what was not reached, under Not known.

## The set-aside list

The run sorts and never drops. What it judges beside the point goes on the set-aside list, `set-aside.md`, under `## Set aside`, with its address or its saved file and one line of reason, and in the `Set aside` line of the round. The person moves an entry under `## Bring in` to have it read, or back, and a later round keeps to where each entry is. An entry under `## Bring in` that nothing reaches is a gap.
