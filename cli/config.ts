import { subjectFromReadStream } from "@mojsoski/streams-io";
import log from "./log";
import { open } from "fs/promises";
import { blockFromSubject } from "@mojsoski/streams";
import { ServiceConfig } from "../lib";
import { flags } from "./flags";

export type Config = {
  path?: string;
  services?: Record<string, ServiceConfig>;
  driver?: ServiceConfig["driver"];
  docker?: DockerConfig;
  settings?: ServiceConfig["settings"];
};

export type DockerConfig = {
  from?: string;
  script?: string;
  image?: string;
};

let cachedConfig: Config | undefined;

export async function getCurrentConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  log("debug", `Current config: ${process.cwd()}/services.json`);
  let file = "";
  try {
    const decoder = new TextDecoder();
    file = Array.from(
      await blockFromSubject(
        subjectFromReadStream((await open("services.json")).createReadStream())
      )
        .map((buffer) => decoder.decode(buffer))
        .sync()
    ).join("");
  } catch {
    log("warning", "Failed reading services.json");
    return {};
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
