// DB 대체 — 현재 Config 를 들고 있는 인메모리 스토어.
// SetConfig RPC 가 이 값을 갱신하고, GetConfig/WatchConfig 가 이 값을 읽는다.
// TODO: 프로세스 재시작 시 값을 유지할지(파일/DB 영속화) 결정할 것. 지금은 기본값만 채운다.

const DEFAULT_CONFIG = {
  input: {
    sources: [
      {
        name: "ch00",
        url: "rtsp://localhost:8554/stream0",
        source_width: 1280,
        source_height: 720,
      },
    ],
    resize: { width: 960, height: 540 },
    framerate: { target: 20 },
    reconnect_sec: 10,
  },
  pipeline: {
    network_mode: 2, // 0=FP32, 1=INT8, 2=FP16
    inference: {
      forklift: {
        enabled: true,
        config: "configs/pgie_forklift.txt",
        infer_dim: 640,
        labels: ["forklift"],
      },
    },
    tracker: {
      config: "configs/tracker.yml",
      width: 640,
      height: 384,
    },
    osd: {
      display_bbox: true,
      display_text: true,
      display_fps: true,
    },
    zone: {
      class_id: 0,
      radius_px: 150,
    },
  },
  output: {
    web: {
      host: "0.0.0.0",
      port: 8810,
      jpeg_quality: 75,
      max_fps: 15,
    },
  },
};

let currentConfig = DEFAULT_CONFIG;

export function getConfig() {
  return currentConfig;
}

export function setConfig(config) {
  if (!config) {
    throw new Error("config required");
  }
  // DB의 findOneAndUpdate(upsert, full replace) 와 동일한 의미 — 부분 patch 가 아니라
  // 문서 전체를 교체한다. proto3 는 미설정 필드가 zero-value 로 오므로 merge 하면
  // "명시적 0" 과 "안 보냄" 을 구분할 수 없어 오히려 DB 시맨틱과 어긋난다.
  currentConfig = config;
  return currentConfig;
}
