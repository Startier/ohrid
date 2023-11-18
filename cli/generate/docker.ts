import { dumpFile } from "../utils";
import { Config } from "../config";
import { getDriverFromConfig } from "../driver";
import log from "../log";

async function generateDockerfile(config: Config) {
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

  if (!config.docker) {
    log(
      "warning",
      `Docker configuration was not found, will use default settings that might not work`
    );
  }
  const from = config.docker?.from ?? "node";
  if (!config.docker?.from) {
    log(
      "warning",
      `Docker source image configuration was not found, will default to 'node'`
    );
  }

  if (!config.docker?.script) {
    log(
      "warning",
      `Docker build script configuration not found, will default to 'build'`
    );
  }

  const script = config.docker?.script ?? "build";

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
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 ohrid

COPY --from=builder --chown=ohrid:nodejs /app /app
USER ohrid
${await generateFromDriver("afterRunner")}
`;

  await dumpFile(dockerfile, "Dockerfile");
}

async function generateDockerCompose(config: Config) {
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
          if (config.docker?.image) {
            appendLine(`image: ${config.docker.image}`);
          } else {
            appendLine(`build: .`);
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

  await dumpFile(result, "docker-compose.yml");
}

async function generateImageBuildScript(config: Config) {
  await dumpFile(
    `
#!/bin/sh
docker build . --tag ${config.docker?.image}
`.trim(),
    "build-image.sh"
  );
}

export default async function generateDocker(config: Config) {
  if (config.docker?.image) {
    await generateImageBuildScript(config);
  }
  await generateDockerfile(config);
  await generateDockerCompose(config);
}
