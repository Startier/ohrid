import { readdir } from "fs/promises";
import log from "./log";
import { Config, getCurrentConfig } from "./config";
import { Client, Method, ServiceConfig } from "../lib";
import { resolve } from "path";
import { getDriverFromConfig } from "./driver";
import { runService } from "../lib/service";
import { resolveBasePath } from "./resolve";
import { importResource } from "./imports";

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
  const path = resolveBasePath(config);

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

      const importedMethod = await importResource<Method, "method">(
        resolve(`${path}/rpc/${rpcMethodFile}`),
        "method"
      );

      if (!importedMethod) {
        log(
          "error",
          `'rpc/${rpcMethodFile}' has no export 'method' or 'default'`
        );
        throw 1;
      }
      if (importedMethod.service !== name) {
        continue;
      }
      if (rpcMethods[importedMethod.name]) {
        log(
          "error",
          `'rpc/${rpcMethodFile}' tries to redeclare an already declared RPC method`
        );
        throw 1;
      } else {
        rpcMethods[importedMethod.name] = importedMethod;
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
      entrypoint = await importResource<
        (client: Client) => Promise<void | boolean>,
        "main"
      >(resolve(`${path}/${services[name].entrypoint}`), "main");

      if (!entrypoint) {
        throw 1;
      }
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
