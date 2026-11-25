# The checks of a research, and what a build learned

Three kinds of run on a research that is there, each one round. `references/later.md` says which kind a run is, where the research stands, how its files are found and drafted, and which of the skill's steps each kind takes: it is read before this file. Where the last run was cut off, it is taken up before any of the three, as that file has it.

## Does it still hold

This check reads again the code that the facts cite, and ends in a round. It has no brief to agree and waits on nothing, with the person there as with nobody there. It sweeps nothing, and it checks every fact that cites a line of a repo, whichever fact was doubted.

1. Open the round as every round is opened, with `context-central take` and `context-central research open <name>`, and draft again each file this round reads or writes. Then run `context-central research moved <name>`. It compares every line of a repo that a standing fact cites, at the commit its own line names, with the head of that repo as it is checked out. It prints a line for each cited line that `has moved`, a line for each that `was not compared`, and a last line that counts the facts.
2. For each line that `has moved`, read the place again at the head: the file where it stands now, and what took its place where it is gone. Then judge the fact:
   - It still holds, and only its lines moved: write a fact with the older fact's own sentence, which supersedes the older one. Under it goes the place as it is at the head's commit, in place of the `Source` line that moved, and then every other `Source` line of the older fact as it was written, so that the new fact names every source that says it. The place is the lines that the same code stands on now, which are seldom the lines it stood on. Its mark is the one a fact earns by being read in its source in this run, as its place was, and its reason is that the cited lines moved.
   - It no longer holds: write the fact that says what is so now, which supersedes it, with every source read in this round that says so. Its reason is what changed.
3. A line that `was not compared` says why. Where it says `its line names no commit`, or that the repo `holds no such file at the commit`, the place was written in a form that cannot be compared: read it at the head, and where the fact holds, write a fact that supersedes it, with the place and its commit as `references/folder.md` has them and the older fact's other `Source` lines as they were. Every other reason goes in the closing answer under Not known, as the command gave it.
4. Facts that cite no line of a repo, such as one that rests on a saved thread or on a page, are not read again by this check. Where there are any, say how many, under Not known.
5. Write the round. Each fact is superseded as `references/later.md` has a round on more questions supersede one, and a fact whose `From` line names one of them is judged as there. The round's entry holds its heading, a `Checked` line and its `Stopped` line, as here, and under them `### Superseded` with the facts this round moved off the sheet, where there are any. It has no `Answered` line: which fact took the place of which is in its `Checked` line.

````
## Round 4, 2026-11-29

- Checked: whether it still holds | 2 of 9 facts that cite a line of a repo had moved | F12 supersedes F7, F13 supersedes F4
- Stopped: the check was done
````

The middle part of the `Checked` line follows the last line the command printed, which has one of four openings:

- `2 of 9 facts that cite a line of a repo have moved`, or `1 of 9` with `has moved`: the middle part is `2 of 9 facts that cite a line of a repo had moved`, as above, or `1 of 9`.
- `None of 9 facts that cite a line of a repo has moved`: it is `none of 9 facts that cite a line of a repo had moved`.
- `The one fact that cites a line of a repo has moved`, or `has not moved`: it is `the one fact that cites a line of a repo had moved`, or `had not moved`.
- `No fact of <name> cites a line of a repo.`: it is `no fact cites a line of a repo`.

Where nothing was superseded, the last part of the `Checked` line is `none superseded`. The entry is written all the same: that the check ran on that day is what it is for.

Where the command compared a fact, the round also writes the day to check again by on the sheet, in place of the one that was there. The day is chosen as `references/folder.md` has it, with a fact that had moved counting as what moves, and its reason says how many facts were not read again, where there are any. Where no fact cites a line of a repo, the check read nothing: its entry is written, the day stays as it is, and the closing answer says under Not known that nothing was read again. The round writes the run's part of the reading too. That part opens with what was checked, in place of the questions, and what was found, in a few lines. A fact that no longer holds is a point under Needs a fix: what was planned or built on the older fact rests on something that is no longer so. Where the spec or the design of the research's item says what the older fact said, the point names that place and recommends that it be brought to the fact that took the older one's place. Where the run knows of nothing that rests on it, the point says so, and recommends that whoever planned on the older fact looks again. The facts that hold, moved or not, are one point under Fine as it is.

## Does this agree

Given a spec, a design or a diff, this check says where it and the research part ways. It rewrites nothing: no fact is written, changed or superseded, whatever is found. It has no brief to agree, waits on nothing and sweeps nothing.

