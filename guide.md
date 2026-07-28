# DeepStream Config 전송 전용 gRPC 서버 — 재구현 가이드

기존 `SOLUTION_CONTROL-API`에서 **DeepStream에게 config(schema)를 내려보내는 경로만** 떼어낸
최소 구현 가이드. 전제:

1. **DB 없음** — Mongo `Config` 문서 대신 JS 상수 파일
2. **인증 없음** — `x-api-key` / `TenantSettings` 조회 전부 제거
3. **송신 전용** — Up 메시지(alert/health/ppe/volume/...)는 로그만, 처리 로직 없음

---

## 0. 현재 구조에서 실제로 필요한 것만 추린 결과

기존 경로를 따라가면 config 전송에 필요한 요소는 아래 4개뿐이다.

| 기존 위치                                      | 역할                                                    | 신규에서              |
| ---------------------------------------------- | ------------------------------------------------------- | --------------------- |
| `src/grpc/proto/pipeline.proto`                | `Connect` 양방향 스트림 + `DownMessage.config` (bytes)  | 축소해서 그대로       |
| `src/grpc/server.js`                           | proto 로드, 서버 bind                                   | TLS 분기만 제거       |
| `src/grpc/handlers/connect.handler.js:157-192` | 접속 시 스트림 등록 + config 초기 1회 write             | 인증·DB 조회 제거     |
| `src/utils/pipelineStreams.js`                 | `registerStream` / `removeStream` / `pushDown`          | 거의 그대로           |
| `src/services/config.service.js:38-48`         | config 변경 시 `pipeline`/`web`/`depth-service` 로 push | 파일 변경 감지로 대체 |

**절대 바꾸면 안 되는 계약 3가지** (DeepStream 클라이언트가 이 형태를 기대함):

1. 서비스 경로 = `serdic.pipeline.v1.PipelineGateway/Connect`, **양방향 스트리밍**
2. `DownMessage.config` 는 protobuf 메시지가 아니라 **`bytes`** — 내용물은 **msgpack** 인코딩된 config 객체
3. proto 로드 옵션 `keepCase: true` — snake_case 필드명 유지 (`alert_batch`, `camera_name` 등)

> 클라이언트가 스트림을 먼저 열어야(Up 스트림 open) 서버가 Down 을 write 할 수 있다.
> 서버가 능동적으로 커넥션을 만드는 구조가 아니다.

---

## 1. 디렉터리 구성

```
deepstream-config-grpc/
├─ package.json
├─ proto/
│  └─ pipeline.proto
└─ src/
   ├─ index.js              # 부트스트랩 (서버 기동 + 파일 watch)
   ├─ server.js             # gRPC 서버
   ├─ streams.js            # 스트림 레지스트리 + pushDown
   ├─ handlers/
   │  └─ connect.js         # Connect 핸들러
   └─ constants/
      └─ deepstream.config.js   # ★ DB 대체 상수 파일
```

## 2. package.json

```json
{
  "name": "deepstream-config-grpc",
  "type": "module",
  "private": true,
  "scripts": { "start": "node src/index.js" },
  "dependencies": {
    "@grpc/grpc-js": "^1.10.0",
    "@grpc/proto-loader": "^0.7.10",
    "@msgpack/msgpack": "^3.0.0"
  }
}
```

기존 프로젝트와 동일 버전대를 쓰는 게 안전하다 (`package.json` 참조).

## 3. proto/pipeline.proto (축소판)

Up 쪽은 처리하지 않지만, **클라이언트가 보내는 메시지를 서버가 파싱할 수 있어야 스트림이 끊기지 않으므로
`UpMessage` 정의는 필드 번호까지 원본과 동일하게 유지**한다. 지우면 unknown field 로 흘러가긴 하나,
로깅이 불가능해지고 클라이언트 버전 차이 디버깅이 어려워진다.

