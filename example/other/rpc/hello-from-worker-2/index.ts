import { declareMethod } from "@startier/ohrid";
import helloFromMain from "../../../rpc/hello-from-main";

export default declareMethod(
  "worker-2",
  async function helloFrom(client, name: string) {
    return `${await client.invoke(helloFromMain)} ${name}`;
  }
);
