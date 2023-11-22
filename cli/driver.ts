import { Driver } from "../lib";
import log from "./log";
import { Config } from "./config";
import { resolveBasePath } from "./resolve";
import { importResource } from "./imports";

async function loadDriver(path: string, driverPath: string) {
  let driver: Driver | undefined;
  try {
    log("debug", `Loading driver '${driverPath}'...`);
    driver = await importResource<Driver, "driver">(
      `${path}/${driverPath}`,
      "driver"
    );
  } catch {
    try {
      log("debug", `Loading driver '${driverPath}' from modules...`);
      driver = await importResource<Driver, "driver">(
        `${driverPath}`,
        "driver"
      );
    } catch {
      log("error", `Failed importing driver: ${driverPath}`);
      throw 1;
    }
  }

  if (!driver) {
    log("error", `'${driverPath}' has no export 'driver' or 'default'`);
    throw 1;
  }

  return driver;
}

export async function getDriverFromConfig(config: Config, name?: string) {
  let driver: Driver | undefined = undefined;

  log("debug", `Loading driver for '${name ?? "global"}'`);
  const services = config.services ?? {};
  const path = resolveBasePath(config);
  if (
    name &&
    services[name].driver &&
    typeof services[name].driver === "string"
  ) {
    driver = await loadDriver(path, services[name].driver!);
  } else if (config.driver) {
    driver = await loadDriver(path, config.driver);
  }

  return driver;
}
