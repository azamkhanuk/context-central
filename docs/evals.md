# The eval suite

Four cases for Claude Code's own `claude plugin eval`, kept in `evals/` as two case groups: three in `reading` and one in `proof`. Each case is one prompt a person might type. The host runs it in a fresh session with the plugin loaded and again with no plugin, three times each, and reports the case's score in both and the difference.

The suite is a measure taken by hand. It is not one of the checks, nothing waits on a score, and every run is paid for on the account of whoever starts it.

## What the cases measure

Each case is tied to one line of the [README](../README.md).

| Case | The README's line | The prompt | It passes when |
|---|---|---|---|
| `where-an-item-stands` | "A new session picks up where the last one stopped." | "Where does export-retry stand, and what is next?" | The reply gives a fact of where the work stands and a fact of what is next, each held by the item's state file and by no other file of the estate |
| `ticket-leads-to-notes` | "Points Claude at the right notes." | "What did we decide for PROJ-27, and why?" | The reply gives the reason, which one decision note behind the work item holds and no other file does. No folder is named after the ticket |
| `nothing-to-say` | "It stays quiet." | "How many days are there in a leap year?" | The reply gives the answer, and no note of the map was read or searched for its text. The difference expected is none: the plugin has nothing to add here, and should not send the session reading the map |
| `ready-to-merge` | "A build leaves proof." | "Is refund-window ready to merge?" | The reply says that the item's proof, the last recorded run of its check, is older than the head of its branch. No file of the estate says so: the state file says the item is built and verified |

There is no case for a checkpoint. One was built and tried twice, and a run's shell did not start the plugin's own command either time. A checkpoint is written through that command, so the case could show nothing of the plugin, and it was dropped.

- In the first trial the machine's `PATH` held an installed copy of the plugin, under the home folder. The session started the checkpoint skill, and each `context-central` command the skill ran was answered `operation not permitted`: a run's sandboxed shell cannot read the home folder.
- In the second, with that copy off the `PATH`, each was answered `command not found`: the `bin` folder of the plugin under test was not on the `PATH` of the run's shell. The session then wrote the state file itself, with the tools it was granted, and the case's graders passed, since they read that file alone. So the case as built would also have scored a checkpoint the plugin's command took no part in.

- In a third, made on 2026-11-14 with the checkout's own `bin` folder first on the `PATH` and the installed copy off it, the shell found the command and Node did not start: `node: OpenSSL configuration error`, `Operation not permitted`, on `/opt/homebrew/etc/openssl@4/openssl.cnf`. A run's settings deny its shell `/opt/homebrew/etc`, among the places where a credential may be kept, and the Node of that machine, from Homebrew, reads its OpenSSL configuration there as it starts. `git` did not start in that shell either: on macOS `/usr/bin/git` writes a cache in the temporary folder, which the shell is denied. So the `PATH` was the whole of the second trial's fault and not the whole of the matter, and no case here rests on the plugin's command in a run's shell.

## The estate of a case

Every case starts from the same invented estate, acme. The case's scaffold, a shell script, makes it in the run's empty workspace before the session starts, by sourcing `evals/acme.sh`. It is the same in both arms: 45 files, with four repos, seven work items of which six are in flight, concept and decision notes, two months of log and two saved tickets.

`ready-to-merge` adds to acme, in its own scaffold: one recorded check for the repo `api`, `./check.sh`; a git repository in `api/`, with a branch `main` and a branch `work/refund-window` two commits on from it; and an eighth work item, `refund-window`, whose state file says it is built and verified and whose proof record, `proof.jsonl`, holds one run of that check at the first of those two commits. The second is a fix made after that run, so the proof is older than the head of the branch. It is the one scaffold that starts a program, `git`, and it gives every commit a fixed author and date, so that the two commits have the same ids wherever the estate is made.

It is made large enough that finding the right file is work for a session with no pointers. Several work items share the words of a case's prompt, a finished item still carries an old "next", and the log holds older lines about the same work.

The arms differ in one thing, whether the plugin is loaded. With it the session is given the live index at its start, and pointers when its prompt names something the map knows. Without it the same files are there and nothing says where to look. The host loads no instruction file in a run, so the hub is loaded in neither arm.

