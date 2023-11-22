import log from "./log";
import { ServiceConfig } from "../lib";
import { flags } from "./flags";
import { resolveRelativeDir } from "./resolve";
import { dumpFile, loadTextFile } from "./utils";
import { readdir } from "fs/promises";

export const getFiles = async (source: string) =>
  (await readdir(source, { withFileTypes: true })).map((dirent) => dirent.name);

export type Config = {
  path?: string;
  services?: Record<string, ServiceConfig>;
  driver?: ServiceConfig["driver"];
  docker?: DockerConfig;
  settings?: ServiceConfig["settings"];
  relativeDir: string;
  typescript?: boolean;
  exports?: "named" | "default";
};

export type DockerConfig = {
  from?: string;
  script?: string;
  image?: string;
};

let cachedConfig: Config | undefined;

export async function saveConfiguration(config: Config) {
  const processedConfig: Partial<Config> = { ...config };
  delete processedConfig.relativeDir;
  await dumpFile(
    JSON.stringify(processedConfig, undefined, 2) + "\n",
    "services.json",
    config
  );
}

export async function getCurrentConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const relativeDir = await resolveRelativeDir();
  log("debug", `Current config: ${relativeDir}/services.json`);
  let file = "";
  try {
    file = await loadTextFile("services.json", relativeDir);
  } catch {
    log("warning", "Failed reading services.json");
    return { relativeDir };
  }
  try {
    const config = JSON.parse(file) as Config;
    if (typeof config !== "object") {
      log("error", "services.json is not an object");
      throw 1;
    }

    for (const flagKey in flags) {
      try {
        const keyParts = flagKey.split(".");
        let configItem: Record<any, any> = config;
        for (let part of keyParts.slice(0, keyParts.length - 1)) {
          try {
            part = JSON.parse(part);
          } catch {}
          if (typeof configItem !== "object") {
            log(
              "error",
              `Cannot override setting of '${flagKey}': got '${typeof configItem}', expected 'object'`
            );
            throw 1;
          }
          if (typeof configItem[part] === "undefined") {
            configItem[part] = {};
          }
          configItem = configItem[part];
        }

        let flagValue = flags[flagKey];

        try {
          flagValue = JSON.parse(flagValue);
        } catch {}

        log(`debug`, `Overriding '${flagKey}' = '${flagValue}'`);
        configItem[keyParts[keyParts.length - 1]] = flagValue;
      } catch (e) {
        log(`error`, `Overriding '${flagKey}' has failed: ${e}`);
        throw 1;
      }
    }
    config.relativeDir = relativeDir;
    cachedConfig = config;
    return config;
  } catch (e) {
    if (typeof e === "number") {
      throw e;
    }
    log("error", "Failed parsing services.json");
    throw 1;
  }
}