```proto
syntax = "proto3";
package serdic.pipeline.v1;

service PipelineGateway {
  rpc Connect(stream UpMessage) returns (stream DownMessage);
}

message UpMessage {
  string tenant_id = 1;
  oneof payload {
    AlertBatch   alert_batch  = 2;
    HealthReport health       = 3;
    PpeViolation ppe          = 4;
    bytes        recon        = 5;
    bytes        volume       = 6;
    bytes        benchmark    = 7;
    ScanResult   scan_result  = 8;
    bytes        sensor_event = 9;
    OrderCreate  order_create = 10;
  }
}

message DownMessage {
  oneof payload {
    bytes        config        = 1;   // ★ msgpack(config object)
    ScanCommand  scan_cmd      = 2;
    BenchmarkCmd benchmark_cmd = 3;
  }
}

message AlertBatch { repeated AlertEvent events = 1; }
message AlertEvent {
  string type = 1; string camera_name = 2; string krName = 3;
  int32 src = 4; string verdict = 5; string item = 6;
  repeated string missing = 7;
}
message HealthReport { int64 last_frame = 1; repeated SourceHealth sources = 2; }
message SourceHealth { string name = 1; bool active = 2; }
message PpeViolation {
  string camera_name = 1; int32 source_id = 2; string object_id = 3;
  repeated string missing = 4; string timestamp = 5;
}
message ScanCommand  { string request_id = 1; string subnet = 2; }
message BenchmarkCmd { string action = 1; string model = 2; }
message ScanResult   { string request_id = 1; bytes data = 2; }
message CamMask      { string camera_name = 1; string mask_polygon = 2; }
message OrderCreate {
  string global_id = 1; string label = 2;
  repeated float world_centroid = 3; repeated CamMask masks = 4;
}
```

`scan_cmd` / `benchmark_cmd` 는 안 쓰더라도 **필드 번호 1번(config)을 고정하기 위해** 남겨두는 편이 낫다.

---

## 4. ★ DB 대체 — 상수 파일

가장 중요한 부분. 기존에는 `Config.findOne({tenantId})` 로 가져온 mongoose 문서를
`toObject({ minimize: false })` 로 평문화해서 보냈다. 즉 DeepStream 이 받는 것은
**`configSchema` 전체 트리의 plain object** 다 (`tenantId`, `deepstream`, `gizmo`,
`volumeSnapshots`, `plantManager`, `inspectionManager`, `createdAt`/`updatedAt`).

실무적으로는 DeepStream 이 `deepstream` 키 아래만 소비하지만, **기존 클라이언트 코드가
`cfg["deepstream"]["input"]["sources"]` 형태로 접근하므로 최상위 래핑을 유지**해야 한다.

### 4-1. 초기 상수값을 뽑는 가장 정확한 방법

직접 손으로 쓰지 말고, 기존 레포에서 스키마 기본값을 1회 덤프해서 시작점으로 삼는다
(레포에 파일을 남기지 않는 인라인 명령):

```bash
# SOLUTION_CONTROL-API 루트에서 — 스키마 기본값 전체를 JSON 으로 출력
node --input-type=module -e '
import Config from "./src/models/config.model.js";
const doc = new Config({ tenantId: "default" });
process.stdout.write(JSON.stringify(doc.toObject({ minimize: false, flattenMaps: true }), null, 2));
' > /tmp/config.default.json
```

운영 중인 실제 값이 필요하면 Mongo 에서 직접:

```bash
mongoexport --uri "$CONTROL_API_MONGO_URI$CONTROL_API_DATABASE" \
  --collection configs --query '{"tenantId":"default"}' --jsonArray --pretty > /tmp/config.live.json
```

### 4-2. src/constants/deepstream.config.js

JSON 을 그대로 써도 되지만, **주석·계산식·환경변수 오버라이드**가 가능한 JS 를 권장한다.

