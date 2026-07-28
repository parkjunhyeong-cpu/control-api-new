import { setConfig, getConfig } from "../constants/configStore.js";
import { broadcast } from "../streams.js";

export function setConfigHandler(call, callback) {
  const { config } = call.request;
  if (!config) {
    callback(null, { ok: false, message: "config required" });
    return;
  }

  try {
    setConfig(config);
  } catch (e) {
    callback(null, { ok: false, message: e.message });
    return;
  }

  broadcast({ config: getConfig() });
  callback(null, { ok: true, message: "" });
}
