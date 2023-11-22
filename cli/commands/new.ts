import { Command } from "../command";
import { getCurrentConfig, saveConfiguration } from "../config";
import { importResource } from "../imports";
import log from "../log";

export default async function createCommand(): Promise<Command> {
  return {
    name: "new",
    description: "create a resource",
    returnsHelp: true,
    options: [
      {
        name: "resource",
        description: "the resource that gets created",
        required: "enum",
        query: "What resource should get created?",
        validValues: ["method", "service", "driver"],
      },
    ],
    flags: [],
    async execute({ resource }) {
      const config = await getCurrentConfig();
      try {
        const importedItem = await importResource<Command, "create">(
          "./new/" + resource,
          "create"
        );
        if (!importedItem) {
          throw undefined;
        }
        try {
          return {
            ...importedItem,
            async execute(values, program) {
              await importedItem.execute(values, program);
              await saveConfiguration(config);
            },
          };
        } catch (e) {
          if (typeof e === "number") {
            throw e;
          }
          log("error", `Creation failed: ${e}`);
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
