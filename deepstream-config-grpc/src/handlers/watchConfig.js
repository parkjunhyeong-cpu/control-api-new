import { getConfig } from "../constants/configStore.js";
import { addWatcher, removeWatcher } from "../streams.js";

export function watchConfigHandler(call) {
  addWatcher(call);
  call.write({ config: getConfig() });

  call.on("cancelled", () => removeWatcher(call));
  call.on("error", () => removeWatcher(call));
}
