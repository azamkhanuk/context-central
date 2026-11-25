# The eval suite

Nine cases for Claude Code's own `claude plugin eval`, kept in `evals/` as four case groups: three in `reading`, one in `proof`, four in `research` and one in `review`. Each case is one prompt a person might type. The host runs it in a fresh session with the plugin loaded and again with no plugin, three times each, and reports the case's score in both and the difference.

The suite is a measure taken by hand. It is not one of the checks, nothing waits on a score, and every run is paid for on the account of whoever starts it.

## What the cases measure

Each case is tied to one line of the [README](../README.md).

| Case | The README's line | The prompt | It passes when |
|---|---|---|---|
| `where-an-item-stands` | "A new session picks up where the last one stopped." | "Where does export-retry stand, and what is next?" | The reply gives a fact of where the work stands and a fact of what is next, each held by the item's state file and by no other file of the estate |
| `ticket-leads-to-notes` | "Points Claude at the right notes." | "What did we decide for PROJ-27, and why?" | The reply gives the reason, which one decision note behind the work item holds and no other file does. No folder is named after the ticket |
| `nothing-to-say` | "It stays quiet." | "How many days are there in a leap year?" | The reply gives the answer, and no note of the map was read or searched for its text. The difference expected is none: the plugin has nothing to add here, and should not send the session reading the map |
| `ready-to-merge` | "A build leaves proof." | "Is refund-window ready to merge?" | The reply says that the item's proof, the last recorded run of its check, is older than the head of its branch. No file of the estate says so: the state file says the item is built and verified |
| `reviewer-names-the-rule` | "Say how each repo is built, when you want to." | "Have the reviewer check the two diffs of plan-limits against api's standards. What does each one break?" | The reply gives the place of the one rule that one of the diffs breaks, as the path of api's standards note and the rule's line, and gives no line of the file the other diff adds, which breaks no rule |
| `research-with-no-map` | "Or start with the work: where there is no map yet, research, prep, design and implement offer to make a plain one on the spot, which git does not show." | "/context-central:research Nobody is here, so do not wait for me. How does the limiter in api decide when to refuse a call? Run it at the quick depth." | The reply gives `context-central init --plain`, the command that makes a plain map, and the session made no map and wrote or edited no file. No settings file is there, so no map covers the folder, and with nobody there the run asks nothing and makes none |
| `two-sources-one-fact` | "`/context-central:research` finds out from primary sources, writes no code and names the step that comes next." | "/context-central:research Nobody is here, so do not wait for me. How long is an export file kept before worker removes it? Run it at the quick depth." | The fact sheet the session wrote has one fact of how long a file is kept, marked verified, with a line for each of two sources. The code that removes a file and a note of the map each give seven days |
| `gap-said` | "`/context-central:research` finds out from primary sources, writes no code and names the step that comes next." | "/context-central:research Nobody is here, so do not wait for me. How many calls a minute was each shop to be allowed at the gateway, and who agreed that number? Run it at the quick depth." | The reply's last group, Not known, names the chat thread the number was agreed in. The state file of the work says the thread holds it, and no connection of acme reaches chat |
| `nobody-there-asks-nothing` | "`/context-central:research` finds out from primary sources, writes no code and names the step that comes next." | "/context-central:research Nobody is here, so do not wait for me. How long does worker wait before its last try at a failed export, and is that long enough to get past an outage of the file store? Run it at the quick depth." | The session asked nothing, and the reply's Not known names the outage, whose length no file of acme gives |

`reviewer-names-the-rule` asks for the plugin's reviewer by name, and it is the one case that lets a session start an agent. The arm without the plugin has no reviewer to start, and the one session of that arm whose folder was kept said so and checked the diffs itself. So the case measures what the reviewer adds to such an answer: a finding that rests on a written rule names the rule by its place, the `path:line` of the rule in the file that holds it.