acme sets its index budget, `budgets.indexChars`, to 9,500 characters, where an estate that sets nothing has 2,000. With six work items in flight acme's index is 837 characters and eight times the length of the workspace's path, so at 2,000 it is cut once that path passes 145 characters, and `context-central lint` then reports that the items in flight do not fit. A run's workspace on the machine behind this page was 30 characters long, so the index was whole in every run here at either figure, and the first full run was made before acme set a budget at all. The setting keeps the index whole where a run's temporary folder sits at the end of a longer path.

## The graders

Every grader is of the host's free kinds: a pattern in the reply or in the session's trace, or a tool that was or was not used. None calls a judge model, so the same reply scores the same each time and a run pays for its sessions alone.

A pattern is a blunt measure of a reply. Where a fact has no one word of its own, a scored pattern looks for it as two things, in either order and across the lines of a list or a table. For `next` and `reason` the two have to be said in one sentence. For `stands` they may be anywhere in the reply:

| Grader | It passes on |
|---|---|
| `stands` of `where-an-item-stands` | Production, and a word for off, such as "off", "disabled", "inactive", "not live" or "waiting to be switched on" |
| `next` of `where-an-item-stands` | The `export-stalled` channel; an alert beside api or an export that has failed every try; an alert or a notice beside the team; or production beside a word for switching on |
| `reason` of `ticket-leads-to-notes` | The payment provider, or its settlement files, beside rounding, half, matching, agreeing or being consistent |
| `answer` of `nothing-to-say` | 366 |
| `proof-is-older` of `ready-to-merge` | The proof, the check or its last run said to be older than the head, stale, out of date or behind the branch; the head or the last commit said to be unchecked or to have no run; a commit said to have come after the run; or a reply that opens by holding the merge back and names both commits, the one the run was made at and the one at the head |

`stands` rests on "production" being in no file of acme but the state file, so that a reply which names it has read that file. A test holds the word to that one file.

`proof-is-older` rests on no file of the estate saying that the proof is older than the head: the proof record holds the commit of the run, and the repository in `api/` holds the head. A session has the fact from the words on the item's row of the live index, or from reading both and comparing them. The two commits have fixed ids, which the pattern holds, so a reply that names both has read both. The pattern does not pass a sentence that only wonders ("whether", "if", "may", "I could not tell"), denies ("not stale"), asks, or speaks of the branch against `main`.

The tests hold replies each pattern must pass and replies it must fail. Four kinds of reply are scored wrongly all the same, and no pattern mends it:

- A right reply that does not name both of a pattern's two things scores as wrong: "it has not gone live" or "held back from production", the first with no word of production and the second with no word for off, or the count of tries with no word of whether the retry is on.
- For `next` and `reason`, a right reply that has the two things in two sentences scores as wrong: "First the alert. It goes in api."
- A reply that names both without having found them scores as right, whether it guesses or says that it does not know: "if it is about your payment provider, a rounding rule may be involved", or "I could not find whether it is live in production".
- A reply that says where the item stands and nothing of what is next can pass `next`, where it words the state file's first sentence with an alert: "switched off in production until the team can be alerted".

`proof-is-older` has kinds of its own:

- A right reply that names neither commit and uses none of the pattern's words scores as wrong: "the proof was recorded at the earlier of the branch's two commits".
- A right reply that puts a word of doubt within a few words before the fact, with no comma between, scores as wrong: "it may well be that the proof is older than the head". With a comma, as in "I may be wrong, but the proof is older than the head", it passes.
- A reply that states the fact and still calls the item ready scores as right, since the pass is on the fact and not on the verdict.
- A reply that sets the state file against the branch with no word of the proof scores as wrong, though it has seen that the branch moved.

Three readers who were told nothing of the pattern wrote replies to try it, before any figure was taken. The first two led to its rewriting. The third wrote 140 replies before opening the pattern as it ships: none of 40 right replies that had the row's words failed, 1 of 40 right replies worked out from the files failed, and none of 60 wrong replies passed. Those replies were a reader's and not a session's, so the counts say how the pattern does on wordings it was not made on, and not how often a session uses them.

