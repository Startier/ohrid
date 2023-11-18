import main from "./main";
import { waitForStreams } from "@mojsoski/streams";

main(process.argv.slice(2))
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
