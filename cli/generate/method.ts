import { mkdir } from "fs/promises";
import { Config } from "../config";
import log from "../log";
import { dumpFile } from "../utils";
import { resolvePath } from "../resolve";

export default async function generateMethod(
  config: Config,
  ...args: string[]
) {
  if (args.length !== 2) {
    log(
      "error",
      "No method name or service specified\nTry 'ohrid generate method [name] [service]' to generate."
    );
    throw 1;
  }

  const services = config.services ?? {};
  const name = args[0];
  const service = args[1];

  if (!(service in services)) {
    log("warning", `The service '${service}' is not in 'services.json'.`);
  }

  await mkdir(resolvePath(`rpc/${name}`, config), { recursive: true });
  await dumpFile(
    `
import { declareMethod } from "@startier/ohrid";

export default declareMethod(
  ${JSON.stringify(service)},
  async function ${name.replace(/[\W_]+/g, "_")}(client) {
  }
); 
`.trim() + "\n",
    `rpc/${name}/index.ts`,
    config
  );
}