The four cases of `research` type the research skill, which a person starts and Claude does not, each with nobody there and at the quick depth. Their case group grants the plugin's command, `Bash(context-central *)`, and the two tools that write a file, `Write` and `Edit`, since research writes its folder through them at the paths the command prints. The arm without the plugin has no such skill to start. `research-with-no-map` is the one case with no map. Each of the four rests on the plugin's own command in a run's shell, which no run of the host has started yet, as the checkpoint case below found: one trial run of one case comes before any other run of them, and a case whose run cannot start the command is dropped and its situation shown by headless runs of the skill instead.

There is no case for a checkpoint. One was built and tried twice, and a run's shell did not start the plugin's own command either time. A checkpoint is written through that command, so the case could show nothing of the plugin, and it was dropped.

- In the first trial the machine's `PATH` held an installed copy of the plugin, under the home folder. The session started the checkpoint skill, and each `context-central` command the skill ran was answered `operation not permitted`: a run's sandboxed shell cannot read the home folder.
- In the second, with that copy off the `PATH`, each was answered `command not found`: the `bin` folder of the plugin under test was not on the `PATH` of the run's shell. The session then wrote the state file itself, with the tools it was granted, and the case's graders passed, since they read that file alone. So the case as built would also have scored a checkpoint the plugin's command took no part in.

- In a third, made on 2026-11-14 with the checkout's own `bin` folder first on the `PATH` and the installed copy off it, the shell found the command and Node did not start: `node: OpenSSL configuration error`, `Operation not permitted`, on `/opt/homebrew/etc/openssl@4/openssl.cnf`. A run's settings deny its shell `/opt/homebrew/etc`, among the places where a credential may be kept, and the Node of that machine, from Homebrew, reads its OpenSSL configuration there as it starts. `git` did not start in that shell either: on macOS `/usr/bin/git` writes a cache in the temporary folder, which the shell is denied. So the `PATH` was the whole of the second trial's fault and not the whole of the matter, and no case here rests on the plugin's command in a run's shell.

## The estate of a case

Every case starts from the same invented estate, acme. The case's scaffold, a shell script, makes it in the run's empty workspace before the session starts, by sourcing `evals/acme.sh`. It is the same in both arms: 45 files, with four repos, seven work items of which six are in flight, concept and decision notes, two months of log and two saved tickets.

`ready-to-merge` adds to acme, in its own scaffold: one recorded check for the repo `api`, `./check.sh`; a git repository in `api/`, with a branch `main` and a branch `work/refund-window` two commits on from it; and an eighth work item, `refund-window`, whose state file says it is built and verified and whose proof record, `proof.jsonl`, holds one run of that check at the first of those two commits. The second is a fix made after that run, so the proof is older than the head of the branch. It is the one scaffold that starts a program, `git`, and it gives every commit a fixed author and date, so that the two commits have the same ids wherever the estate is made.

`research-with-no-map` sources acme and then takes its settings file, `estate.json`, away, so that the notes and the code are there and no map is, in both arms. `two-sources-one-fact` adds `worker/src/keep.js`, which keeps an export file seven days, as `concepts/exports.md` says. `gap-said` adds one line to the state file of `rate-limit-gateway`: the number of calls a minute for each shop was agreed in the team chat, in the thread T-377, and is written down nowhere else. acme's one connection holds tickets, and none holds chat. `nobody-there-asks-nothing` is acme as it is.

`reviewer-names-the-rule` adds to acme, in its own scaffold: a standards note for the repo `api`, `standards/api.md`, laid out as `context-central note --new standards/api` lays one out, with a commit and a date on its opening lines, its four parts and five rules that each name a source; the link to that note from `repos/api.md`; an eighth work item, `plan-limits`, whose spec has two slices; and for each slice the file it adds under `api/src/` and a diff of that file under `api/diffs/`, outside the map's folders. `refusal.diff` hands a caller its wait in milliseconds, under a name that ends `Ms`. That breaks one rule of the note, on its line 20, under Review: a wait handed to a caller is in whole seconds, under a name that ends `Seconds`. The spec gives the wait no unit, so nothing but the note says the diff is wrong. `plans.diff` breaks no rule. The scaffold starts no program, so `api` has no repository and `lint` says nothing of the note. The diffs are files because a run's shell starts no `git`: the reviewer is given them to read, where a build gives it a range.

