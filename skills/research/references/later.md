# A research that is there

A research is added to, asked and checked, and never rewritten. Where the first word the person typed is the name of a research the map holds, the run is on that research. Every kind of run below keeps what `references/folder.md` rules: a fact's words and a saved source never change, a number is never used again, and what is new is a dated round at the end of the log.

## Which kind of run it is

What follows the name says which kind of run it is. Take the first of these that fits, and name it in the one line that says the way in:

1. **A run that was cut off**, whatever follows the name, where the `rounds:` line that `context-central research open` printed ends `not stopped`.
2. **Nothing follows the name.** Give where the research stands, from the lines the command printed, and say in plain words what can be asked of it. That is the whole reply: nothing more is run, and nothing is written.
3. **Handing it over**, where the person asks for the research to be handed over, copied out or given to someone.
4. **Does this agree**, where the person names a spec, a design, a diff, a branch or a pull request to hold against it.
5. **What a build learned**, where the person names a work item that was built and asks for what its build found.
6. **Does it still hold**, where the person asks whether the research, or a fact of it, still holds or is still right, or asks for the whole of it to be checked again. An ask to look again at a subject, and not at the research or one of its facts, is a question, below.
7. **A question**, for anything else. A part of it that the facts answer is answered from them, as a plain question is. A part they do not answer is a new question for the research, and a round is run for it.

## Where it stands

`context-central research open <name>` printed where the research stands, a line each. Three of its lines steer the run:

- `item:` names the work item the research belongs to, where it has one. That item's state file is read and written as step 4 of the skill has it.
- `rounds:` ends `not stopped` where the last run was cut off before it wrote the round that stops it.
- `check again by:` ends `passed <N> days ago` where the day on the sheet has gone by. Say so in the one line that says the way in, whatever kind the run is. A round that gathers, and the check of whether it still holds, write the day anew.

Then, but for a bare name and for a hand-over with no folder named, run `context-central resolve <name> --absolute`, which lists the fact sheet, its pages, the brief, the log, the reading and the set-aside list. Read the sheet, its pages and the brief, each at the path `context-central draft` prints for it. Where the research has an item, run `context-central resolve <item> --absolute` as well: it gives the places of the item's spec and design, which the choice of the next step reads.

A hand-over, a plain question and a bare name take none of the skill's numbered steps: each says here all that it does. Every other kind takes them so:

- Nothing of step 1: it makes no folder and adopts no item.
- Of step 2, what the kind says it gathers, and no more. A repo's own research skill is run for a round on more questions, and for no other kind.
- Step 3 as it is. Where the run names a work item that is not the research's own, as a check of that item's spec does, the next step is chosen for that item and said in the last line alone: no file of that item is written.
- Step 4 as it is. The link to the fact sheet is written only where it is not there yet, as it may not be where an earlier run was cut off.
- Step 5 as it is.

## More questions: a round on it

A part of what was asked that the facts answer is answered by fact number in the first thing the run says, before the brief is given. For the rest a round is run:

1. **The brief.** Turn that part into questions about what is so, as `references/run.md` has it, and add them under `## Questions` in the brief with the next numbers: the questions of a research are never numbered again from `Q1`. Add a line under `## Sources to cover` for each place this run will look that is not there yet, and strike none but one the person says to leave out. Under `## Depth` and under `## Start line`, add this run's lines below the earlier ones, after a line that holds the run's day alone, as `2026-11-29:`. The earlier lines stay, so that the brief goes on saying where each run looked. This run's start line is written from `context-central connections --json` and the session's tools, as `references/run.md` has it, with no line on git, which the first run wrote. Where it would hold no line, it is one line: that no connection is recorded and no tool of the session reaches one. Then agree the brief as a new research's is agreed: it is the one thing the run waits on, and with nobody there it waits on nothing.
2. **The rounds** go as `references/run.md` has them. Each is opened with `context-central take` and `context-central research open <name>`, so that a round's number, its first fact and its first saved source go on from the ones the folder holds. The first round of this run sweeps as the first round of any run does. An agent is handed the questions this run added, and not the ones an earlier run answered. The cap of the depth counts the rounds of this run, not the rounds the research has had.
3. **A fact that gains a source** keeps its words and its number: add a `- Source:` line under it, and the source to the sheet's list.
4. **A fact that no longer holds** is superseded in the round that found it so. Before a round is written, hold what it read against the facts that stand: one that a source read in this round shows to be otherwise no longer holds, whatever the round was asked. Write the fact that takes its place, with the next number and under it `- Supersedes F<n>, <YYYY-MM-DD>: <the reason>`. Move the older fact from the sheet, or from the page that held it, to that round's entry in the log, under `### Superseded`, word for word with every line under it. A source that only the older fact names stays in the sheet's list of sources. A fact whose `From` line names a fact that was superseded is judged too: where what it says no longer follows, it is superseded, and where it still follows, it stays as it is. Where the older fact answered a question, the round's `Answered` line names that question by the fact that took its place.
5. **The sheet and the reading.** The new questions go under `## Questions` on the sheet too. The last round of the run writes the day to check again by, in place of the one that was there. The run adds its own part at the end of the reading, which names the facts this run wrote or superseded and no fact that it left as it was. Nothing else that an earlier run wrote is changed.