```js
// src/constants/deepstream.config.js
// DB(Config 컬렉션) 대체. 이 객체가 그대로 msgpack 으로 인코딩되어 DeepStream 에 전달된다.
// 최상위 형태는 기존 mongoose configSchema 와 동일하게 유지할 것.

export const TENANT_ID = process.env.TENANT_ID || "default";

const deepstreamConfig = {
  tenantId: TENANT_ID,
  plantManager: "",
  inspectionManager: "",

  deepstream: {
    input: {
      sources: [
        {
          name: "CH0",
          krName: "정문",
          url: "rtsp://192.168.0.10:554/stream1",
          zones: [],
          imagePoints: [],
          groundPoints: [],
          polygon2d: [],
          polygon3d: [],
          human: true,
          fire: false,
          forklift: false,
          cone: false,
          wfs: false,
          cleaning: false,
          injecting: false,
          featureTracking: false,
          sbs: false,
          rppg: false,
          sourceWidth: 1920,
          sourceHeight: 1080,
          sourceFps: 10,
        },
      ],
      // ... 원본 스키마의 나머지 input 필드
    },
    infer: {
      models: {
        human: {
          enabled: true,
          config: "configs/pgie_human.txt",
          interval: 0,
          infer_dim: 640,
          max_batch: 128,
          batch_mode: "dynamic",
          pose_kpt_conf: 0.3,
          pose_kpt_conf_by_index: {
            0: 0.35,
            1: 0.35,
            2: 0.35,
            9: 0.6,
            10: 0.6,
            15: 0.3,
            16: 0.3,
          },
        },
        fire: {
          enabled: false,
          config: "configs/pgie_fire.txt",
          interval: 4,
          infer_dim: 640,
          batch_mode: "fixed",
        },
        forklift: {
          enabled: false,
          config: "configs/pgie_forklift.txt",
          interval: 0,
          infer_dim: 640,
          batch_mode: "fixed",
        },
        cone: {
          enabled: false,
          config: "configs/pgie_cone.txt",
          interval: 0,
          infer_dim: 640,
          batch_mode: "fixed",
        },
        wfs: {
          enabled: false,
          config: "configs/pgie_wfs.txt",
          interval: 0,
          infer_dim: 640,
          batch_mode: "fixed",
        },
        cleaning: {
          enabled: false,
          config: "configs/pgie_cleaning.txt",
          interval: 4,
          infer_dim: 640,
          batch_mode: "fixed",
        },
        injecting: {
          enabled: false,
          config: "configs/pgie_injecting.txt",
          interval: 4,
          infer_dim: 640,
          batch_mode: "fixed",
        },
      },
      encoder: { bitrate_per_channel: 800000, keyframe_sec: 2 },
      tracker: {
        /* trackerSchema 기본값 */
      },
      osd: {
        /* osdSchema */
      },
      ppe_status: {},
      zone_intrusion: {},
      night_intrusion: {},
      fire_status: {},
      cleaning_status: {},
      rPPG: {},
      bev: {},
      feature_tracking: { enabled: false, interval: 0 /* ... */ },
    },
    output: {},
    recording: {
      enabled: false,
      path: "/data/recordings",
      duration: 300,
      schedule: ["* * * * *"],
      cleanup: { max_size_gb: 500, check_interval: 300 },
    },
    web: { port: 8810 },
    storage: {},
    depth_service: {},
  },

  gizmo: {},
  volumeSnapshots: { outputPath: "/srv/volume" },
};

export default deepstreamConfig;
```

> **주의 — 빈 객체 `{}` 를 그대로 두지 말 것.**
> 기존 코드는 `new Config(doc)` 로 mongoose 스키마 기본값을 채워 넣은 뒤 전송했다
> (`connect.handler.js:183-191` 의 "스키마 기본값 적용" 주석). DB 를 없애면 그 방어막이 사라지므로,
> **4-1 덤프로 얻은 완전한 기본값 트리를 그대로 붙여넣어야** DeepStream 쪽에서 `KeyError` 가 안 난다.
> 위 예시의 `{}` 자리는 전부 실제 기본값으로 채울 것.

### 4-3. (선택) txt/JSON 파일로 두고 싶다면

핫 리로드가 목적이라면 JS 대신 JSON 이 낫다 (ESM 은 모듈 캐시 때문에 재import 가 번거로움).

```js
// src/constants/loadConfig.js
import fs from "fs";
import path from "path";

const FILE =
  process.env.CONFIG_FILE ||
  path.resolve(process.cwd(), "src/constants/deepstream.config.json");

export function loadConfig() {
  const raw = fs.readFileSync(FILE, "utf8");
  const cfg = JSON.parse(raw); // 파싱 실패 시 예외 → 호출부에서 이전 값 유지
  if (!cfg.deepstream) throw new Error("config.deepstream 누락");
  return cfg;
}

export const CONFIG_FILE = FILE;
```

---

## 5. src/streams.js

