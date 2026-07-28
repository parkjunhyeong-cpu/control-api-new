// 부트스트랩: gRPC 서버 기동 + config 파일 watch (guide.md §8)
// 기존 REST `PUT /config` -> pushConfig() 를 "파일 저장 = 재전송" 으로 대체.

import { startGrpcServer } from "./server.js";
import { broadcast, listStreams } from "./streams.js";
import { encodeConfigMessage } from "./handlers/connect.js";
// TODO: loadConfig, CONFIG_FILE import (constants/loadConfig.js)

// TODO: startGrpcServer() 호출

// TODO: fs.watch(CONFIG_FILE, ...) 로 파일 변경 감지 -> 디바운스 -> broadcast(encodeConfigMessage(loadConfig()))

process.on("SIGINT", () => process.exit(0));
