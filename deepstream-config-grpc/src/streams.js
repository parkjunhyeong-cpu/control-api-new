// key: `${tenantId}:${component}` — component = "pipeline" | "web" | "depth-service"
const streams = new Map();

// TODO: guide.md §5 참고하여 구현

export const registerStream = (tenantId, call, component = "pipeline") => {
  throw new Error("registerStream() not implemented");
};

export const removeStream = (tenantId, component = "pipeline") => {
  throw new Error("removeStream() not implemented");
};

export const pushDown = (tenantId, msg, component = "pipeline") => {
  throw new Error("pushDown() not implemented");
};

/** 접속 중인 모든 스트림에 브로드캐스트 (config 재전송용) */
export const broadcast = (msg) => {
  throw new Error("broadcast() not implemented");
};

export const listStreams = () => [...streams.keys()];
