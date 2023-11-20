export const flags: Record<string, string> = {};

export function parseFlags(args: string[]): string[] {
  const nonFlags: string[] = [];
  for (const item of args) {
    if (item.startsWith("--")) {
      const flag = item.slice(2);
      const flagIndex = flag.indexOf("=");
      if (flagIndex !== -1) {
        const flagKey = flag.slice(0, flagIndex);
        const flagValue = flag.slice(flagIndex + 1);
        flags[flagKey] = flagValue;
      } else {
        flags[flag] = JSON.stringify(true);
      }
    } else {
      nonFlags.push(item);
    }
  }
  return nonFlags;
}