1. Open the round as every round is opened, with `context-central take` and `context-central research open <name>`, and draft again each file this round reads or writes.
2. Read what was named:
   - A spec or a design of a work item is a file of the map. Run `context-central resolve <item> --absolute` for its place, and read it at the path `context-central draft` prints.
   - A diff is asked of git, as `git -C <the repo's folder> diff <base branch>...HEAD`, with the base branch that `context-central config --get repos` gives for that repo, as its `baseBranch`. Where the person named a branch, it stands in place of `HEAD`, and where they named two branches or two commits, those stand on either side. A pull request is read as step 2 of the skill reads one.
   - Where the person named no base and that repo's entry has no `baseBranch`, or the map does not register the repo, the base is the branch the repo's remote calls its own, which `git -C <the repo's folder> symbolic-ref --short refs/remotes/origin/HEAD` prints as `origin/<branch>`. It is used as it is printed. Where that fails too, nothing is compared, with the person there as with nobody there: no round and no part of the reading is written, `context-central take` clears the drafts that were only read, and the closing answer says under Not known that no base branch is known for that repo, and that a base branch named in what is typed, beside the branch to check, or `baseBranch` in the repo's entry of the map's settings, settles it.
   - Name the commit the branch stood at in the opening lines of the run's part of the reading, so that the diff can be found again once the branch has moved on: `git -C <the repo's folder> rev-parse --short <the branch>` prints it. That command takes one name: given two it prints `fatal: Needed a single revision`. A diff written with three dots starts where the branch left its base, not at the base's own last commit, and `git -C <the repo's folder> merge-base <base branch> <the branch>` prints that commit.
   - A diff's length is what `git -C <the repo's folder> diff --shortstat <base branch>...<the branch>` prints, with nothing of the diff itself. Where what was named is more than the session would read in one go, the reading goes to the `context-central:reader` agent, as step 2 of the skill has bulk reading. Hand it the paths that `context-central draft` printed for the sheet and its pages, what to read, which for a diff is the repo's folder and the diff's command for it to run, and the three lists below to return, each thing with the place it was found at.
3. List three things, each by its place in what was read, as the path `resolve` or git gave and a line, and the first two by fact number:
   - **The facts it goes against**: it says that something is so today, in a sentence of a spec, a design, a page or a comment, and a fact that stands says otherwise. A sentence that a diff itself adds, such as a line of its README, is held to the code as the diff leaves it, whether or not the diff changes that line. Where that code does what the sentence says, the sentence is listed beside that code, in whichever list the code is in. Where it does not, the sentence is listed with the place in the code that does otherwise: among the facts it goes against where a fact that stands says what the sentence denies, and otherwise under what it rests on that no fact covers.
   - **The facts it puts out of date**: it changes what a fact describes, so that the fact holds today and would no longer hold once this is built or merged. Code that a diff changes, and what a spec or a design asks to have built, belong here.
   - **What it rests on that no fact covers**: something it takes to be so that no fact on the sheet says. Something it adds that no fact speaks of, such as a new route, is listed here too where it bears on a question of the research, and in no list where it bears on none.
4. Write the round. Its entry holds its heading, a `Checked` line and its `Stopped` line, as here, and the fact sheet is not changed.

````
## Round 5, 2026-11-29

- Checked: whether the spec of PROJ-12 agrees | it goes against F7 | it puts F9 and F10 out of date | it rests on 2 things no fact covers
- Stopped: the check was done
````

The first part of the `Checked` line names what was checked, between `whether` and `agrees`: `whether the spec of PROJ-12 agrees`, `whether the design of PROJ-12 agrees`, or for a diff its repo and what was compared, as `whether the diff of api, main...work/plus-limit agrees`. A part with nothing to name reads `it goes against none`, `it puts none out of date` or `it rests on nothing no fact covers`. One thing reads `it rests on 1 thing no fact covers`.

The run's part of the reading opens with what was checked, in place of the questions, and what was found, in a few lines. Its points name the place in what was read beside the fact: what it goes against under Needs a fix, what it puts out of date under Yours to decide, the facts it leaves as they are in one point under Fine as it is, and what no fact covers under Not known. This check does not read the facts again: where the day to check again by has passed, say under Not known that the facts were not checked first. Where something was compared, the reply's first line says first no where it goes against a fact, with those facts by number, and yes otherwise, names the facts it puts out of date or says it puts none out of date, and then, where the day to check again by has passed, says that it has.

The next step is chosen as step 3 of the skill has it where what was checked is the spec or the design of a work item, for that item. For a diff it is none, and the last line says in plain words what the lists ask for.

## What a build learned

No step that comes after research writes into a research's folder. What a build found out comes back in a round the person starts, by naming the research and the work item that was built. That round reads what the build left where it lies. It sweeps nothing, waits on nothing and is one round: a lead it leaves open is listed under Not known.

1. Run `context-central resolve <item> --absolute`, and read the item's state file, the note of its review where it has one, and its saved pull request, each at the path `context-central draft` prints. What is long goes to the reader, as step 2 of the skill has it, with the paths `draft` printed.
2. Add one question to the brief and to the sheet, with the next number, before the round is opened: what the build found that the facts do not say, or that goes against them.
3. Open the round as every round is opened, and draft again each file this round reads or writes. Save a copy of each note the round rests on, the state file and the note of the review among them, as it stands that day, among the research's sources: read the note, and write it word for word at the path `context-central draft research/<name>/sources/<NN>-<YYYY-MM-DD>-note-<what>-full-text.md` prints. Its kind in the list of sources is `note`. A note of the map is rewritten later, and the copy is what a fact goes on resting on: it is a saved source, kept as it came, whatever it names. The item's saved pull request is a saved source already: where the item is the research's own, link it by its path from the sheet's folder. Otherwise save a copy of it the same way, with `pr` in place of `note` in its name, and `pull-requests` as its kind.
4. What a note says of the code is a lead: read the code, and cite the code. Cite it by its line at the commit the build reached: the one the item's state file names, or the one `git -C <the repo's folder> rev-parse --short <the branch>` prints for the branch it names, asked one name to a command. Where that commit is not the one checked out, read a file as it was there with `git -C <the repo's folder> show <commit>:<path>`, and find the number of a line with `git -C <the repo's folder> grep -n -e '' <commit> -- <path>`, which prints each line with its number. What only a note holds, such as what a review found and how it was answered, is a fact with the copy as its source.
5. Write the facts, supersede the ones the build showed wrong, and write the round, the sheet's day and the reading, as `references/later.md` has a round on more questions do. A fact is superseded only by what holds at the head that is checked out: what holds on a branch that is not merged yet is a fact of its own, which names the branch. The round's entry is one of the usual form, and its `Stopped` line reads `what the build left was read`.