`nothing-to-say` also fails where a note of the map was read. That is a `Read` of a file of the map, or a `Grep` that prints the text it finds, unless its path is inside a repo's folder or its glob or its type names a kind of code file.

Each case also carries `plugin-spoke`, a pattern over the session's trace for the first line of the live index. It is marked for the arm with the plugin alone, so the host leaves it out of the score when both arms run. It shows that the hooks reached the session. The trace holds what the session-start hook added and not what the prompt hook added, so it can show the index and never the pointers.

## Running it

It needs Claude Code 2.1.269 or later, signed in as for any session, and macOS or Linux, since a scaffold is a shell script. From the root of the plugin:

```sh
npm run evals                                          # a full run: every case, three runs each, in both arms
npm run evals -- --group reading                       # one case group
npm run evals -- --case where-an-item-stands           # one case, in both arms
npm run evals -- --case where-an-item-stands --trial   # a trial run: one case, once, with the plugin
npm run evals -- --max-cost-usd 3                      # another ceiling than 10 USD
npm run evals -- --trust-plugin                        # where there is no terminal to be asked at
```

The command is the repository's own, `scripts/run-evals.mts`, and not a command of the plugin: installing the plugin gives nobody a new command. It starts `claude plugin eval` once for each case group, in the order of their names, and always passes:

- `--no-publish`, so the report stays on the machine.
- `--scaffold`, so each case gets its estate. Without it a case runs in an empty folder, scores nothing and is paid for all the same.
- `--model claude-sonnet-5-5`, so that a newer model is not taken for a change in the plugin.
- `--max-cost-usd`, 10 unless you give another figure. The ceiling is for the run as a whole: after each case group the command reads what it cost from the host's result document and gives the next start what is left. The host checks the ceiling before each session starts, so spend can pass it by the session in flight.
- `--threshold 0`, so that the host's exit code speaks of a run that did not complete and never of a score.
- `--output-dir`, a folder for each case group under `evals/results/<the moment of the run>/`.

`--trial` goes with `--case` and adds `--runs 1 --ablation none --keep-temp`: one session, with the plugin, whose temporary folder is kept to be looked at. `--trust-plugin` is passed on only when you give it. At a terminal the host asks whether the folder is trusted, and it refuses a run that cannot ask, such as one a session starts.

The command prints each line it starts before the host runs, and the results folder at the end. It claims that folder by making it, so two runs started at one moment cannot share one. Where the host wrote nothing there, the folder is removed and not named.

A terminate sent to the command is passed on to the host. An interrupt or a hang-up is not, since a terminal gives those to the host as well. After any of the three the command waits for the host to end its case group and starts no later one.

| It exits with | When |
|---|---|
| 0 | Every case group it was asked for ran to its end, whatever the scores. A signal that reached the command during the last case group changes nothing where the host ends that group with 0 |
| the host's own code | The host ended a case group non-zero: 1 for a case that did not load or a run that could not start or finish, 2 for a ceiling reached or a credential refused, 130 or 143 for a run that was stopped. No later case group is started, and a line names them |
| the host's own code | The host was ended by a signal: 128 and the signal's number, as a shell gives it, such as 143 for a terminate |
| 143, 130 or 129 | A terminate, an interrupt or a hang-up reached the command, the host then ended its case group with 0, and a later case group was still to start. It is not started, and a line names it |
| 2 | It started nothing: a flag it does not know or is given twice, `--group` with `--case`, `--trial` without `--case`, a case group or a case that is not there, a ceiling that is not a plain figure above 0, a folder that is not the root of a plugin or holds no case group, a `group.json` that is not a list of grants, a case group or a case that is a link or is not named in small letters, digits and dashes, two cases of one name, a results folder that is there already or cannot be made, or a `claude` on the `PATH` that is not there or cannot be started |
| 2 | Nothing is left of the ceiling before a case group starts |
| 1 | A case group is still to start and the last result document gives no cost |

## What a run costs

Every session of a run is paid for by the account that starts it, and the host prints a list-price estimate of it. A full run is 24 sessions: four cases, three runs each, in both arms.

