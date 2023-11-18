import { getCurrentConfig } from "./config";
import log from "./log";

export default async function generate(resource: string, ...rest: string[]) {
  const config = await getCurrentConfig();
  try {
    const importedItem = await import("./generate/" + resource);
    try {
      log("info", `Generating resource: ${resource}`);
      await importedItem.default(config, ...rest);
    } catch (e) {
      if (typeof e === "number") {
        throw e;
      }
      log("error", "Generation failed");
    }
  } catch (e) {
    if (typeof e === "number") {
      throw e;
    }
    log("error", `Invalid resource: ${resource}`);
  }
}
