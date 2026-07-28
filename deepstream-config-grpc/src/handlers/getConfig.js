import { getConfig } from "../constants/configStore.js";

export function getConfigHandler(call, callback) {
  callback(null, { input: getConfig() });
}
