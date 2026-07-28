import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { setConfigHandler } from "./handlers/setConfig.js";
import { getConfigHandler } from "./handlers/getConfig.js";
import { watchConfigHandler } from "./handlers/watchConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROTO_LOAD_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export function startGrpcServer(port = Number(process.env.GRPC_PORT ?? 50051)) {
  const pkgDef = protoLoader.loadSync(
    path.join(__dirname, "../proto/pipeline.proto"),
    PROTO_LOAD_OPTIONS,
  );
  const { ControlApi } = grpc.loadPackageDefinition(pkgDef).deepstream;

  const server = new grpc.Server();
  server.addService(ControlApi.service, {
    SetConfig: setConfigHandler,
    GetConfig: getConfigHandler,
    WatchConfig: watchConfigHandler,
  });

  // 인증 없음 = TLS 없음 (insecure). 사내망 전용 전제.
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error("gRPC bind error:", err);
        process.exit(1);
      }
      console.log(`gRPC server listening :${boundPort} (insecure)`);
    },
  );
  return server;
}