It is made large enough that finding the right file is work for a session with no pointers. Several work items share the words of a case's prompt, a finished item still carries an old "next", and the log holds older lines about the same work.

The arms differ in one thing, whether the plugin is loaded. With it the session is given the live index at its start, and pointers when its prompt names something the map knows. Without it the same files are there and nothing says where to look. The plugin's agents come with it as well, and `reviewer-names-the-rule` asks for one of them. The host loads no instruction file in a run, so the hub is loaded in neither arm.

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
| `proof-is-older` of `ready-to-merge` | The proof, the check or its last run said to be older than the head, stale, out of date or behind the branch; the head or the last commit said to be unchecked or to have no run; a commit said to have come after the run; the branch said to have moved since, or, beside a word for the proof, to have moved, to be now at a commit, or to have a newer or a later commit; or a reply that opens by holding the merge back and names both commits, the one the run was made at and the one at the head |
| `rule-named` of `reviewer-names-the-rule` | `standards/api.md:20`, the path of the note and the line of the rule the diff breaks, wherever it stands in the reply |
| `clean-diff-clean` of `reviewer-names-the-rule` | A reply that nowhere gives a line of `plans.js`, the file the other diff adds, as `plans.js:` and a number |
| `gives-the-command` of `research-with-no-map` | `context-central init --plain`, with no `--dry-run` after it |
| `makes-no-map`, `writes-no-file` and `edits-no-file` of `research-with-no-map` | No call to the shell whose command holds `init` and `--plain` and no `--dry-run`, and no call to `Write` or to `Edit` |
| `one-fact-two-sources` of `two-sources-one-fact` | A pattern over the trace: a fact marked verified and not disputed, whose sentence names an export, keeping, removing or seven days, with two `Source` lines straight under it, as `Write` or `Edit` writes the sheet. The host's `Read` numbers each line it gives back, so a sheet read back does not pass, and the example of a fact the skill's own files give names none of those words |
| `gap-named` of `gap-said` | The words "Not known", then the chat or the thread T-377 before the heading of another group |
| `asks-nothing` and `ends-on-what-is-open` of `nobody-there-asks-nothing` | No call to `AskUserQuestion`; and the words "Not known", then an outage before the heading of another group |

`stands` rests on "production" being in no file of acme but the state file, so that a reply which names it has read that file. A test holds the word to that one file.

`proof-is-older` rests on no file of the estate saying that the proof is older than the head: the proof record holds the commit of the run, and the repository in `api/` holds the head. A session has the fact from the words on the item's row of the live index, or from reading both and comparing them. The two commits have fixed ids, which the pattern holds, so a reply that names both has read both. The pattern does not pass every sentence that holds the fact's words. These five replies fail, and a test holds each: "the proof is not stale", "is the proof older than the head?", "the proof may be older than the head", "I could not tell whether the proof is older than the head" and "two commits ahead of main". They are five replies and not five kinds: a denial, a question, a doubt or talk of `main` in other words can pass, and the kinds below give replies that do.

The tests hold replies each pattern must pass and replies it must fail. Four kinds of reply are scored wrongly all the same, and no pattern mends it:

- A right reply that does not name both of a pattern's two things scores as wrong: "it has not gone live" or "held back from production", the first with no word of production and the second with no word for off, or the count of tries with no word of whether the retry is on.
- For `next` and `reason`, a right reply that has the two things in two sentences scores as wrong: "First the alert. It goes in api."
- A reply that names both without having found them scores as right, whether it guesses or says that it does not know: "if it is about your payment provider, a rounding rule may be involved", or "I could not find whether it is live in production".
- A reply that says where the item stands and nothing of what is next can pass `next`, where it words the state file's first sentence with an alert: "switched off in production until the team can be alerted".

