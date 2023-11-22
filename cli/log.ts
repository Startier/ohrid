import { createLogger } from "@mojsoski/logger";
import { subscriberFromWriteStream } from "@mojsoski/streams-io";
import { commit } from "@mojsoski/streams";
import { Log } from "../lib";
export interface LogMessage {
  type: "info" | "output" | "error" | "debug" | "warning";
  message: string;
}

function getColorCode(prefixColor: "green" | "red" | "grey" | "yellow") {
  switch (prefixColor) {
    case "green":
      return "42";
    case "red":
      return "41";
    case "grey":
      return "100";
    case "yellow":
      return "43";
  }
}

function formatWithPrefix(
  message: string,
  prefix: string,
  prefixColor: "green" | "red" | "grey" | "yellow"
) {
  return `\x1b[${getColorCode(
    prefixColor
  )}m\x1b[1m ${prefix} \x1b[0m ${message}\n`;
}

function formatter(log: LogMessage): string {
  switch (log.type) {
    case "info":
      return formatWithPrefix(log.message, "INFO", "green");
    case "output":
      return log.message;
    case "error":
      return formatWithPrefix(log.message, "ERR ", "red");
    case "debug":
      return formatWithPrefix(log.message, "DBG ", "grey");
    case "warning":
      return formatWithPrefix(log.message, "WARN", "yellow");
  }
}

const logger = createLogger<LogMessage>(formatter);
commit(logger.copyToStream(subscriberFromWriteStream(process.stdout)));
let nonErrorDisabled = false;
export default ((
  type: "info" | "output" | "error" | "debug" | "warning",
  message: string
) => {
  if (nonErrorDisabled && type !== "error" && type != "output") {
    return;
  }
  if (type === "debug" && process.env.NODE_ENV !== "development") {
    return;
  }
  logger.log({ type, message });
}) as Log;

export function disableNonError() {
  nonErrorDisabled = true;
}
