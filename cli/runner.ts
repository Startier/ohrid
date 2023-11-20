import { readdir } from "fs/promises";
import log from "./log";
import { Config, getCurrentConfig } from "./config";
import { Client, Method, ServiceConfig } from "../lib";
import { resolve } from "path";
import { getDriverFromConfig } from "./driver";
import { runService } from "../lib/service";

function getServiceConfig(name: string, config: Config): ServiceConfig {
  config.services ??= {};
  config.services[name] ??= {};
  config.services[name].settings = {
    ...(config.services[name].settings ?? {}),
    ...(config.settings ?? {}),
  };
  return config.services[name];
}

const getFiles = async (source: string) =>
  (await readdir(source, { withFileTypes: true })).map((dirent) => dirent.name);
export default async function start(name: string) {
  const config = await getCurrentConfig();
  log("info", `Loading service '${name}'...`);

  const services = config.services ?? {};
  let path = config.path;
  if (typeof path !== "string") {
    log(
      "warning",
      `Invalid path configuration, will fallback to current directory`
    );
    path = ".";
  }

  if (typeof services[name] !== "object") {
    log("warning", `Invalid service configuration, will fallback to defaults`);

    services[name] = {};
  }

  const driver = await getDriverFromConfig(config, name);
  if (!driver) {
    log("error", `No driver was defined for service '${name}'`);
    throw 1;
  }

  const rpcMethods: Record<string, Method> = {};

  for (const rpcMethodFile of await getFiles(`${path}/rpc`)) {
    try {
      log("debug", `Checking method 'rpc/${rpcMethodFile}'`);

      const methodImport: { default: Method } = await import(
        resolve(`${path}/rpc/${rpcMethodFile}`)
      );
      if (methodImport.default.service !== name) {
        continue;
      }
      if (rpcMethods[methodImport.default.name]) {
        log(
          "error",
          `'rpc/${rpcMethodFile}' tries to redeclare an already declared RPC method`
        );
        throw 1;
      } else {
        rpcMethods[methodImport.default.name] = methodImport.default;
      }
    } catch {
      log("error", `Failed importing RPC method file: rpc/${rpcMethodFile}`);
      throw 1;
    }
  }

  let entrypoint: ((client: Client) => Promise<void | boolean>) | undefined;
  if (typeof services[name].entrypoint === "string") {
    log("info", `Loading entrypoint '${services[name].entrypoint}'...`);

    try {
      const entrypointImport: {
        default: (client: Client) => Promise<void | boolean>;
      } = await import(resolve(`${path}/${services[name].entrypoint}`));
      entrypoint = entrypointImport.default;
    } catch {
      log(
        "error",
        `Failed importing entrypoint file: rpc/${services[name].entrypoint}`
      );
      throw 1;
    }
  }

  log(
    "info",
    `Loaded service '${name}' with ${
      Object.entries(rpcMethods).length
    } method(s)`
  );

  const context = driver.createNode(
    name,
    getServiceConfig(name, config),
    rpcMethods,
    log
  );

  await runService(context, entrypoint);
}
