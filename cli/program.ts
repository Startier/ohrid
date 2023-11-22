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

const enabledCommands = ["generate", "new", "help", "start", "init"];

export async function createProgram(): Promise<Program> {
  return {
    commands: enabledCommands.map((command) => ({
      prefix: command,
      create: () => loadCommand(command),
    })),
    helpCommand: "help",
    name: "ohrid",
    description: "Manage and develop distributed nodes.",
  };
}

export default createProgram;
