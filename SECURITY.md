# Reporting a security fault

Report it in private, not in a public issue.

On the repository's page on GitHub, open the Security tab and choose "Report a vulnerability". That opens a private report which only the maintainer reads.

Say which release you run (`context-central --version` prints it), what you did and what happened. Leave out the text of your own map: a note, a saved ticket or a state file may hold names and other private matter, and a report does not need it.

What counts here: the plugin running something it should not, writing or removing a file outside the places its page "What it runs, what it writes and how to remove it" lists under `docs/`, following text from a ticket or a pull request as if it were an instruction, or putting a token or other private text where it can be read.

Only the newest release is fixed. A fix goes out as a new release, and the changelog says so.
