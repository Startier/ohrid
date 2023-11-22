import { Command } from "../command";
import { getCurrentConfig, saveConfiguration } from "../config";
import { importResource } from "../imports";
import log from "../log";

export default async function createCommand(): Promise<Command> {
  return {
    name: "generate",
    description: "generate a resource",
    returnsHelp: true,
    options: [
      {
        name: "resource",
        description: "the resource that gets generated",
        required: "enum",
        query: "What resource should get generated?",
        validValues: ["docker"],
      },
    ],
    flags: [],
    async execute({ resource }) {
      const config = await getCurrentConfig();
      try {
        const importedItem = await importResource<Command, "generate">(
          "./generate/" + resource,
          "generate"
        );
        if (!importedItem) {
          throw undefined;
        }
        try {
          return {
            ...importedItem,
            async execute(values, program) {
              log("info", `Generating resource: ${resource}`);
              await importedItem.execute(values, program);
              await saveConfiguration(config);
            },
          };
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
    },
  };
}
