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
  throw new Error("getConfig() not implemented");
}

export function setConfig(inputConfig) {
  // TODO: 유효성 검증 후 currentConfig 갱신, 변경 여부 반환
  throw new Error("setConfig() not implemented");
}
