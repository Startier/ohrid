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

export async function shouldGenerateTypescript(
  config: Config
): Promise<boolean> {
  if (typeof config.typescript === "boolean") {
    return config.typescript;
  }
  const packageDirectory = await getPackageDirectory();
  const packageJson = JSON.parse(
    await loadTextFile("package.json", packageDirectory)
  ) as unknown;

  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "dependencies" in packageJson &&
    typeof packageJson.dependencies === "object" &&
    (packageJson.dependencies as Record<string, any>["typescript"])
  ) {
    config.typescript = true;
    return true;
  }
  if (
    typeof packageJson === "object" &&
    packageJson !== null &&
    "devDependencies" in packageJson &&
    typeof packageJson.devDependencies === "object" &&
    (packageJson.devDependencies as Record<string, any>["typescript"])
  ) {
    config.typescript = true;
    return true;
  }

  config.typescript = false;
  return false;
}

export async function getPackageDirectory(): Promise<string> {
  return (await getRelativeDirOfFile("package.json")) ?? "";
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
