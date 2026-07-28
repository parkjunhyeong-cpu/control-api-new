import { encode } from "@msgpack/msgpack";
import { registerStream, removeStream } from "../streams.js";
// TODO: loadConfig 소스 결정 (constants/loadConfig.js 또는 deepstream.config.js default import)

export const encodeConfigMessage = (cfg) => ({
  config: Buffer.from(encode(cfg)),
});

export function connectHandler(call) {
  // TODO: guide.md §6 참고하여 구현
  // - metadata 에서 x-tenant-id / x-component 추출 (인증 없음, 라우팅 키로만 사용)
  // - registerStream()
  // - 접속 즉시 config 1회 전송 (call.write)
  // - call.on("data") 로 Up 메시지 반드시 소비 (미소비 시 flow control 로 스트림 정체)
  // - call.on("end") / call.on("error") 에서 removeStream()
  throw new Error("connectHandler() not implemented");
}