`proof-is-older` has kinds of its own. These are the ones found so far, by readers who tried replies against it, and a test holds each reply given here. No kind is closed: each reader who looked for one more reply of a kind found one.

- A right reply that names neither commit and uses none of the pattern's words scores as wrong: "the proof was recorded at the earlier of the branch's two commits".
- A right reply that names both commits, uses none of those words and does not open by holding the merge back scores as wrong: "Mostly, with one gap. The proof record names 15d9165; the branch ref is e60a545."
- A right reply that has a word of doubt close before the fact, with no comma between, scores as wrong: "I could see the proof is older than the head". With a comma, as in "I may be wrong, but the proof is older than the head", it passes.
- A right reply whose sentence ends at a line break with no full stop, and whose next line asks something, scores as wrong, since the pattern reads the two lines as one sentence that asks: "The proof is older than the head", and on the next line "Want me to run ./check.sh again?".
- A reply that sets the state file against the branch with no word of the proof scores as wrong, though it has seen that the branch moved: "The state file is from 2026-01-14 and the branch has a commit dated the day after."
- A reply that only wonders scores as right where its word of doubt is further before the fact: "it may well be that the proof is older than the head".
- A reply that doubts in words the pattern does not hold scores as right: "Yes. I am not sure the proof is older than the head.", "Yes. I doubt the proof is stale.", or "I cannot say the proof is older than the head".
- A reply that denies scores as right where its "no" or "not" is further before the fact, or where the fact is in other words: "Yes. There is no sign that the proof is stale.", or "Yes. The proof does not lag the head."
- A reply that asks scores as right where a comma, or a word such as "because", stands between the fact and the question mark: "Is the proof older than the head, or is it current?", or "Is the proof older than the head because of the last commit?"
- A wrong reply that sets the branch against `main` in other words scores as right: "Yes. The check passes and the branch is two commits ahead of the main branch.", or "Yes. The check passed, and main is two commits behind."
- A wrong reply that names the check and, in the same sentence, says where the branch now is or speaks of a newer or a later commit scores as right, since the pattern takes those words beside a word for the proof as the fact: "Yes. ./check.sh passes and the branch is now at e60a545.", or "Yes: ./check.sh passes, and the newer commit only adds the thirtieth-day test."
- A wrong reply that has a word for the proof beside "does not include" scores as right: "Yes. proof.jsonl shows ./check.sh exited 0, and the record does not include any failing run."
- A wrong reply that has "verified" or "passed" shortly before another or an earlier commit scores as right: "Yes. The state file says it is built and verified, with another commit adding the thirtieth-day test."
- A wrong reply that says the check passed before a change scores as right: "Yes. The tests passed before the change and after it."
- A reply that states the fact and still calls the item ready scores as right, since the pass is on the fact and not on the verdict: "Yes, it is ready: the proof is older than the head, which is fine."

Three readers who were told nothing of the pattern wrote replies to try it, before any figure was taken. The first two led to its rewriting. The third wrote 140 replies before opening the pattern as it ships: none of 40 right replies that had the row's words failed, 1 of 40 right replies worked out from the files failed, and none of 60 wrong replies passed. Those replies were a reader's and not a session's, so the counts say how the pattern does on wordings it was not made on, and not how often a session uses them.

After the figures were taken, a reader who had read the pattern wrote replies aimed at it: 24 of 47 wrong replies passed and 13 of 71 right ones failed. Those replies were written to break the pattern and are not a session's replies, so beside the blind read's counts they say how far the pattern can be pushed, and not how often a session's reply is scored wrongly. The kinds above come from them and from a later reader's replies of the same sort. The pattern is left as it was when the figures were taken. A result document holds no reply to score again, so a new pattern would need both runs made again.

