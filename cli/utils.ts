import {
  blockFromAsyncIterable,
  blockFromSubject,
  commit,
} from "@mojsoski/streams";
import {
  subjectFromReadStream,
  subscriberFromWriteStream,
} from "@mojsoski/streams-io";
import log from "./log";
import { open } from "fs/promises";
import { getRelativeDirOfFile, openFile, resolvePath } from "./resolve";
import { Config } from "./config";

export async function getPackageDirectory(): Promise<string> {
  return getRelativeDirOfFile("package.json");
}

export async function loadTextFile(file: string, relativeDir: string) {
  const decoder = new TextDecoder();
  return Array.from(
    await blockFromSubject(
      subjectFromReadStream(
        (await openFile(file, relativeDir)).createReadStream()
      )
    )
      .map((buffer) => decoder.decode(buffer))
      .sync()
  ).join("");
}

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
