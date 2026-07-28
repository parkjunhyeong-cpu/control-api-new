// 부트스트랩: gRPC 서버 기동.
// 설정 변경은 이제 SetConfig RPC 로 들어오고, WatchConfig 구독자에게 즉시 브로드캐스트된다
// (파일 watch 방식 아님 — handlers/setConfig.js 참고).

import { startGrpcServer } from "./server.js";

startGrpcServer();

process.on("SIGINT", () => process.exit(0));