The two scored graders of `reviewer-names-the-rule` look for a place and not for a fact in words. `rule-named` rests on what the reviewer is told, that a finding which rests on a written rule names it as the `path:line` of that rule, and on no file of the estate giving that place: a reply that has `standards/api.md:20` has it from the note, counted to the rule. A test holds the line to the one the scaffold writes the rule on. `clean-diff-clean` is a look-ahead from the start of the reply, which fails wherever `plans.js:` is followed by a digit. The reviewer reports a finding as `file:line`, so a reply with no line of that file gives no finding of that shape on the diff that breaks nothing. Four kinds of reply are scored wrongly, and a test holds each reply given here:

- A right reply that gives the rule in words, the note with no line, or the line in words scores as wrong on `rule-named`: "refusal.diff breaks the rule on line 20 of `standards/api.md`". That is the measure and not a fault in it: the case asks whether the rule is named by its place, as the reviewer is told to name it.
- A right reply that gives a line of `plans.js` where it says what was checked scores as wrong on `clean-diff-clean`: "plans.diff adds `api/src/plans.js:1-9` and breaks nothing". In the trial run the reviewer's own report named two such lines among what it had checked, and the session's reply left them out.
- A reply that found nothing passes `clean-diff-clean`, since it gives no line of any file: "I could not find the diffs of plan-limits". So a session that says nothing of either diff scores 0.50 and not 0.00.
- A wrong reply that gives a finding on the clean diff with no line, or at a line of the diff file, passes `clean-diff-clean`: "plans.diff breaks a rule as well, in `api/src/plans.js`", or "plans.diff breaks a rule as well, at `api/diffs/plans.diff:14`".

`nothing-to-say` also fails where a note of the map was read. That is a `Read` of a file of the map, or a `Grep` that prints the text it finds, unless its path is inside a repo's folder or its glob or its type names a kind of code file.

Each case but `research-with-no-map`, where no map covers the folder and the hook prints nothing, also carries `plugin-spoke`, a pattern over the session's trace for the first line of the live index. It is marked for the arm with the plugin alone, so the host leaves it out of the score when both arms run. It shows that the hooks reached the session. The trace holds what the session-start hook added and not what the prompt hook added, so it can show the index and never the pointers.

`reviewer-names-the-rule` carries a second grader marked for that arm alone, `reviewer-started`. It passes when the session called the `Agent` tool with the plugin's reviewer, `context-central:reviewer` or `reviewer`, as the agent to start, so it shows that the reply came by way of the reviewer.

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

Every session of a run is paid for by the account that starts it, and the host prints a list-price estimate of it. A full run is 54 sessions: nine cases, three runs each, in both arms.

On 2026-11-14, with Claude Code 2.1.325, a trial run of `where-an-item-stands` was one session of three turns and cost 0.03 USD by the host's estimate, and the run of the three cases of `reading` below, which was every case there was at the time, cost 0.57 USD. The two runs of the case group `proof`, 6 sessions each, cost 0.29 and 0.35 USD. On 2026-11-15, with the same Claude Code, a trial run of `reviewer-names-the-rule` was one session that started the reviewer and cost 0.11 USD, and the run of the case group `review`, 6 sessions, cost 0.48 USD.

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

The case group `proof` was run alone, twice, on 2026-11-14 on macOS, with Claude Code 2.1.325 and `claude-sonnet-5-5`: once on the plugin as it stood before the proof record was built, where the live index has no word on proof, and once at `49a351f`, with the proof record and its readers built and before the review's fixes to `lib/proof.mts` and `lib/lint.mts`. The case, its scaffold and its grader were the same in both, and are the ones that ship. A session of the case is given the same by the plugin as it ships as at `49a351f`: in the case's estate the session-start hook, and the prompt hook asked the case's own prompt, answer the same from the two, byte for byte, and a test holds the words on the row. Each run was 6 sessions, three with the plugin and three without.

