export class PluginError extends Error {}

export class UsageError extends PluginError {}

export class ConfigError extends PluginError {}

export function messageOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/\s*\n\s*/g, ' ')
}
