import { Client, Context, client } from "./index";

export async function runService(
  context: Context,
  entrypoint?: (client: Client) => Promise<boolean | void>
) {
  try {
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

        context.log("error", `Entrypoint error: ${message}`);
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

    context.log("error", `Error while creating service: ${message}`);
    throw 1;
  }
}