| Run | With the plugin | Without | Difference | Sessions, time and cost |
|---|---|---|---|---|
| Before, at `053280c`, with no proof record built | 0.33 | 0.67 | -0.33 | 6 in 70 seconds, 0.29 USD |
| After, at `49a351f`, before the review's fixes | 1.00 | 0.67 | +0.33 | 6 in 83 seconds, 0.35 USD |

Turns and cost are for one session, the mean of an arm's three runs:

| Run | Turns with | Turns without | Cost with | Cost without |
|---|---|---|---|---|
| Before | 9.7 | 9.0 | 0.052 USD | 0.044 USD |
| After | 13.3 | 12.3 | 0.061 USD | 0.057 USD |

What they say, as found:

- With the words on the item's row, all three sessions passed the grader. Before the proof record, with the same index and no such words, one of three did.
- Without the plugin, two of three sessions passed, in both runs. Nothing of the plugin reaches that arm, so its two figures are two samples of one thing. A session that has `Read`, `Glob` and `Grep` alone can find the fact for itself, by reading the proof record and the branch's ref under `api/.git`.
- A pass is the grader's and not a reading of the reply. No reply of either run is kept, so whether a session that passed said that the proof was older than the head, or passed on one of the kinds [the graders](#the-graders) lists as scored wrongly, is not known. The wrong replies that pass are ones a session with no words on the row could give.
- So the difference of +0.33 after is one session of three, and the difference of -0.33 before is one session of three the other way. Three runs an arm cannot tell either from chance. What the two runs show is three sessions an arm: with the plugin one of three passed before and three of three after, and without it two of three passed both times.
- Turns and cost rose between the two runs in both arms alike, so they say nothing of the words on the row.
- What the three sessions that failed replied is not known either.

## The figures of `reviewer-names-the-rule`

The case group `review` was run alone on 2026-11-15 on macOS, with Claude Code 2.1.325 and `claude-sonnet-5-5`, on the case as it ships and the plugin at `7faa80e`, the commit that added the case, where the reviewer is told to name the written rule a finding rests on by its place: 6 sessions in 149 seconds, for 0.48 USD by the host's estimate.

| Case | With the plugin | Without | Difference |
|---|---|---|---|
| `reviewer-names-the-rule` | 1.00 | 0.50 | +0.50 |

Each scored grader, as the sessions that passed it:

| Grader | With the plugin | Without |
|---|---|---|
| `rule-named` | 3 of 3 | 0 of 3 |
| `clean-diff-clean` | 3 of 3 | 3 of 3 |

Turns and cost are for one session, the mean of an arm's three runs:

| Case | Turns with | Turns without | Cost with | Cost without |
|---|---|---|---|---|
| `reviewer-names-the-rule` | 1.0 | 12.7 | 0.098 USD | 0.062 USD |

What they say, as found:

- With the plugin every session started the reviewer, once, and every reply gave the place of the rule. Without it no reply did.
- Both arms passed `clean-diff-clean` in every session, so the whole difference is `rule-named`: +0.50 is one grader of two, in three sessions of three.
- The arm without the plugin has no reviewer to start. What its three sessions replied is not known, since a full run keeps no folder. One more session of each arm was then run with its folder kept, for 0.13 USD, and each scored as the three of its arm had. Without the plugin the session said that there was no reviewer agent, read the note and both diffs itself, and replied that `refusal.diff` breaks the Review rule on whole seconds and that `plans.diff` breaks nothing: the right finding, with the rule in words and no line.
- So what the case shows of the plugin is the place of the rule in the reply, and not the finding. In that kept session a session on this model found the broken rule with no reviewer: the estate is small, the prompt names api's standards, and the note is one search away.
- The trial run, one session with the plugin for 0.11 USD, showed what the case rests on. The session started `context-central:reviewer` with the `Agent` tool, and the host counted the call. The reviewer was given the two diffs by their paths in place of a range, with the spec and the note, read both as files, started no `git`, and did not stop for want of a range. Its report gave the rule as `standards/api.md:20`, and the session's reply kept it.
- The turns of the two arms are not to be compared. With the plugin the session starts the reviewer in the background, ends its turn, and writes its reply in one more turn when the reviewer reports. The host's figure is that last turn alone: in the trial's kept folder the session took six turns before it, and the reviewer's own turns are counted in neither.
- A session with the plugin cost 0.037 USD more, the mean of three against the mean of three.
- Three runs an arm is a small sample.

