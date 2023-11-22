import { flags, parseFlags } from "./flags";
import log from "./log";

export type CommandOption = {
  name: string;
  description: string;
} & (
  | { required: true; query: string }
  | { required: false }
  | { required: "enum"; query: string; validValues: string[] }
);

export type Command = {
  name: string;
  description: string;
  options: CommandOption[];
  flags: CommandOption[];
  returnsHelp?: boolean;
  execute: (
    values: Record<string, string>,
    program: Program
  ) => Promise<number | void | Command>;
};

export type Program = {
  helpCommand: string;
  commands: { prefix: string; create: () => Promise<Command> }[];
  name: string;
  description: string;
};

async function needsOption(
  option: CommandOption,
  flag: boolean
): Promise<string> {
  log("error", `${flag ? "Flag" : "Option"} ${option.name} is required`);
  if (option.required === "enum" && option.validValues.length > 0) {
    const tryString = `Try:\n - ${option.validValues.join("\n - ")}\n`;
    log("output", tryString);
  }

  throw 1;
}

function parseError(program: Program, error: string) {
  log(
    "error",
    `${error}\nTry '${program.name} ${program.helpCommand}' for more information.`
  );
  throw 1;
}

export async function executeCommand(
  program: Program,
  command: Command,
  args: string[]
): Promise<number | void> {
  if (args.length !== command.options.length) {
    log(
      "debug",
      `Got ${args.length} argument(s), while expecting ${command.options.length}`
    );
  }
  let idx = 0;
  const values: Record<string, string> = {};

  for (const item of command.options) {
    const currentArg = args[idx++];
    if (!currentArg) {
      if (item.required) {
        values[item.name] = await needsOption(item, false);
      }
    } else {
      if (item.required === "enum" && !item.validValues.includes(currentArg)) {
        const tryString = `\nTry:\n - ${item.validValues.join("\n - ")}`;
        log(
          "error",
          `'${currentArg}' is not a valid ${item.name}${
            item.validValues.length > 0 ? tryString : ""
          }`
        );
        throw 1;
      }
      values[item.name] = currentArg;
    }
  }

  for (const item of command.flags) {
    if (!flags[item.name]) {
      if (item.required) {
        values[item.name] = await needsOption(item, true);
      }
    } else {
      values[item.name] = flags[item.name];
      delete flags[item.name];
    }
  }

  const result = await command.execute(values, program);
  if (typeof result === "object") {
    return await executeCommand(
      program,
      result,
      args.slice(command.options.length)
    );
  }
  return result;
}

export async function runProgram(
  program: Program,
  args: string[]
): Promise<number | void> {
  try {
    args = parseFlags(args);
    if (!args[0]) {
      parseError(program, "No command specified");
    }
    const commandName = args[0];
    for (const item of program.commands) {
      if (item.prefix === commandName) {
        return await executeCommand(
          program,
          await item.create(),
          args.slice(1)
        );
      }
    }

    parseError(program, `Unknown command specified '${args[0]}'`);
  } catch (e) {
    if (typeof e === "number") {
      return e;
    }
    throw e;
  }
}