## A run that was cut off

Where `rounds:` ends `not stopped`, an earlier run stopped before its end. Take it up where it stopped, before anything else is asked of the research. The brief stands as it was agreed and is not shown again. The run goes on at the depth the last lines under the brief's `## Depth` give, and its cap counts the rounds from here. The open leads are the ones in the `New leads` lines of the last round's entry, and the next round is opened as every round is. Where the person typed more after the name, the run that was cut off is taken up first, and what was typed is handled once it has stopped.

## A plain question about it

A question the facts answer is answered from the research's folder and from nothing else:

- Read the sheet and its pages, and the log for a number that is no longer on the sheet.
- Answer in a few lines, with no groups, and name the facts each line rests on by number, as `(F7, F8)`.
- A number the person names that the sheet no longer holds was superseded. Say so, with the fact that took its place, the day and the reason from that fact's `Supersedes` line, and the older words as the log keeps them.
- Gather nothing: no agent, no fetch, no sweep, and no read outside the research's folder. Write nothing: no round and no part of the reading. Run `context-central take` at the end, which clears the drafts that were only read.
- The last line is `Research: <the place of the fact sheet in the map>.` It names no step, since nothing new was found.

## Does it still hold

This check reads again the code that the facts cite, and ends in a round. It has no brief to agree and waits on nothing, with the person there as with nobody there. It sweeps nothing, and it checks the whole research, whichever fact was doubted.

1. Open the round as every round is opened, then run `context-central research moved <name>`. It compares every line of a repo that a standing fact cites, at the commit its own line names, with the head of that repo as it is checked out. It prints a line for each cited line that `has moved`, a line for each that `was not compared`, and a last line that counts the facts.
2. For each line that `has moved`, read the place again at the head: the file where it stands now, and what took its place where it is gone. Then judge the fact:
   - It still holds, and only its lines moved: write a fact with the older fact's own sentence and the place as it is at the head's commit, which supersedes the older one. Its reason is that the cited lines moved.
   - It no longer holds: write the fact that says what is so now, which supersedes it. Its reason is what changed.
3. A line that `was not compared` says why. Where it says `its line names no commit`, or that the repo `holds no such file at the commit`, the place was written in a form that cannot be compared: read it at the head, and where the fact holds, write a fact that supersedes it, with the place and its commit as `references/folder.md` has them. Every other reason goes in the closing answer under Not known, as the command gave it.
4. Facts that cite no line of a repo, such as one that rests on a saved thread or on a page, are not read again by this check. Where there are any, say how many, under Not known.
5. Write the round. Each fact is superseded as a round on a research supersedes one, above, and a fact whose `From` line names one of them is judged as there. The round's entry holds its heading, a `Checked` line and its `Stopped` line, as here, and under them `### Superseded` with the facts this round moved off the sheet, where there are any. It has no `Answered` line: which fact took the place of which is in its `Checked` line.

````
## Round 4, 2026-11-29

- Checked: whether it still holds | 2 of 9 facts that cite a line of a repo had moved | F12 supersedes F7, F13 supersedes F4
- Stopped: the check was done
````

The middle part of the `Checked` line gives the counts of the command's last line, and where nothing had moved it reads `none of 9 facts that cite a line of a repo had moved`, with `none superseded` as the last part. The entry is written all the same: that the check ran on that day is what it is for.

The round also writes the day to check again by on the sheet, in place of the one that was there, and the run's part of the reading. That part opens with what was checked, in place of the questions, and what was found, in a few lines. A fact that no longer holds is a point under Yours to decide: whether what was planned on the older fact needs another look, with yes as the answer recommended wherever a spec or a design rests on it. The facts that hold, moved or not, are one point under Fine as it is.

## Does this agree

Given a spec, a design or a diff, this check says where it and the research part ways. It rewrites nothing: no fact is written, changed or superseded, whatever is found. It has no brief to agree, waits on nothing and sweeps nothing.

1. Open the round as every round is opened.
2. Read what was named:
   - A spec or a design of a work item is a file of the map. Run `context-central resolve <item> --absolute` for its place, and read it at the path `context-central draft` prints.
   - A diff is asked of git, as `git -C <the repo's folder> diff <base branch>...HEAD`, with the base branch that `context-central config --get repos` gives for that repo. Where the person named a branch, it stands in place of `HEAD`, and where they named two commits, those stand on either side. A pull request is read as step 2 of the skill reads one.
   - Where it is long, the reading goes to the `context-central:reader` agent, as step 2 of the skill has it. Hand it the paths of the sheet and its pages, what to read, and the three lists below to return, each thing with the place it was found at.