## What it cannot show

- What a hub alone gives a session, since the host loads no instruction file in a run.
- More than one model. Every run is on `claude-sonnet-5-5`.
- More than one estate. Every case starts from acme.
- More than a small sample. A session's reply moves from run to run, and a case is run three times an arm.
- What a session is given by an estate that keeps the default index budget where its index does not fit. The index is then cut to the rows that fit, with a line that says how many more there are, and acme's budget is set so that no case meets this.
- A checkpoint, or anything else a session does through the plugin's own command in the shell, for the reason given above. So the suite shows the proof record being read, by the index, and never being written.
- What the words on a row do for a session that can run `git`. `ready-to-merge` gives a session `Read`, `Glob` and `Grep` alone, and a session at work has a shell, with which it can ask git for the head itself.
- What the reviewer does with a range. A run's shell starts no `git`, so `reviewer-names-the-rule` gives the reviewer two diffs as files, where a build gives it a range to read with `git diff`.
- That the reviewer finds what a session alone would miss. In `reviewer-names-the-rule` the prompt names the standards and the note is five rules long, and the one session without the plugin whose reply was kept found the broken rule itself.
- That a finding is right. `rule-named` passes on the place of a rule and `clean-diff-clean` on a reply with no line of one file, and neither reads what the reply says there.
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
- each case's scaffold makes an estate the plugin answers for, in which the session-start hook gives the live index, but for `research-with-no-map`, whose estate holds no settings file, so that the hooks print nothing and `lint`, `graph` and `resolve` find no map;
- the prompt hook, given the case's own prompt, gives the pointers its graders rest on, or nothing for `nothing-to-say`;
- the fact a grader looks for is held by the one file the case is about and by no other file of acme, and for `ready-to-merge` and `reviewer-names-the-rule` by no file at all;
- the repository that `ready-to-merge`'s scaffold makes: its three commits and their ids, Acme's name on every line of its log, the branch's head as a file, and a proof record whose commit is the one before the head;
- in that estate the item's row of the live index ends `proof: older than the head`, in words the case's grader takes, and `lint` gives the one warning for proof;
- each pattern passes a right reply in other words, in a list and in a table, and fails a reply that found nothing or was built from another file of acme;
- the estate that `reviewer-names-the-rule`'s scaffold makes: a standards note whose opening lines are those of a new note with a commit and a date, whose rules each name a source, with the rule a diff breaks on line 20 and its words in no other file, a spec that gives the wait no unit, and two diffs that each add one file of `api` as it stands there;
- `rule-named` looks for that line, passes the place in a sentence, a list and a table, and fails the rule in words, the note with no line and another line; `clean-diff-clean` fails a reply with a line of the file the clean diff adds; and `reviewer-started` counts a call that names the plugin's reviewer as the agent to start, and no other;
- the four cases of `research`: their group's three grants, each prompt typing the research skill with nobody there at the quick depth, the code and the note that each give how long an export file is kept, the line that puts the gateway's number in a chat thread and no file that gives it, no file that gives how long an outage lasts, and each grader passing a right reply or trace and failing a wrong one, among them a reply that names the chat or the outage only under another group and a sheet read back with its lines numbered;
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
