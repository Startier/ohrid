import { Client } from "@startier/ohrid";
import helloFromWorker1 from "../../rpc/hello-from-worker-1";

export default async function main(client: Client) {
  client.log("info", await client.invoke(helloFromWorker1));
}
