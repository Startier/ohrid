import { declareMethod } from "@startier/ohrid";
import helloFromWorker2 from "../../other/rpc/hello-from-worker-2";

export default declareMethod(
  "worker-1",
  async function helloFromWorker1(client) {
    return await client.invoke(helloFromWorker2, "worker-1");
  }
);
