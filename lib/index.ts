export interface Context {
  currentService: string;
  log: Log;
  exit?: boolean;
  remoteCall<
    TService extends string = string,
    TParams extends any[] = any[],
    TReturn = any
  >(
    method: Method<TService, TParams, TReturn>,
    ...params: TParams
  ): Promise<Awaited<TReturn>>;
}

export type ServiceConfig = {
  entrypoint?: string;
  amount?: number;
  settings?: Record<string, object | string | number | boolean>;
  driver?: string;
  external?: {
    path: string;
    module: boolean;
  };
};

export type Log = (
  type: "info" | "output" | "error" | "debug" | "warning",
  message: string
) => void;

export interface Driver {
  createNode(
    name: string,
    config: ServiceConfig,
    rpcMethods: Record<string, Method>,
    log: Log
  ): Context;
  handleDockerCompose(item: {
    service: ServiceConfig;
    dockerServiceName: string;
    appendLine: (text: string) => void;
    block: (cb: () => Promise<void>) => Promise<void>;
    store: Record<string, string | undefined>;
  }): Promise<void>;
  getDockerfileExtensions(
    place:
      | "beforeDeps"
      | "afterDeps"
      | "beforeBuild"
      | "afterBuild"
      | "beforeRunner"
      | "afterRunner",
    serviceConfigs: Record<string, ServiceConfig> | undefined
  ): string;
}

export interface Method<
  TService extends string = string,
  TParams extends any[] = any[],
  TReturn = any
> {
  createCaller(
    context: Context
  ): (...params: TParams) => Promise<Awaited<TReturn>>;
  service: TService;
  name: string;
}

export interface Client {
  invoke<TService extends string, TParams extends any[], TReturn>(
    method:
      | Method<TService, TParams, TReturn>
      | Promise<{ default: Method<TService, TParams, TReturn> }>,
    ...params: TParams
  ): Promise<Awaited<TReturn>>;
  waitForExit: () => Promise<void>;
  log: Log;
}

export function client(context: Context): Client {
  return {
    log: context.log,
    async invoke<TService extends string, TParams extends any[], TReturn>(
      method:
        | Method<TService, TParams, TReturn>
        | Promise<{ default: Method<TService, TParams, TReturn> }>,
      ...params: TParams
    ): Promise<Awaited<TReturn>> {
      if (method instanceof Promise) {
        const item = await method;
        return await item.default.createCaller(context)(...params);
      }
      return await method.createCaller(context)(...params);
    },
    waitForExit() {
      return new Promise<void>((resolve) => {
        function checkExit() {
          if (context.exit) {
            resolve();
          } else {
            setTimeout(checkExit, 100);
          }
        }
        checkExit();
      });
    },
  };
}

export function declareMethod<
  TService extends string,
  TParams extends any[],
  TReturn
>(
  service: TService,
  method: (context: Client, ...params: TParams) => TReturn
): Method<TService, TParams, TReturn> {
  return {
    service,
    name: method.name,
    createCaller(context) {
      const methodObj = this;
      return async function (...params): Promise<Awaited<TReturn>> {
        if (context.currentService === service) {
          return await method(client(context), ...params);
        }

        return context.remoteCall(methodObj, ...params);
      };
    },
  };
}