On 2026-11-14, with Claude Code 2.1.325, a trial run of `where-an-item-stands` was one session of three turns and cost 0.03 USD by the host's estimate, and the run of the three cases of `reading` below, which was every case there was at the time, cost 0.57 USD. The two runs of the case group `proof`, 6 sessions each, cost 0.29 and 0.35 USD.

## The figures of the last full run

Run on 2026-11-14 on macOS, with Claude Code 2.1.325 and `claude-sonnet-5-5`, on the cases as they ship in 0.18.1: 18 sessions in 84 seconds, for 0.57 USD by the host's estimate. The plugin's hooks, commands and skills were those of release 0.18.0, which 0.18.1 does not change.

| Case | With the plugin | Without | Difference |
|---|---|---|---|
| `where-an-item-stands` | 1.00 | 1.00 | 0.00 |
| `ticket-leads-to-notes` | 1.00 | 0.00 | +1.00 |
| `nothing-to-say` | 1.00 | 1.00 | 0.00 |

Turns and cost are for one session, the mean of an arm's three runs, from the host's result document:

| Case | Turns with | Turns without | Cost with | Cost without |
|---|---|---|---|---|
| `where-an-item-stands` | 3.0 | 5.7 | 0.034 USD | 0.037 USD |
| `ticket-leads-to-notes` | 5.3 | 3.0 | 0.043 USD | 0.031 USD |
| `nothing-to-say` | 1.0 | 1.0 | 0.024 USD | 0.021 USD |

What they say, as found:

- `where-an-item-stands` shows no difference in the score. A session on this model finds the state file with no pointers, in about twice the turns. In each of its six sessions both scored graders passed: none passed one and failed the other.
- `ticket-leads-to-notes` shows the one difference. With the plugin every session gave the reason. Without it none did, and each ended after three turns. What those three replied is not known: the host's result document holds no reply, and a full run keeps no temporary folder.
- `nothing-to-say` shows no difference in the score, as expected, and no note of the map was read or searched in either arm. The session with the plugin cost 0.003 USD more, which is the price of what the plugin puts into every session.
- Three runs an arm is a small sample. A difference of 1.00 is three sessions of three.