```js
// key: `${tenantId}:${component}` — component = "pipeline" | "web" | "depth-service"
const streams = new Map();

export const registerStream = (tenantId, call, component = "pipeline") =>
  streams.set(`${tenantId}:${component}`, call);

export const removeStream = (tenantId, component = "pipeline") =>
  streams.delete(`${tenantId}:${component}`);

export const pushDown = (tenantId, msg, component = "pipeline") => {
  const call = streams.get(`${tenantId}:${component}`);
  if (call && !call.cancelled) call.write(msg);
};

/** 접속 중인 모든 스트림에 브로드캐스트 (config 재전송용) */
export const broadcast = (msg) => {
  let sent = 0;
  for (const [key, call] of streams) {
    if (!call.cancelled) {
      call.write(msg);
      sent++;
    }
  }
  return sent;
};

export const listStreams = () => [...streams.keys()];
```

## 6. src/handlers/connect.js

기존 핸들러에서 **인증 블록(`connect.handler.js:163-175`)과 Up 처리 전부**를 제거한 형태.

```js
import { encode } from "@msgpack/msgpack";
import { registerStream, removeStream } from "../streams.js";
import { loadConfig } from "../constants/loadConfig.js"; // 또는 default import

export const encodeConfigMessage = (cfg) => ({
  config: Buffer.from(encode(cfg)),
});

export function connectHandler(call) {
  const meta = call.metadata.getMap();
  // 인증 없음. tenant/component 는 라우팅 키로만 사용.
  const tenantId = meta["x-tenant-id"] || "default";
  const component = meta["x-component"] || "pipeline";

  registerStream(tenantId, call, component);
  console.log(`[grpc] connected: ${tenantId} [${component}]`);

  // 접속 즉시 config 1회 전송 — DeepStream 기동 시퀀스가 이걸 기다린다
  try {
    call.write(encodeConfigMessage(loadConfig()));
    console.log(`[grpc] config sent -> ${tenantId}:${component}`);
  } catch (e) {
    console.error("[grpc] config load/send 실패:", e.message);
  }

  // Up 메시지는 처리하지 않되, 반드시 소비해야 한다(미소비 시 flow control 로 스트림 정체)
  call.on("data", (msg) => {
    const p = msg.payload;
    if (p !== "health") console.log(`[grpc] up [${tenantId}]: ${p}`);
  });

  call.on("end", () => {
    removeStream(tenantId, component);
    console.log(`[grpc] disconnected: ${tenantId} [${component}]`);
    call.end();
  });

  call.on("error", (err) => {
    removeStream(tenantId, component);
    console.warn(`[grpc] error [${tenantId}:${component}]: ${err.message}`);
  });
}
```

> `call.on("data")` 를 등록하지 않으면 클라이언트가 보낸 Up 메시지가 버퍼에 쌓여
> HTTP/2 flow-control window 가 닫히고 결국 Down 전송까지 멈춘다. **핸들러 없이 두지 말 것.**

## 7. src/server.js

```js
import path from "path";
import { fileURLToPath } from "url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { connectHandler } from "./handlers/connect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkgDef = protoLoader.loadSync(
  path.join(__dirname, "../proto/pipeline.proto"),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  },
);
const { PipelineGateway } =
  grpc.loadPackageDefinition(pkgDef).serdic.pipeline.v1;

export function startGrpcServer(port = Number(process.env.GRPC_PORT ?? 50051)) {
  const server = new grpc.Server({
    "grpc.http2.min_recv_ping_interval_without_data_ms": 5_000,
    "grpc.keepalive_permit_without_calls": 1,
  });
  server.addService(PipelineGateway.service, { Connect: connectHandler });

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
```

`loadPackageDefinition` 옵션은 **원본과 한 글자도 다르면 안 된다** — 특히 `keepCase: true`.

## 8. src/index.js — 기동 + config 파일 핫 리로드

기존에는 REST `PUT /config` 가 `pushConfig()` 를 호출해 재전송했다
(`config.service.js:38-48`). API 를 뺐으므로 **파일 저장 = 재전송** 으로 대체한다.

