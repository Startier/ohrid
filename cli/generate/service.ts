import { mkdir } from "fs/promises";
import { Config } from "../config";
import log from "../log";
import { dumpFile } from "../utils";

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
    await mkdir(`src/${entrypoint}`, { recursive: true });
    await dumpFile(
      `
import { Client } from "@startier/ohrid";
export default async function main(client: Client) {
}
`.trim() + "\n",
      `src/${entrypoint}/index.ts`
    );
  }

  await dumpFile(JSON.stringify(config, undefined, 2), "services.json");
}
