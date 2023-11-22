import { mkdir } from "fs/promises";
import { getCurrentConfig } from "../config";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";
import { resolvePath } from "../resolve";
import { Command, CommandOption } from "../command";

export default <Command>{
  name: "method",
  description: "generates RPC methods",
  options: [
    { name: "name", description: "the name of the method", required: true },
  ] as CommandOption[],
  flags: [
    {
      name: "service",
      description: "the service that contains the method",
      required: true,
    },
    {
      name: "exports",
      description: "export style for the generated module",
      required: false,
    },
  ],
  async execute({ name, service, exports }, _program) {
    const config = await getCurrentConfig();
    const services = config.services ?? {};

    if (!(service in services)) {
      log("warning", `The service '${service}' is not in 'services.json'.`);
    }

    await mkdir(resolvePath(`rpc/${name}`, config), { recursive: true });

    const exportType =
      (exports ?? config.exports) === "named" ? "named" : "default";

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
  },
};
