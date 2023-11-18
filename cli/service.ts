import { Client, Driver, Method, ServiceConfig, client } from "../lib";
import log from "./log";

export async function runService(
  name: string,
  config: ServiceConfig,
  rpcMethods: Record<string, Method>,
  driver: Driver,
  entrypoint?: (client: Client) => Promise<boolean | void>
) {
  try {
    const context = driver.createNode(name, config, rpcMethods, log);
    const rpcClient = client(context);
    if (entrypoint) {
      try {
        await entrypoint(rpcClient).then((continueNode) => {
          if (!continueNode) {
            context.exit = true;
          }
        });
      } catch (e) {
        const message =
          typeof e === "object" &&
          e !== null &&
          "message" in e &&
          typeof e.message === "string"
            ? e.message
            : JSON.stringify(e);

        log("error", `Entrypoint error: ${message}`);
        context.exit = true;
      }
    }

    await rpcClient.waitForExit();
  } catch (e) {
    const message =
      typeof e === "object" &&
      e !== null &&
      "message" in e &&
      typeof e.message === "string"
        ? e.message
        : JSON.stringify(e);

    log("error", `Error while creating service: ${message}`);
    throw 1;
  }
}
