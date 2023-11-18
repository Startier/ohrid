import { subjectFromReadStream } from "@mojsoski/streams-io";
import log from "./log";
import { open } from "fs/promises";
import { blockFromSubject } from "@mojsoski/streams";
import { ServiceConfig } from "../lib";

export type Config = {
  path?: string;
  services?: Record<string, ServiceConfig>;
  driver?: ServiceConfig["driver"];
  docker?: DockerConfig;
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
    cachedConfig = config;
    return config;
  } catch {
    log("error", "Failed parsing services.json");
    throw 1;
  }
}
