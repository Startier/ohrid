import { mkdir } from "fs/promises";
import { Config } from "../config";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";
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

  const exportType = config.exports === "named" ? "named" : "default";
  config.exports = exportType;

  const baseMethod = `  
const method = declareMethod(${JSON.stringify(
    service
  )}, async function ${name.replace(/[\W_]+/g, "_")}(client) {}); 
`;
  if (await shouldGenerateTypescript(config)) {
    await dumpFile(
      `
import { declareMethod } from "@startier/ohrid";
${baseMethod}
${exportType === "named" ? "export { method }" : "export default method"};

  `.trim() + "\n",
      `rpc/${name}/index.ts`,
      config
    );
  } else {
    await dumpFile(
      `
Object.defineProperty(exports, "__esModule", { value: true });
const { declareMethod } = require("@startier/ohrid");
${baseMethod}
${
  exportType === "named"
    ? "exports.method = method"
    : "exports.default = method"
};
  `.trim() + "\n",
      `rpc/${name}/index.js`,
      config
    );
  }
}
