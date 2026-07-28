import { getConfig } from "../constants/configStore.js";
import { addWatcher, removeWatcher } from "../streams.js";

export function watchConfigHandler(call) {
  // TODO:
  // - addWatcher(call) 로 등록
  // - 접속 즉시 현재 config 1회 write ({ input: getConfig() })
  // - call.on("cancelled") / call.on("error") 에서 removeWatcher(call)
  throw new Error("watchConfigHandler() not implemented");
}
