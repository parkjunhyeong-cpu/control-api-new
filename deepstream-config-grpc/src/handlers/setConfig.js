import { setConfig, getConfig } from "../constants/configStore.js";
import { broadcast } from "../streams.js";

export function setConfigHandler(call, callback) {
  const { input } = call.request;
  if (!input) {
    callback(null, { ok: false, message: "input config required" });
    return;
  }

  try {
    setConfig(input);
  } catch (e) {
    callback(null, { ok: false, message: e.message });
    return;
  }

  broadcast({ input: getConfig() });
  callback(null, { ok: true, message: "" });
}
