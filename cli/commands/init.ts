import { existsSync } from "fs";
import { Command } from "../command";
import { Config } from "../config";
import { flags } from "../flags";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";

export default async function createCommand(): Promise<Command> {
  return {
    name: "init",
    description: "create a new project",
    options: [],
    flags: [
      {
        name: "driver",
        required: true,
        description: "the communication driver",
        query: "What driver should get used?",
      },
      {
        name: "path",
        required: false,
        description: "the folder where the JavaScript sources are located",
      },
    ],
    async execute({ driver, path }) {
      if (existsSync("services.json")) {
        log("error", "A project is already initialized");
        throw 1;
      }
      const config = {} as Config;
      if (typeof config !== "object") {
        log("error", "services.json is not an object");
        throw 1;
      }

      config.driver = driver;
      config.path = path ?? ".";
      config.relativeDir = process.cwd();
      config.services = {};
      config.docker = {
        from: "node",
        script: "build",
      };
      config.export = [];
      config.exports = "default";
      config.import = [];
      config.settings = {};
      config.typescript = await shouldGenerateTypescript(config);

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

      const result: Partial<Config> = { ...config };
      delete result.relativeDir;

      await dumpFile(
        JSON.stringify(result, undefined, 2) + "\n",
        "services.json",
        config
      );
    },
  };
}
