import { mkdir } from "fs/promises";
import { Config } from "../config";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";
import { resolvePath } from "../resolve";

export default async function generateMethod(
  config: Config,
  ...args: string[]
) {
  if (args.length < 1) {
    log(
      "error",
      "No service name specified\nTry 'ohrid generate service [name] [amount?] [entrypoint?]' to generate."
    );
    throw 1;
  }

  const services = config.services ?? {};
  const name = args[0];

  if (name in services) {
    log(
      "warning",
      `The service '${name}' was already in 'services.json', configuration was overriden`
    );
  }

  config.services = config.services ?? {};
  config.services[name] = {
    amount: args.length > 1 ? Number(args[1]) : undefined,
    entrypoint: args.length > 2 ? `src/${args[2]}` : undefined,
  };

  if (args.length > 2) {
    const entrypoint = args[2];
    await mkdir(resolvePath(`src/${entrypoint}`, config), { recursive: true });

    const exportType = config.exports === "named" ? "named" : "default";
    config.exports = exportType;

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
}
