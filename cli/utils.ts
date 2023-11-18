import { blockFromAsyncIterable, commit } from "@mojsoski/streams";
import { subscriberFromWriteStream } from "@mojsoski/streams-io";
import log from "./log";
import { open } from "fs/promises";

export async function dumpFile(text: string, filename: string) {
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
          (await open(filename, "w")).createWriteStream()
        )
      )
  );
  log("info", `Generated '${filename}' (${text.length} bytes)`);
}
