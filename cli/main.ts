import { flags, parseFlags } from "./flags";
import generate from "./generator";
import log from "./log";
import start from "./runner";

const helpString = `
Usage: ohrid OPERATION
Manage services according to the operation and it's arguments.

Operations are:
    help                    display this help and exit
    generate  RESOURCE      generate a resource
    start     SERVICE       start a service
    
Resources are:
    docker                  generates docker-related files
    method                  generates RPC methods
    service                 generates services and entrypoints

The options for 'services.json' are:
    path                    relative path to the built files
    driver                  the communication driver (module or relative-path)
    services                the list of services (object)
    docker                  docker configuration (object)
    
    services.entrypoint     a script that gets run when a service gets started
    services.amount         the amount of nodes that will be started using docker
    services.settings       driver-specific settings (object)
    services.driver         override the communication driver (module or relative-path)
    
    docker.from             the source image for the Dockerfile
    docker.script           npm script that gets called in the build step
    docker.image            the tag of the docker image that will be built
`;

function help() {
  log("output", helpString.trim() + "\n");
}

export default async function main(args: string[]): Promise<number | void> {
  if (args.length === 0) {
    log("error", "Invalid syntax\nTry 'ohrid help' for more information.");
    return;
  }
  args = parseFlags(args);

  switch (args[0]) {
    case "help":
      if (args.length !== 1) {
        log("error", "Invalid syntax\nTry 'ohrid help' for more information.");
        return;
      }
      help();
      break;
    case "generate":
      if (args.length < 2) {
        log("error", "Invalid syntax\nTry 'ohrid help' for more information.");
        return;
      }
      await generate(args[1], ...args.slice(2));
      break;
    case "start":
      if (args.length !== 2) {
        log("error", "Invalid syntax\nTry 'ohrid help' for more information.");
        return;
      }
      await start(args[1]);
      break;
    default:
      log(
        "error",
        `Unrecognized operation '${args[0]}'\nTry 'ohrid help' for more information.`
      );
  }
}
