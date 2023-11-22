import { dumpFile, getPackageDirectory } from "../utils";
import { Config, getCurrentConfig } from "../config";
import { getDriverFromConfig } from "../driver";
import log from "../log";
import { relative, resolve } from "path";
import { Command } from "../command";

async function generateDockerfile(
  config: Config,
  args: Record<string, string>
) {
  const packageDir = await getPackageDirectory();
  const relativePackagePath = relative(
    resolve(packageDir),
    resolve(config.relativeDir)
  );

  const generateFromDriver = async (
    place:
      | "beforeDeps"
      | "afterDeps"
      | "beforeBuild"
      | "afterBuild"
      | "beforeRunner"
      | "afterRunner"
  ) => {
    let result = "";

    for (const [service, serviceConfig] of Object.entries(
      config.services ?? {}
    )) {
      const driver = await getDriverFromConfig(config, service);
      if (!driver) {
        continue;
      }
      result +=
        driver
          .getDockerfileExtensions(place, {
            [service]: serviceConfig,
          })
          .trim() + "\n";
    }
    return result.trim();
  };

  if (!config.docker && (!args.from || !args.script)) {
    log(
      "warning",
      `Docker configuration was not found, will use default settings that might not work`
    );
  }
  const from = args.from ?? config.docker?.from ?? "node";
  if (!config.docker?.from && !args.from) {
    log(
      "warning",
      `Docker source image configuration was not found, will default to 'node'`
    );
  }
  const script = args.script ?? config.docker?.script ?? "build";
  if (!config.docker?.script && !args.script) {
    log(
      "warning",
      `Docker build script configuration not found, will default to 'build'`
    );
  }

  const dockerfile = `
FROM ${from} AS deps
${await generateFromDriver("beforeDeps")}
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
${await generateFromDriver("afterDeps")}

FROM ${from} AS builder
${await generateFromDriver("beforeBuild")}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run ${script}
${await generateFromDriver("afterBuild")}

FROM ${from} AS runner
${await generateFromDriver("beforeRunner")}
ENV NODE_ENV production
RUN adduser --system --group --home /app ohrid
COPY --from=builder --chown=ohrid:ohrid /app /app
USER ohrid
WORKDIR /app/${relativePackagePath}
${await generateFromDriver("afterRunner")}
`;

  await dumpFile(dockerfile, "Dockerfile", config);
}

async function generateDockerCompose(
  config: Config,
  args: Record<string, string>
) {
  const packageDir = await getPackageDirectory();
  const relativeToPackagePath = relative(
    resolve(config.relativeDir),
    resolve(packageDir)
  );

  let result = "";
  let spaces = 0;

  const store: Record<string, string | undefined> = {};

  const appendLine = (text: string) => {
    for (let i = 0; i < spaces; i++) {
      result += " ";
    }
    result += text + "\n";
  };

  const block = async (cb: () => Promise<void>) => {
    spaces += 2;
    await cb();
    spaces -= 2;
  };

  appendLine("version: '3'");
  appendLine("services:");
  await block(async () => {
    for (const [service, serviceConfig] of Object.entries(
      config.services ?? {}
    )) {
      const driver = await getDriverFromConfig(config, service);
      const amount = serviceConfig.amount ?? 1;
      for (let idx = 0; idx < amount; idx++) {
        const dockerServiceName = `${service}-node-${idx}`;
        appendLine(`${dockerServiceName}:`);
        await block(async () => {
          if (args.image || config.docker?.image) {
            appendLine(`image: ${args.image ?? config.docker?.image}`);
          } else {
            appendLine(`build:`);
            await block(async () => {
              appendLine(`context: ./${relativeToPackagePath}`);
              appendLine(`dockerfile: ./Dockerfile`);
            });
          }
          appendLine(`command: npx ohrid start ${service}`);
          await driver?.handleDockerCompose({
            service: serviceConfig,
            appendLine,
            block,
            store,
            dockerServiceName,
          });
        });
      }
    }
  });

  await dumpFile(result, "docker-compose.yml", config);
}

async function generateImageBuildScript(
  config: Config,
  { image }: Record<string, string>
) {
  const packageDir = await getPackageDirectory();
  await dumpFile(
    `
#!/bin/sh
docker build ${JSON.stringify(resolve(packageDir))} -f ${JSON.stringify(
      `./Dockerfile`
    )} --tag ${image ?? config.docker?.image}
`.trim(),
    "build-image.sh",
    config
  );
}

export default <Command>{
  name: "docker",
  description: "generates docker-related files",
  options: [],
  flags: [
    {
      name: "from",
      description: "the source image for the Dockerfile",
      required: false,
    },
    {
      name: "script",
      description: "the npm build script that is used to build the code",
      required: false,
    },
    {
      name: "image",
      description: "the name of the image that gets built",
      required: false,
    },
  ],
  async execute(values, _program) {
    const config = await getCurrentConfig();
    if (values.image ?? config.docker?.image) {
      await generateImageBuildScript(config, values);
    }
    await generateDockerfile(config, values);
    await generateDockerCompose(config, values);
  },
};
