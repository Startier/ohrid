import { mkdir } from "fs/promises";
import { getCurrentConfig } from "../config";
import log from "../log";
import { dumpFile, shouldGenerateTypescript } from "../utils";
import { resolvePath } from "../resolve";
import { Command, CommandOption } from "../command";
import { existsSync } from "fs";

export default <Command>{
  name: "driver",
  description: "creates communication drivers",
  options: [
    { name: "name", description: "the name of the driver", required: true },
  ] as CommandOption[],
  flags: [
    {
      name: "exports",
      description: "export style for the created module",
      required: false,
    },
  ],
  async execute({ name, exports }, _program) {
    const config = await getCurrentConfig();

    await mkdir(resolvePath(`drivers/${name}`, config), { recursive: true });

    const ts = await shouldGenerateTypescript(config);
    const exportType =
      (exports ?? config.exports) === "named" ? "named" : "default";

    const baseMethod = ` 
const driver${ts ? ": Driver" : ""} = {
  createNode(name, config, _rpcMethods, log) {
    const executeRemoteCalls =
      typeof config.settings?.executeRemoteCalls === "boolean" &&
      config.settings.executeRemoteCalls;
    return {
      currentService: name,
      log,
      async remoteCall(method, ...params)${ts ? ": Promise<any>" : ""} {
        if (!executeRemoteCalls) {
          throw new Error("Remote call not supported");
        }
        return await method.createCaller({
          currentService: method.service,
          log: log,
          remoteCall: this.remoteCall,
        })(...params);
      },
    };
  },
  getDockerfileExtensions() {
    return "";
  },
  async handleDockerCompose() {},
};
  `;
    if (ts) {
      if (existsSync(resolvePath(`drivers/${name}/index.ts`, config))) {
        log(`error`, "Resource already exists");
        throw 1;
      }
      await dumpFile(
        `
import { Driver } from "@startier/ohrid";
${baseMethod}
${exportType === "named" ? "export { driver }" : "export default driver"};
  
    `.trim() + "\n",
        `drivers/${name}/index.ts`,
        config
      );
    } else {
      if (existsSync(resolvePath(`drivers/${name}/index.ts`, config))) {
        log(`error`, "Resource already exists");
        throw 1;
      }

      await dumpFile(
        `
Object.defineProperty(exports, "__esModule", { value: true });
${baseMethod}
${
  exportType === "named"
    ? "exports.driver = driver"
    : "exports.default = driver"
};
    `.trim() + "\n",
        `drivers/${name}/index.js`,
        config
      );
    }
  },
};