The first full run, made the same day before the changes listed under [A case is reported as found](#a-case-is-reported-as-found), was scored on the earlier patterns: `where-an-item-stands` 1.00 with the plugin and 1.00 without, `ticket-leads-to-notes` 1.00 and 0.33, `nothing-to-say` 1.00 and 1.00, in 18 sessions for 0.58 USD. Its sessions were not this run's, and a result document holds no reply to score again, so the two runs do not say what the changes to the patterns did to a score.

## The figures of `ready-to-merge`, before the proof record and after

The case group `proof` was run alone, twice, on 2026-11-14 on macOS, with Claude Code 2.1.325 and `claude-sonnet-5-5`: once on the plugin as it stood before the proof record was built, where the live index has no word on proof, and once on the plugin as it ships in 0.19.0. The case, its scaffold and its grader were the same in both. Each run was 6 sessions, three with the plugin and three without.

| Run | With the plugin | Without | Difference | Sessions, time and cost |
|---|---|---|---|---|
| Before, at the commit that added the case | 0.33 | 0.67 | -0.33 | 6 in 70 seconds, 0.29 USD |
| After, on the plugin as it ships | 1.00 | 0.67 | +0.33 | 6 in 83 seconds, 0.35 USD |

Turns and cost are for one session, the mean of an arm's three runs:

| Run | Turns with | Turns without | Cost with | Cost without |
|---|---|---|---|---|
| Before | 9.7 | 9.0 | 0.052 USD | 0.044 USD |
| After | 13.3 | 12.3 | 0.061 USD | 0.057 USD |

What they say, as found:

- With the words on the item's row, all three sessions said that the proof was older than the head. Before the proof record, with the same index and no such words, one of three did.
- Without the plugin, two of three sessions said it, in both runs. Nothing of the plugin reaches that arm, so its two figures are two samples of one thing: a session that has `Read`, `Glob` and `Grep` alone often finds the fact for itself, by reading the proof record and the branch's ref under `api/.git`.
- So the difference of +0.33 after is one session of three, and the difference of -0.33 before is one session of three the other way. Three runs an arm cannot tell either from chance. What the two runs do show is the arm with the plugin going from one of three to three of three, with nothing changed but the plugin.
- Turns and cost rose between the two runs in both arms alike, so they say nothing of the words on the row.
- What the three sessions that failed replied is not known: a result document holds no reply.

## What it cannot show

- What a hub alone gives a session, since the host loads no instruction file in a run.
- More than one model. Every run is on `claude-sonnet-5-5`.
- More than one estate. Every case starts from acme.
- More than a small sample. A session's reply moves from run to run, and a case is run three times an arm.
- What a session is given by an estate that keeps the default index budget where its index does not fit. The index is then cut to the rows that fit, with a line that says how many more there are, and acme's budget is set so that no case meets this.
- A checkpoint, or anything else a session does through the plugin's own command in the shell, for the reason given above. So the suite shows the proof record being read, by the index, and never being written.
- What the words on a row do for a session that can run `git`. A case gives a session `Read`, `Glob` and `Grep` alone, and a session at work has a shell, with which it can ask git for the head itself.
- Whether a reply is right in words a pattern does not know, or is a guess in words it does. [The graders](#the-graders) says which replies those are.
- Anything on Linux or Windows. The runs behind this page were made on macOS. On Linux the host's sandbox is another program, and on Windows a scaffold cannot start.
- From a score, that the pointers reached a session: the trace a grader reads does not hold them. The kept folder of a trial run does.

The host's own page says to treat scores as advisory for a plugin whose hooks you did not write, since hooks run outside a run's sandbox. These are the plugin's own two hooks, which write nothing but the session's record: [What it runs](what-it-runs.md) says so.

## A case is reported as found

A case that shows no difference, or a difference against the plugin, is reported as it came out. A case is changed only where it measures the wrong thing, such as a grader that fails a right answer, and the change is written down on this page with its reason. A case is never changed to move a figure.

Changes so far:

- 2026-11-14, before the first release. A review of the cases, made after the first full run, tried replies against each pattern and found right replies in other words that failed and replies that had found nothing that passed. The patterns of `where-an-item-stands` and `ticket-leads-to-notes` were rewritten to take the fact in more wordings and to ask for more than one bare word. In `nothing-to-say` a read by a relative path now counts, a file of a repo no longer counts when the workspace sits under a folder named like one of the map's, and a search that prints the text of notes counts as reading them. In acme, the worker's code no longer says how many tries production uses, which gave away a fact meant to be the state file's alone, and the estate's own setting keeps its index whole at the end of a long path.
- 2026-11-14, before the first release, after a second review. The patterns were rewritten again, to what the table under [The graders](#the-graders) gives. The review showed right replies in a list or a table that failed, since a pattern stopped at the end of a line, and replies built from other files of acme, or from nothing, that passed on one bare phrase such as "not enabled" or "settlement". `no-note-searched` no longer counts a search kept to a repo's code, which prints no note. acme's index setting went up to 9,500 characters, the most the session-start hook gives a session: at 4,000 the index was still cut once the workspace's path passed 395 characters.
- 2026-11-14, before the first release, after a third review. `reason` took any word that starts "settle", so it passed the decision with no reason: "rounded half to even, as decision 3 settled", which another note of acme says. It now takes "settlement". `next` passed "the shop is notified after every attempt fails", built from the item's spec and a concept note: a notice now passes only beside the team, and an export that has failed every try only beside an alert. `stands` passed on a session's own count of its tries, so the count of five tries is out of the pattern, which looks for production beside a word for off alone. `no-note-searched` passed over every search that was not of markdown, and some of those print notes: it now passes over a search only where its path, its glob or its type names a repo's code. The test that holds each fact to one file of acme now reads the files as a session would say them, with the markup of a link taken off, which is how the first of these went unseen.
- 2026-11-14, before the first release, after a fourth review, kept to the change before it. With the count of tries out, `stands` failed a right reply that said "switched off" and left "in production" for its next sentence. It now takes production and a word for off anywhere in the reply. `no-note-searched` no longer passes over a glob of two parts, such as `*.md,*.js`, which searches notes as well as code.
- 2026-11-14, before any figure of `ready-to-merge` was taken. Three readers who were told nothing tried the case's pattern, and the first two led to its rewriting: its first form failed 37 of 78 right replies and passed 18 of 78 wrong ones, and its second failed 8 of 40 right replies worked out from the files and passed 5 of 60 wrong ones, each of those talk of the branch against `main`. The scaffold's repository was given a `main` branch to merge into and a test of the refund itself, so that the stale proof is the one thing wrong, and Acme's name and a fixed date on every line of its log, where one line had carried the name of the machine's own account. A trial run then showed a session set the commit that the state file named against the branch, with the proof record unread: the state file's Done line named the commit of the run, which the case does not ask for, so that line is now dated, as acme's others are. The figures above were taken after all of these, on the case as it ships.

## What the tests hold, free

What needs no paid session is held by the tests, on every push:

- every case has a prompt and at least one grader, and no grader is of a kind that calls a judge;
- each case's scaffold makes an estate the plugin answers for, in which the session-start hook gives the live index;
- the prompt hook, given the case's own prompt, gives the pointers its graders rest on, or nothing for `nothing-to-say`;
- the fact a grader looks for is held by the one file the case is about and by no other file of acme, and for `ready-to-merge` by no file at all;
- the repository that `ready-to-merge`'s scaffold makes: its three commits and their ids, Acme's name on every line of its log, the branch's head as a file, and a proof record whose commit is the one before the head;
- in that estate the item's row of the live index ends `proof: older than the head`, in words the case's grader takes, and `lint` gives the one warning for proof;
- each pattern passes a right reply in other words, in a list and in a table, and fails a reply that found nothing or was built from another file of acme;
- the command starts the host with the flags above, and refuses what the table above says it refuses.

The tests that start a scaffold are skipped on Windows. The scaffold of `ready-to-merge` needs `git` 2.28 or later.

## Adding a case

A case is a folder in its case group. A case group is a folder under `evals/` whose cases need the same grants, and it runs alone.

```
evals/<group>/group.json                 { "allowTools": [] }
evals/<group>/<case>/prompt.md           front matter, then the prompt as a person would type it
evals/<group>/<case>/case.yaml           the case's name, and the scaffold beside it
evals/<group>/<case>/scaffold.sh         sources ../../acme.sh, then writes the case's own files with put
evals/<group>/<case>/graders/<name>.md   one grader of a free kind
```

- **A case:** copy an existing one. `name` in `case.yaml` is the folder's name, and no other case has it. `tags` in `prompt.md` is the name of its case group and nothing else: the host passes over a case that lacks it, without a word, when the group is run, and runs a case again under every other tag it carries. `allowed_tools` lists read-only tools alone, since a grant comes from the group. Nothing outside the folder changes.
- **A case group:** a new folder with `group.json`. Its `allowTools` are the grants the host gives every case of the group, written as `--allow-tools` takes them, and `[]` for cases that only read. `results` and `mocks` are the host's own names. A link that is neither a case group nor a case, such as a `results` kept on another disk, is passed over.
- **Names** are small letters, digits and dashes, starting with a letter.
- **One key and its value a line** in front matter and in `case.yaml`: the tests read them with no YAML parser.
- **A scaffold that starts a program** brings everything that program needs. The host starts a scaffold with `PATH`, `HOME`, `TMPDIR` and `TERM` and little else, and the suite's own tests run it a second time in the same folder and expect the same files. `ready-to-merge`'s gives `git` its author, its dates and its formats, and starts no `git` that writes where the repository is already made.
- **The tests hold a new case to the same rules** with no change to them. What the case's own prompt is answered with is one more test in `test/eval-cases.test.mts`, beside those there.

## Where a run's results go

The host writes a result document and a report for each case group under `evals/results/`, which is kept out of git: a result document holds every prompt and the paths of the machine that ran it. With graders of the free kinds it holds each grader's verdict and no reply.
