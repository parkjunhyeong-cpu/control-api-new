// DB 대체 — 현재 InputConfig 를 들고 있는 인메모리 스토어.
// SetConfig RPC 가 이 값을 갱신하고, GetConfig/WatchConfig 가 이 값을 읽는다.
// TODO: 프로세스 재시작 시 값을 유지할지(파일/DB 영속화) 결정할 것. 지금은 기본값만 채운다.

const DEFAULT_INPUT_CONFIG = {
  sources: [],
  resize_width: 0,
  resize_height: 0,
  framerate_target: 0,
  reconnect_sec: 0,
  // TODO: 실제 기본 소스/해상도/프레임레이트 값 채우기
};

let currentConfig = DEFAULT_INPUT_CONFIG;

export function getConfig() {
  return currentConfig;
}

export function setConfig(inputConfig) {
  if (!inputConfig) {
    throw new Error("input config required");
  }
  // DB의 findOneAndUpdate(upsert, full replace) 와 동일한 의미 — 부분 patch 가 아니라
  // 문서 전체를 교체한다. proto3 는 미설정 필드가 zero-value 로 오므로 merge 하면
  // "명시적 0" 과 "안 보냄" 을 구분할 수 없어 오히려 DB 시맨틱과 어긋난다.
  currentConfig = inputConfig;
  return currentConfig;
}
