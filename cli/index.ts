import { waitForStreams } from "@mojsoski/streams";
import { runProgram } from "./command";
import createProgram from "./program";

createProgram()
  .then((program) => runProgram(program, process.argv.slice(2)))
  .then(async (exitCode) => {
    await waitForStreams();
    process.exit(exitCode ?? 0);
  })
  .catch(async (e) => {
    await waitForStreams();
    if (typeof e === "number") {
      process.exit(e);
    }
    throw e;
  });
