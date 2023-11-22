import { Command, Program } from "./command";
import { importResource } from "./imports";
import log from "./log";

async function loadCommand(command: string) {
  const createCommand = await importResource<
    () => Promise<Command>,
    "createCommand"
  >(`./commands/${command}`, "createCommand");
  if (!createCommand) {
    log("error", `Failed creating command: ${command}`);
    throw 1;
  }
  return await createCommand();
}

const enabledCommands = ["generate", "help", "start"];

export async function createProgram(): Promise<Program> {
  return {
    commands: await Promise.all(enabledCommands.map(loadCommand)),
    helpCommand: "help",
    name: "ohrid",
    description: "Manage and develop distributed nodes.",
  };
}

export default createProgram;
