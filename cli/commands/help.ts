import { Command, Program } from "../command";
import log, { disableNonError } from "../log";

async function printCommand(
  command: Command,
  prefix: string,
  program: Program,
  amount: number = 1
): Promise<void> {
  log("output", "    ".repeat(amount));
  log("output", command.name);
  log("output", "\t\t");
  log("output", command.description);
  log("output", "\n");

  log("output", "    ".repeat(amount + 1));
  log("output", `Usage:  \t${prefix} `);
  log("output", command.name);
  for (const option of command.options) {
    if (option.required === "enum") {
      log("output", ` <${option.name}>`);
    } else if (option.required === true) {
      log("output", ` <${option.name}>`);
    } else {
      log("output", ` [${option.name}]`);
    }
  }

  for (const option of command.flags) {
    if (option.required === "enum") {
      log("output", ` --${option.name}=${option.validValues.join("|")}`);
    } else if (option.required === true) {
      log("output", ` --${option.name}=<${option.name}>`);
    } else {
      log("output", ` --${option.name}=[${option.name}]`);
    }
  }
  log("output", "\n");

  if (
    command.options.length === 1 &&
    command.flags.length === 0 &&
    command.returnsHelp &&
    command.options[0].required === "enum"
  ) {
    for (const item of command.options[0].validValues) {
      const result = await command.execute(
        { [command.options[0].name]: item },
        program
      );
      if (typeof result !== "object") {
        continue;
      }
      await printCommand(
        result,
        prefix + " " + command.name,
        program,
        amount + 1
      );
    }
    return;
  }

  for (const option of command.options) {
    log("output", "    ".repeat(amount + 1));
    log("output", option.name + (option.required ? "*" : ""));
    log("output", "\t");
    log(
      "output",
      option.description + (option.required === "enum" ? ", with value:" : "")
    );
    log("output", "\n");
    if (option.required === "enum") {
      for (const value of option.validValues) {
        log("output", "    ".repeat(amount + 2));
        log("output", ` - ${value}\n`);
      }
    }
  }

  for (const option of command.flags) {
    log("output", "    ".repeat(amount + 1));
    log("output", option.name + (option.required ? "*" : ""));
    log("output", "\t");
    log(
      "output",
      option.description + (option.required === "enum" ? ", with value:" : "")
    );
    log("output", "\n");
    if (option.required === "enum") {
      for (const value of option.validValues) {
        log("output", "    ".repeat(amount + 2));
        log("output", ` - ${value}\n`);
      }
    }
  }

  log("output", "\n\n");
}

export default async function createCommand(): Promise<Command> {
  disableNonError();
  return {
    name: "help",
    description: "display this help and exit",
    options: [],
    flags: [],
    async execute({}, program) {
      log("output", `Usage: ${program.name} <command>\n`);
      log("output", `${program.description}\n\n`);
      log("output", `The available commands are:\n`);
      for (const command of program.commands) {
        await printCommand(await command.create(), program.name, program);
      }
    },
  };
}
