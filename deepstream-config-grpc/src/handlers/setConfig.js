import { setConfig, getConfig } from "../constants/configStore.js";
import { broadcast } from "../streams.js";

export function setConfigHandler(call, callback) {
  // TODO:
  // - call.request.input 유효성 검증
  // - setConfig(call.request.input) 로 스토어 갱신
  // - broadcast({ input: getConfig() }) 로 접속 중인 WatchConfig 구독자에 통지
  // - callback(null, { ok, message })
  callback(new Error("setConfigHandler() not implemented"));
}
