import { resolve } from "path";
import { Driver } from "../lib";
import log from "./log";
import { Config } from "./config";
import { resolveBasePath } from "./resolve";

async function loadDriver(path: string, driverPath: string) {
  let driver: Driver | undefined;
  try {
    log("debug", `Loading driver '${driverPath}'...`);
    const driverImport: {
      default: Driver;
    } = await import(resolve(`${path}/${driverPath}`));
    driver = driverImport.default;
  } catch {
    try {
      log("debug", `Loading driver '${driverPath}' from modules...`);

      const driverImport: {
        default: Driver;
      } = await import(`${driverPath}`);
      driver = driverImport.default;
    } catch {
      log("error", `Failed importing driver: ${driverPath}`);
      throw 1;
    }
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
