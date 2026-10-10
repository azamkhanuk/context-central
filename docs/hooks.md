# What the hooks put in context

The plugin has two hooks: one runs when a session starts, and one when a prompt is submitted. The budgets named here are set out under [The three tiers](map.md#the-three-tiers).

## At session start

On startup, resume, clear, compaction and fork, the hook adds the live index.

- It names the map, the hub, and each work item in flight with its title and state file.
- Where the map records connections, one line names each, what it holds and the ways recorded for it.
- In a session started inside a registered repo that has a repo note, one line after the hub names that note and, where the repo has one, its standards note. In a map kept inside a repo whose entry in `estate.json` has the path `.`, every session starts inside that repo, so once it has a note the line is there from the estate root down. In the root layout a repo registered at `.` is named at the root only, since below the root the hooks cover a folder only through a repo's path or a node folder. `budget <folder>` counts the line; `lint`'s index check has no folder to start from and counts the index without it.
- After compaction or on resume, the state file of the item the session was working on follows the index. After a compaction the hook also forgets what the session was given, so a later prompt that names a repo, an item or a note gets its pointers again.
- The whole text is cut at 9,500 characters.

## When a prompt is submitted

The hook adds pointers when the prompt names something the map knows. First match wins:

1. a work item, by any spelling of its ticket or by name, or else by its name written with spaces or its title word for word
2. a link that belongs to a connection: the work item that mentions it, or else the note of the repository it names
3. a registered repository name
4. free text that matches a node on at least two words with a clear score
5. a node's identifier: the `id` in its frontmatter or one of its `aliases`, written on one line with commas between them, or for a numbered node its kind and its number, as in "decision 7"
6. a node's name: its file name or its title, when that is the whole of the prompt's counted words
7. a term of the glossary, when that is the whole of the prompt's counted words

Routes 5 to 7 are tried only where the four before them have no answer, so a prompt that had an answer keeps it. They leave out the work folder, the log and the deep tier. A prompt's counted words are its runs of letters and digits, without stop words and runs of one or two letters; a run that holds a digit always counts. An identifier of one word answers only when it is the whole prompt, and a number alone names nothing.

The pointers are a short list of paths with sizes and a reason each, plus a count of the deep files and of the evidence behind the item. A work item's pointers are its state file, its spec, the notes it links and the repo notes it names, and each repo note brings the repo's standards note straight after it. A repo's pointers are its note, its standards note and the notes its note links, among them a file of the repo itself when the note links one, in either layout, so long as the link stays inside the estate. They are facts, never instructions. Each answer is delivered once per session. The record of what a session has been given is kept under the system's temporary folder, and is removed once no session has used it for fourteen days.

When a prompt names a ticket that no work item answers to, the hook adds one line saying so and which connection it reads as. A bare number is never reported, a reference is reported once per session, and three are reported at most.

Two limits:

- A prompt longer than `budgets.hookTextChars` (600 characters) is matched only on work item tickets and names, links and repo names. It is not matched on its words, a title or a name written with spaces, nor on an identifier, a node's name or a term, and no ticket without a work item is reported: a pasted log or diff would match those by chance.
- On the command line `resolve` has one more route after free text: when two or more words of the query all sit in the name and title of one work item, and of no other, the answer is that item. The hook never uses it. Routes 5 to 7 come after it there.

## When a large session resumes with an expired cache

The hook shows a notice to the person, not to the model. If Claude Code reports that the prompt cache has likely expired and the session holds at least `budgets.resumeNoticeTokens` (100,000) tokens, the hook shows one line giving the size and saying that a fresh session started from the work item's state file is cheaper.

## When the hooks stay silent

- no map covers the session's folder
- the working directory is inside a different map
- the folder is outside the estate, under a `leftAlone` entry, or not a registered repo or node folder
- the prompt matches nothing with confidence
- the same answer was already delivered in this session

If `estate.json` is invalid, the person sees a one-line message and the model sees nothing. The resolver makes no network call.
