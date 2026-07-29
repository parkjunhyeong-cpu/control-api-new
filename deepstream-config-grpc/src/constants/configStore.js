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
        // TODO: 실측 캘리브레이션 값으로 채울 것 — 카메라 이미지 좌표(픽셀, input.resize 960x540
        // 기준) <-> 실측 지면 좌표(미터 등, zone.radius_m과 같은 단위), 인덱스로 매칭, 4쌍 이상.
        // 비어 있으면 zone probe가 이 소스를 건너뛴다(원도 안 그리고 침입 감지도 안 함).
        // proto의 repeated Point2D({x,y} 객체) 형식과 정확히 맞춰야 한다 — server.js가
        // keepCase:true로 로드하므로 필드명도 snake_case(image_points/ground_points) 그대로,
        // camelCase나 [x,y] 배열로 넣으면 gRPC 인코딩 시 조용히 빈 값/(0,0)이 되어버린다.
        image_points: [
          { x: 82.81320337550056, y: 188.93493084955577 },
          { x: 143.3703468977632, y: 182.7079752174465 },
          { x: 155.27939954417218, y: 191.6592239386036 },
          { x: 93.24335405928359, y: 198.58671207932514 },
        ],
        ground_points: [
          { x: -2.5, y: -0.590210512199115 },
          { x: 2.5, y: -0.590210512199115 },
          { x: 2.5, y: 0.590210512199115 },
          { x: -2.5, y: 0.590210512199115 },
        ],
      },
      // 두 번째 카메라. tiler 격자는 pipeline 쪽 compute_derived()가 소스 개수로 자동 계산한다
      // (2개 -> 2열 1행 = 가로 배치) — 여기서는 url만 실제 두 번째 카메라 주소로 바꾸면 된다.
      {
        name: "ch01",
        url: "rtsp://localhost:8554/stream1",
        source_width: 1280,
        source_height: 720,
        image_points: [
          { x: 142.74990614671614, y: 241.3258596039818 },
          { x: 393.74458673892167, y: 206.00319819452392 },
          { x: 646.7039106145251, y: 397.5418994413408 },
          { x: 277.9888268156424, y: 488.0446927374302 },
        ],
        ground_points: [
          { x: -2.5, y: -2.3638491582635273 },
          { x: 2.5, y: -2.3638491582635273 },
          { x: 2.5, y: 2.3638491582635273 },
          { x: -2.5, y: 2.3638491582635273 },
        ],
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
      // 사람 추론 중단 요청 — 삭제 대신 enabled=false로 끈다. _build_pgies()가 이 값을
      // 보고 person PGIE를 아예 안 만들어 체인에서 빠진다(코드 변경 없이 바로 반영).
      // zone probe도 person PGIE가 없으면 침입 감지는 자동으로 건너뛰고 forklift 원만 그린다.
      person: {
        enabled: false,
        config: "configs/pgie_person.txt",
        infer_dim: 640,
        labels: ["person"],
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
      // 픽셀 반경 대신 지면 실측 반경(BEV). 단위는 sources[].ground_points와 반드시 맞춰야 한다
      // (예: 미터 단위로 캘리브레이션했으면 여기도 미터). 3m은 플레이스홀더 — 실제 안전 반경으로 조정.
      radius_m: 3.0,
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
