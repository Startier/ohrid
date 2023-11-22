import log from "./log";
import { Config, getCurrentConfig, getFiles } from "./config";
import { Client, Method, ServiceConfig } from "../lib";
import { resolve } from "path";
import { getDriverFromConfig } from "./driver";
import { runService } from "../lib/service";
import { resolveBasePath, resolvePath } from "./resolve";
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

  for (const externalRpcMethod of config.importedMethods ?? []) {
    const path = externalRpcMethod.module
      ? `${externalRpcMethod.path}/rpc/${externalRpcMethod.method}`
      : resolvePath(
          `${externalRpcMethod.path}/rpc/${externalRpcMethod.method}`,
          config
        );
    log("debug", `Checking external method '${path}'`);
    const importedMethod = await importResource<Method, "method">(
      path,
      "method"
    );

    if (!importedMethod) {
      log("error", `'${path}' has no export 'method' or 'default'`);
      throw 1;
    }

    if (importedMethod.service !== name) {
      continue;
    }
    if (rpcMethods[importedMethod.name]) {
      log(
        "error",
        `'${path}' tries to redeclare an already declared RPC method`
      );
      throw 1;
    } else {
      rpcMethods[importedMethod.name] = importedMethod;
    }
  }

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
      let entrypointPath = "";
      if (services[name].external) {
        entrypointPath = services[name].external?.module
          ? `${services[name].external?.path}/${services[name].entrypoint}`
          : resolvePath(
              `${services[name].external?.path}/${services[name].entrypoint}`,
              config
            );
      } else {
        entrypointPath = resolve(`${path}/${services[name].entrypoint}`);
      }
      entrypoint = await importResource<
        (client: Client) => Promise<void | boolean>,
        "main"
      >(entrypointPath, "main");

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

  try {
    const context = driver.createNode(
      name,
      getServiceConfig(name, config),
      rpcMethods,
      log
    );
    await runService(context, entrypoint);
  } catch (e) {
    log("error", `Service setup failed: ${e}`);
    throw 1;
  }
}
