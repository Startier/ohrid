import { Command } from "../command";
import { getCurrentConfig } from "../config";
import start from "../runner";

export default async function createCommand(): Promise<Command> {
  const config = await getCurrentConfig();
  return {
    name: "start",
    description: "start a service",
    options: [
      {
        required: "enum",
        name: "service",
        description: "the service that gets started",
        query: "What service should get started?",
        validValues: Object.keys(config.services ?? []),
      },
    ],
    flags: [],
    execute({ service }) {
      return start(service);
    },
  };
}