3. List three things, each by its place in what was read, as the path `resolve` or git gave and a line, and the first two by fact number:
   - **The facts it goes against**: it says that something is so today, in a sentence of a spec, a design, a page or a comment, and a fact that stands says otherwise.
   - **The facts it puts out of date**: it changes what a fact describes, so that the fact holds today and would no longer hold once this is built or merged. Code that a diff changes, and what a spec or a design asks to have built, belong here.
   - **What it rests on that no fact covers**: something it takes to be so that no fact on the sheet says.
4. Write the round. Its entry holds its heading, a `Checked` line and its `Stopped` line, as here, and the fact sheet is not changed.

````
## Round 5, 2026-11-29

- Checked: whether the spec of PROJ-12 agrees | it goes against F7 | it puts F9 and F10 out of date | it rests on 2 things no fact covers
- Stopped: the check was done
````

The first part of the `Checked` line names what was checked: `the spec of PROJ-12`, `the design of PROJ-12`, or a diff by its repo and what was compared, as `the diff of api, main...work/plus-limit`. A part with nothing to name reads `it goes against none`, `it puts none out of date` or `it rests on nothing no fact covers`.

The run's part of the reading opens with what was checked, in place of the questions, and what was found, in a few lines. Its points name the place in what was read beside the fact: what it goes against under Needs a fix, what it puts out of date under Yours to decide, the facts it leaves as they are in one point under Fine as it is, and what no fact covers under Not known. This check does not read the facts again: where the day to check again by has passed, say under Not known that the facts were not checked first.

The next step is chosen as step 3 of the skill has it where what was checked is the spec or the design of a work item, for that item. For a diff it is none, and the last line says in plain words what the lists ask for.

## What a build learned

No step that comes after research writes into a research's folder. What a build found out comes back in a round the person starts, by naming the research and the work item that was built. That round reads what the build left where it lies. It sweeps nothing, waits on nothing and is one round: a lead it leaves open is listed under Not known.

1. Run `context-central resolve <item> --absolute`, and read the item's state file, the note of its review where it has one, and its saved pull request, each at the path `context-central draft` prints. What is long goes to the reader, as step 2 of the skill has it.
2. Add one question to the brief and to the sheet, with the next number: what the build found that the facts do not say, or that goes against them.
3. Open the round. Save a copy of each note the round rests on, the state file and the note of the review among them, as it stands that day, among the research's sources: read the note, and write it word for word at the path `context-central draft research/<name>/sources/<NN>-<YYYY-MM-DD>-note-<what>-full-text.md` prints. Its kind in the list of sources is `note`. A note of the map is rewritten later, and the copy is what a fact goes on resting on: it is a saved source, kept as it came, whatever it names. The item's saved pull request is a saved source already: where the item is the research's own, link it by its path from the sheet's folder. Otherwise save a copy of it the same way, with `pr` in place of `note` in its name, and `pull-requests` as its kind.
4. What a note says of the code is a lead: read the code, and cite the code. Cite it by its line at the commit the build reached: the one the item's state file names, or the one `git -C <the repo's folder> rev-parse --short <the branch>` prints for the branch it names. Where that commit is not the one checked out, read a file as it was there with `git -C <the repo's folder> show <commit>:<path>`. What only a note holds, such as what a review found and how it was answered, is a fact with the copy as its source.
5. Write the facts, supersede the ones the build showed wrong, and write the round, the sheet's day and the reading, as a round on a research does. A fact is superseded only by what holds at the head that is checked out: what holds on a branch that is not merged yet is a fact of its own, which names the branch. The round's entry is one of the usual form, and its `Stopped` line reads `what the build left was read`.

## Handing it over

`context-central research handover <name> <folder>` copies the research into a folder that stands by itself, to attach to a feature or to give to another planner. The folder lies outside the map, and is not there yet or is empty. The copy holds the sheet, its pages, the brief, the log, the set-aside list and the saved sources, with each file of the item's own `sources/` that the research links copied in.

- Where the person named no folder, pick none: say that a folder is needed, and stop, before anything more is run. That is the whole reply.
- The reading is one person's judgement and is left out, unless the person asks for it: then the command is `context-central research handover <name> <folder> --reading`.
- The person may name kinds of source to leave out, such as mail or chat, which hold other people's messages: add `--without <kind>` for each, as `context-central research handover <name> <folder> --without mail --without chat`. A kind is passed as the person named it, whether or not the sheet's list of sources holds it, and none is left out that the person did not name.
- Run `context-central take` first, since the command reads the map. The command writes nothing unless the whole copy can be made. Where its answer opens `handed over research`, give that line and each line under it: one that opens `left out:` for each kind, and one that ends `only on sources left out` for the facts that name no source in the copy. Any other answer is a refusal, such as one that opens `nothing was handed over`: say it as it was printed, with what would mend it, and mend nothing unasked.
- A hand-over writes nothing in the map: no round and no reading. Its reply is one line that says what was handed over and where, then what the command printed, then, where sources of other people's messages went into the copy, which kinds. Its last line is `Research: <the place of the fact sheet in the map>.`

The place of the fact sheet in the map is `research/<name>/index.md`, with the estate's own folder for researches in place of `research` where the path `resolve` printed shows another.
