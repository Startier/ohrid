import { getCurrentConfig, saveConfiguration } from "./config";
import { importResource } from "./imports";
import log from "./log";

export default async function generate(resource: string, ...rest: string[]) {
  const config = await getCurrentConfig();
  try {
    const importedItem = await importResource<any, "generate">(
      "./generate/" + resource,
      "generate"
    );
    try {
      log("info", `Generating resource: ${resource}`);
      await importedItem(config, ...rest);
      await saveConfiguration(config);
    } catch (e) {
      if (typeof e === "number") {
        throw e;
      }
      log("error", `Generation failed: ${e}`);
    }
  } catch (e) {
    if (typeof e === "number") {
      throw e;
    }
    log("error", `Invalid resource: ${resource}`);
  }
}
