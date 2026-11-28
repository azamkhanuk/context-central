export interface Step {
  heading: string
  paragraphs: string[]
}

export const CLAUDE_CODE = {
  title: 'Claude Code',
  setsForACommand: 'CLAUDECODE',
}

export const CLAUDE_CODES_STEPS: Step[] = [
  {
    heading: 'Servers this session holds',
    paragraphs: [
      'The MCP servers and connectors this session itself holds are read from the names in its own tool list. A tool named `mcp__<server>__<tool>` belongs to the server `<server>`.',
    ],
  },
  {
    heading: 'Allowing a tool',
    paragraphs: [
      "Offer allow rules for the read tools just used, for `.claude/settings.local.json` on this machine only. A server's tool is allowed by its full name, `mcp__<server>__<tool>`. Write them only on a yes.",
    ],
  },
  {
    heading: 'Settings',
    paragraphs: [
      'Run `context-central init --print-settings` and show the JSON. Ask where it goes: `.claude/settings.json` (shared with everyone who uses the map) or `.claude/settings.local.json` (this machine only). Either sits in the folder sessions start from: the estate root or, for layout `inner`, the repo that holds `.context-central/`. Write it only on a yes, merging into the keys already in that file. Settings printed before 0.14.0 declare the marketplace `context-central` from the repository `azamkhanuk/context-central` and enable `context-central@context-central`, and with both ids enabled two copies of the plugin load. Where either settings file of that folder holds those two, name them when you show the JSON and offer to write the printed entries in their place, in the file that holds them. A marketplace `context-central` added from a folder is a clone the person works from: ask whether the printed entries should take its place. A marketplace `context-central` from any other repository is a fork the person runs on purpose: leave it and its entries as they are, write only the permission, and say so, since the printed entries beside it would load two copies. On a no to either, write only the permission, never the printed entries beside the older ones.',
      "Then say what decides whether the plugin loads. Claude Code reads project settings only from the folder a session starts in, and applies those that add a marketplace only once that folder's trust prompt has been accepted in a session with a person in it: in a headless run of a folder nobody has trusted, nothing loads. The printed entry turns auto-update on, so a release reaches everyone who has the plugin this way. For layout `root`, a session started inside a repo is not given the plugin by the estate root's settings. Offer the two ways round: install it for the person, with `claude plugin marketplace add azamkhanuk/claude-plugins` where `claude plugin marketplace list` has no `azamkhanuk` yet and then `claude plugin install context-central@azamkhanuk`, or put the same JSON in each registered repo as well, written as above and asking for each whether shared or for this machine only. Where `claude plugin list` shows `context-central@context-central` installed for the person too, and `claude plugin marketplace list` gives its marketplace as `azamkhanuk/context-central`, say that it is to be uninstalled once this session is done, with `claude plugin uninstall context-central@context-central`, so that one copy loads. Where its marketplace is any other repository, it is a fork the person runs on purpose: leave it, and say that it and `context-central@azamkhanuk` enabled together load two copies, which `context-central doctor` reports, so they keep the one they use. A copy installed for the person loads in every session with no trust prompt to wait for, and a release reaches it by `claude plugin update context-central@azamkhanuk`, or by itself where auto-update is on. One installed for a single project, with `--scope project` or `--scope local`, loads in sessions started in that project once its folder has been trusted, and is updated the same way. A launcher finds a copy only where Claude Code has recorded an install: the one for the project the launcher's own file sits in, or else the person's. With neither, `CONTEXT_CENTRAL_CLI` names the plugin's `bin/context-central` file.",
    ],
  },
  {
    heading: "Settings a session at the map's root will not load",
    paragraphs: [
      "Layout `root` only. A session started at the estate root loads none of the repos' own settings. Read each registered repo's `.claude/settings.json`, `.claude/settings.local.json` and `.mcp.json`, and list every `permissions.deny` rule, `permissions.ask` rule and MCP server name found, by repo. Offer to copy them up into the map's settings and `.mcp.json`; copy only what the person picks.",
    ],
  },
]
