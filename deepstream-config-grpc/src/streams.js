// WatchConfig 로 접속한 server-streaming call 들의 레지스트리.
// SetConfig 로 값이 바뀌면 여기 등록된 모든 call 에 GetConfigResponse 를 write 한다.
const watchers = new Set();

export const addWatcher = (call) => {
  throw new Error("addWatcher() not implemented");
};

export const removeWatcher = (call) => {
  throw new Error("removeWatcher() not implemented");
};

/** 접속 중인 모든 WatchConfig 스트림에 최신 config 브로드캐스트 */
export const broadcast = (response) => {
  throw new Error("broadcast() not implemented");
};

export const watcherCount = () => watchers.size;
