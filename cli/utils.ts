import { blockFromAsyncIterable, commit } from "@mojsoski/streams";
import { subscriberFromWriteStream } from "@mojsoski/streams-io";
import log from "./log";
import { open } from "fs/promises";
import { resolvePath } from "./resolve";
import { Config } from "./config";

export async function dumpFile(text: string, filename: string, config: Config) {
  const textEncoder = new TextEncoder();

  commit(
    blockFromAsyncIterable<string>(
      (async function* () {
        yield text;
      })()
    )
      .map((item) => textEncoder.encode(item))
      .copyTo(
        subscriberFromWriteStream(
          (await open(resolvePath(filename, config), "w")).createWriteStream()
        )
      )
  );
  log("info", `Generated '${filename}' (${text.length} bytes)`);
}
