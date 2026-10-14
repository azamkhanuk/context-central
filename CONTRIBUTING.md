# Contributing

A fault you have found is welcome as an issue: the bug report form asks for what is needed to see it. For a change of your own, open an issue first and say what it is for, so that nobody builds what will not be taken.

## The checks

The plugin needs Node 22.18 or later and has no dependencies at run time. `npm install` brings in the type checker and Node's types, which only `npm run typecheck` needs.

```sh
npm test                    # every test, through the command line as a process
npm run typecheck           # must stay clean
claude plugin validate .    # must pass
```

One test file alone is `node --test test/<name>.test.mts`. A pull request is run on Linux, macOS and Windows, and the job named `gate` says whether every one of them passed.

## The conventions

[.claude/CLAUDE.md](.claude/CLAUDE.md) holds them: how the code is written, how a command is laid out, how the tests are written and how text is worded. It is short, and a change is read against it. [CONTEXT.md](CONTEXT.md) defines the plugin's terms, which the code, the docs and the skills use as written.

Three of them catch most first changes:

- Work test-first, one behaviour at a time, through the command line as a process. Expected values are literals or come from the fixture.
- The plugin holds no rule for any language, framework or vendor. A vendor is named in one file under `lib/presets/` and nowhere else.
- Text a person or the model reads is plain British English, with no em dashes and no emojis.

## Nothing private

The repository is public. Nothing in it, and no commit message, may name a client, an employer, a private person, a real ticket or a private path. Fixtures use the invented estate "acme" and keys such as `PROJ-12`. Leave the text of your own map out of an issue and out of a test.

## Releases

A release is one pull request that raises `version` in `.claude-plugin/plugin.json` and adds that version's section, dated, at the top of [CHANGELOG.md](CHANGELOG.md). What a release changes for a map that already exists goes under that heading in its section. [What stays put before 1.0](docs/install.md#what-stays-put-before-10) says what a release may change.
