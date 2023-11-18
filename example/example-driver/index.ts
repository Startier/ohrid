import { Context, Driver, Log, Method, ServiceConfig } from "@startier/ohrid";
import express from "express";
import { Server, Socket } from "socket.io";
import { createServer } from "node:http";
import { io } from "socket.io-client";
import {
  ErrorCodes,
  RpcClient,
  RpcError,
  client,
  createClientDriver,
  server,
} from "@mojsoski/rpc";
import {
  blockFromSubject,
  commit,
  createSubject,
  createSubscriber,
} from "@mojsoski/streams";
const driver: Driver = {
  async handleDockerCompose({
    service,
    block,
    appendLine,
    dockerServiceName,
    store,
  }) {
    const settings = Object.entries(service.settings ?? {});
    if (service.settings?.port) {
      appendLine("ports:");
      await block(async () => {
        appendLine(`- "${service.settings?.port}:${service.settings?.port}"`);
      });
    }
    if (service.settings?.hub) {
      if (store.hubImage) {
        throw new Error("More than one hub was defined");
      }
      store.hubService = dockerServiceName;
    } else {
      if (store.hubService && store.hubPort) {
        if (!settings.find((item) => item[0] === "remoteHub")) {
          settings.push([
            "remoteHub",
            `http://${store.hubService}:${store.hubPort}`,
          ]);
        }
      }
      appendLine("depends_on:");
      await block(async () => {
        appendLine(`- ${store.hubService}`);
      });
    }

    if (typeof service.settings?.environment === "object") {
      settings.push(
        ...Object.entries(service.settings.environment).map(
          ([key, value]) => ["ENV:" + key, value.toString()] as [string, string]
        )
      );
    }

    if (settings.length > 0) {
      appendLine("environment:");
      await block(async () => {
        for (const [key, value] of settings) {
          if (typeof value === "object") {
            continue;
          }
          if (key.startsWith("ENV:")) {
            appendLine(`${key.slice("ENV:".length)}: ${value}`);
          }
          switch (key) {
            case "port":
              appendLine(`PORT: ${value}`);
              store.hubPort = value.toString();
              break;
            case "remoteHub":
              appendLine(`REMOTE_HUB: ${value}`);
              break;
          }
        }
      });
    }
  },
  getDockerfileExtensions(place, services) {
    if (place === "afterRunner") {
      return Object.values(services ?? {})
        .map((item) =>
          item.settings?.port ? `EXPOSE ${item.settings?.port}` : ""
        )
        .join("\n");
    }
    return "";
  },
  createNode(
    name: string,
    config: ServiceConfig,
    rpcMethods: Record<string, Method>,
    log: Log
  ): Context {
    if (rpcMethods.invoke) {
      throw new Error(`RPC method name 'invoke' is not allowed`);
    }

    if (config.settings && config.settings["hub"]) {
      const app = express();
      const httpServer = createServer(app);
      const serverSocket = new Server(httpServer);

      const port = process.env.PORT
        ? Number(process.env.PORT)
        : typeof config.settings["port"] === "number"
        ? config.settings["port"]
        : undefined;

      if (typeof port !== "number") {
        throw new Error("Port was not specified");
      }

      let interfaces: {
        client: RpcClient<any>;
        supportedMethods: string[];
        name: string;
      }[] = [];

      let waitHandles: {
        resolve: (client: {
          client: RpcClient<any>;
          supportedMethods: string[];
          name: string;
        }) => void;
        reject: (rpcError: RpcError) => void;
        methodName: string;
      }[] = [];

      async function callWithInterface(
        methodName: string,
        ...params: unknown[]
      ) {
        log("debug", `Resolving ${methodName}...`);
        let node = interfaces.find((item) =>
          item.supportedMethods.includes(methodName)
        );
        if (!node) {
          log("debug", `Method '${methodName}' not available`);
          node = await new Promise<{
            client: RpcClient<any>;
            supportedMethods: string[];
            name: string;
          }>((resolve, reject) => {
            waitHandles.push({ resolve, reject, methodName });
          });
          log("debug", `Method '${methodName}' available`);
        }
        log("debug", `Resolved '${methodName}' on node '${node.name}'`);
        return await node.client[methodName](...params);
      }

      rpcMethods.invoke = {
        service: name,
        name: "invoke",
        createCaller() {
          return async (methodName: string, ...params) =>
            callWithInterface(methodName, ...params);
        },
      };

      const createInterface = ({
        supportedMethods,
        socket: clientSocket,
        name,
      }: {
        supportedMethods: string[];
        socket: Socket;
        name: string;
      }): {
        client: RpcClient<any>;
        supportedMethods: string[];
        name: string;
      } => {
        const jsonClient = client<{ [k: string]: any }>(
          createClientDriver(async function* (source) {
            for await (const request of source) {
              clientSocket.emit("request", request);
              yield await new Promise<string>((resolve) => {
                const handler = (response: string) => {
                  resolve(response);
                  clientSocket.off("response", handler);
                };
                clientSocket.on("response", handler);
              });
            }
          })
        );
        return { client: jsonClient, supportedMethods, name };
      };
      serverSocket.on("connection", (socket) => {
        log("debug", `Node connected: ${socket.client.conn.remoteAddress}`);
        let currentInterface:
          | { client: RpcClient<any>; supportedMethods: string[]; name: string }
          | undefined = undefined;

        socket.on("interface", ({ supportedMethods, name }) => {
          if (currentInterface !== undefined) {
            throw new Error("Cannot redefine interface");
          }
          log(
            "debug",
            `Created interface for '${socket.client.conn.remoteAddress}' (service: ${name}) with ${supportedMethods.length} method(s)`
          );

          currentInterface = createInterface({
            supportedMethods,
            socket,
            name,
          });

          interfaces.push(currentInterface);

          for (const waitHandle of waitHandles) {
            if (supportedMethods.includes(waitHandle.methodName)) {
              waitHandle.resolve(currentInterface);
              waitHandles = waitHandles.filter((item) => item !== waitHandle);
            }
          }
        });

        const subscriber = createSubscriber<string>({
          data(item) {
            socket.emit("response", item);
          },
          end() {
            socket.disconnect();
          },
        });

        const impl = Object.fromEntries(
          Object.entries(rpcMethods).map(([key, method]) => {
            const handler = (context: Context, ...params: unknown[]) => {
              return method.createCaller(context)(...params);
            };
            return [key, handler] as [string, typeof handler];
          })
        );

        const sub = createSubject<string>();
        socket.on("request", (data) => {
          sub.notify(data);
        });

        commit(
          blockFromSubject(sub.subject)
            .pipe(
              server<Context>(impl, async () => {
                return {
                  log,
                  currentService: name,
                  remoteCall(method, ...args): Promise<any> {
                    return callWithInterface(method.name, ...args);
                  },
                };
              })
            )
            .copyTo(subscriber)
        );

        socket.on("disconnect", () => {
          log(
            "debug",
            `Node disconnected: ${socket.client.conn.remoteAddress}`
          );
          interfaces = interfaces.filter((item) => item !== currentInterface);
        });
      });

      httpServer.listen(port, () => {
        log("info", `Hub server is running on port: ${port}`);
      });

      return {
        currentService: name,
        log,
        async remoteCall(method, ...params): Promise<any> {
          return await callWithInterface(method.name, ...params);
        },
      };
    }

    const remoteHubAddress = process.env.REMOTE_HUB
      ? process.env.REMOTE_HUB
      : config.settings && typeof config.settings["remoteHub"] === "string"
      ? config.settings["remoteHub"]
      : undefined;

    if (!remoteHubAddress) {
      throw new Error("Remote hub address not specified");
    }

    const clientSocket = io(remoteHubAddress, { autoConnect: true });

    clientSocket.on("connect", () => {
      log("info", `Connected to remote hub: ${remoteHubAddress}`);
      clientSocket.emit("interface", {
        supportedMethods: Object.keys(rpcMethods),
        name,
      });
    });

    const sub = createSubject<string>();
    clientSocket.on("request", (data) => {
      sub.notify(data);
    });

    const subscriber = createSubscriber<string>({
      data(item) {
        clientSocket.emit("response", item);
      },
      end() {
        clientSocket.close();
      },
    });

    const impl = Object.fromEntries(
      Object.entries(rpcMethods).map(([key, method]) => {
        const handler = (context: Context, ...params: unknown[]) => {
          return method.createCaller(context)(...params);
        };
        return [key, handler] as [string, typeof handler];
      })
    );

    const jsonClient = client<{ [k: string]: any }>(
      createClientDriver(async function* (source) {
        for await (const request of source) {
          clientSocket.emit("request", request);
          yield await new Promise<string>((resolve) => {
            const handler = (response: string) => {
              resolve(response);
              clientSocket.off("response", handler);
            };
            clientSocket.on("response", handler);
          });
        }
      })
    );

    commit(
      blockFromSubject(sub.subject)
        .pipe(
          server<Context>(impl, async () => {
            return {
              log,
              currentService: name,
              async remoteCall(method, ...params): Promise<any> {
                try {
                  return await jsonClient[method.name](...params);
                } catch (e) {
                  if (
                    e instanceof RpcError &&
                    e.code === ErrorCodes.MethodNotFound
                  ) {
                    return await jsonClient["invoke"](method.name, ...params);
                  }
                  throw e;
                }
              },
            };
          })
        )
        .copyTo(subscriber)
    );
    return {
      currentService: name,
      log,
      async remoteCall(method, ...params): Promise<any> {
        try {
          return await jsonClient[method.name](...params);
        } catch (e) {
          if (e instanceof RpcError && e.code === ErrorCodes.MethodNotFound) {
            return await jsonClient["invoke"](method.name, ...params);
          }
          throw e;
        }
      },
    };
  },
};

export default driver;