```js
import fs from "fs";
import { startGrpcServer } from "./server.js";
import { broadcast, listStreams } from "./streams.js";
import { encodeConfigMessage } from "./handlers/connect.js";
import { loadConfig, CONFIG_FILE } from "./constants/loadConfig.js";

startGrpcServer();

// 파일이 바뀌면 접속 중인 전 스트림에 재전송 (에디터 저장 시 이벤트 중복 → 디바운스)
let timer = null;
fs.watch(CONFIG_FILE, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const n = broadcast(encodeConfigMessage(loadConfig()));
      console.log(
        `[watch] config 재전송 -> ${n} streams ${JSON.stringify(listStreams())}`,
      );
    } catch (e) {
      console.error("[watch] config 파싱 실패, 이전 값 유지:", e.message);
    }
  }, 300);
});

process.on("SIGINT", () => process.exit(0));
```

---

## 9. 검증 절차

### 9-1. 서버 기동

```bash
GRPC_PORT=50051 npm start
```

### 9-2. 최소 클라이언트로 수신 확인 (Node)

DeepStream 없이 계약을 먼저 검증한다. 아래를 임시 파일로 실행:

```js
// /tmp/probe.js
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { decode } from "@msgpack/msgpack";

const pkg = grpc.loadPackageDefinition(
  protoLoader.loadSync("./proto/pipeline.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }),
);
const client = new pkg.serdic.pipeline.v1.PipelineGateway(
  "localhost:50051",
  grpc.credentials.createInsecure(),
);

const md = new grpc.Metadata();
md.set("x-tenant-id", "default");
md.set("x-component", "pipeline");

const call = client.Connect(md);
call.on("data", (m) => {
  if (m.payload === "config") {
    const cfg = decode(m.config);
    console.log(
      "sources:",
      cfg.deepstream.input.sources.map((s) => s.name),
    );
    console.log("keys:", Object.keys(cfg));
  }
});
call.on("error", (e) => console.error("err:", e.message));
```

```bash
node /tmp/probe.js
```

기대 출력: 접속 즉시 `sources: [...]` 가 찍히고, 상수 파일을 수정 후 저장하면 **한 번 더** 찍힌다.

### 9-3. Python(DeepStream 측) 디코딩 확인

DeepStream 클라이언트는 보통 `msgpack.unpackb(msg.config, raw=False)` 로 푼다.
JS `@msgpack/msgpack` 인코딩 결과와 호환되지만 아래 2가지만 주의:

- **`undefined` 는 인코딩되지 않는다** → 상수 파일에서 값이 없으면 키를 아예 빼거나 `null` 을 명시할 것
- **정수 키 객체**(`pose_kpt_conf_by_index: {0: 0.35}`) 는 JS 에서 문자열 키 `"0"` 으로 나간다.
  기존 mongoose Map 경로에서도 동일했으므로 클라이언트가 `str(i)` 로 접근한다면 그대로 두고,
  아니라면 클라이언트 쪽 `int(k)` 변환을 확인할 것.

---

## 10. 제거되는 항목 체크리스트

원본 대비 **의도적으로 빠지는 것들** — 나중에 "왜 안 되지" 를 막기 위한 목록:

- [x] `TenantSettings` 기반 API 키 검증 (`connect.handler.js:163-175`)
- [x] `Config.findOne` + `new Config(...)` 스키마 기본값 주입 → **상수 파일이 완전한 트리여야 함 (§4-2 주의)**
- [x] TLS 자격증명 (`grpcTlsCert`/`grpcTlsKey`) — insecure 고정
- [x] Up 처리 전부: alert/ppe/health/recon/volume/benchmark/order_create → Mongo·Redis 기록 없음
- [x] `scan_cmd` / `requestScan` / `resolveScan` (네트워크 스캔 왕복)
- [x] `benchmark_cmd`
- [x] REST API, Express, 인증 미들웨어, cron job 전부

## 11. 나중에 원본에 다시 붙일 때

이 축소판은 원본과 **proto·msgpack·스트림 키 규칙이 동일**하므로,
`loadConfig()` 를 `Config.findOne({tenantId})` 로, `broadcast()` 를 `pushDown(tenantId, msg, component)` 로
바꾸는 것만으로 원복된다. 그 외 파일은 손대지 않도록 경계를 유지할 것.
