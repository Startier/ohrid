import { open, readdir } from "fs/promises";
import { Config } from "./config";
import { resolve } from "path";
import log from "./log";

export function resolveBasePath(config: Config) {
  let path = config.path;
  if (typeof path !== "string") {
    log(
      "warning",
      `Invalid path configuration, will fallback to project directory`
    );
    path = ".";
  }

  return resolvePath(path, config);
}

export function resolvePath(
  file: string,
  relativePathOrConfig: string | Config
) {
  const path =
    typeof relativePathOrConfig === "object"
      ? relativePathOrConfig.relativeDir
      : relativePathOrConfig;

  return resolve(path, file);
}

export async function openFile(
  file: string,
  relativePathOrConfig: string | Config
) {
  return await open(resolvePath(file, relativePathOrConfig));
}

export async function resolveRelativeDir() {
  let relativeDir = process.cwd();

  do {
    const items = await readdir(relativeDir);
    if (items.includes("services.json")) {
      break;
    }
    relativeDir = resolve(relativeDir, "..");
  } while (resolve(relativeDir, "..") !== relativeDir);

  if (!(await readdir(relativeDir)).includes("services.json")) {
    log(
      "error",
      "Reached top of filesystem and couldn't find service configuration"
    );
    throw 1;
  }

  return relativeDir;
}
