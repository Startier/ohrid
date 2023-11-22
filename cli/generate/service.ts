import { mkdir } from "fs/promises";
import { Config, getCurrentConfig } from "../config";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";
import { resolvePath } from "../resolve";
import { Command, CommandOption } from "../command";

export default <Command>{
  name: "service",
  description: "generates services and entrypoints",
  options: [
    { name: "name", description: "the name of the service", required: true },
  ] as CommandOption[],
  flags: [
    {
      name: "main",
      description: "the file name of the entrypoint function",
      required: false,
    },
    {
      name: "amount",
      description: "how many nodes should be allocated for this service",
      required: false,
    },
    {
      name: "exports",
      description: "export style for the generated module",
      required: false,
    },
  ],
  async execute({ name, amount, main, exports }, _program) {
    const config = await getCurrentConfig();
    const services = config.services ?? {};

    if (name in services) {
      log(
        "warning",
        `The service '${name}' was already in 'services.json', configuration was overriden`
      );
    }

    config.services = config.services ?? {};
    config.services[name] = {
      amount: Number(amount ?? "1"),
      entrypoint: main ? `src/${main}` : undefined,
    };

    if (main) {
      const entrypoint = main;
      await mkdir(resolvePath(`src/${entrypoint}`, config), {
        recursive: true,
      });

      const exportType =
        (exports ?? config.exports) === "named" ? "named" : "default";

      const ts = await shouldGenerateTypescript(config);
      const entrypointFunction = `  
  async function main(client${ts ? ": Client" : ""}) {} 
  `;
      if (ts) {
        await dumpFile(
          `
  import type { Client } from "@startier/ohrid";
  ${entrypointFunction}
  ${exportType === "named" ? "export { main }" : "export default main"};    
  `.trim() + "\n",
          `src/${entrypoint}/index.ts`,
          config
        );
      } else {
        await dumpFile(
          `
  Object.defineProperty(exports, "__esModule", { value: true });
  ${entrypointFunction}
  ${exportType === "named" ? "exports.main = main" : "exports.default = main"};
  `.trim() + "\n",
          `src/${entrypoint}/index.js`,
          config
        );
      }
    }
  },
};
