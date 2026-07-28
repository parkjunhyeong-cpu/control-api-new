import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { connectHandler } from "./handlers/connect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 주의: keepCase: true 등 로드 옵션은 원본과 한 글자도 다르면 안 된다 (guide.md §7).
const PROTO_LOAD_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export function startGrpcServer(port = Number(process.env.GRPC_PORT ?? 50051)) {
  // TODO: guide.md §7 참고하여 구현
  // - protoLoader.loadSync(path.join(__dirname, "../proto/pipeline.proto"), PROTO_LOAD_OPTIONS)
  // - grpc.loadPackageDefinition 으로 PipelineGateway 획득
  // - new grpc.Server() 생성 후 addService({ Connect: connectHandler })
  // - insecure bind (인증 없음 = TLS 없음, 사내망 전용 전제)
  throw new Error("startGrpcServer() not implemented");
}
