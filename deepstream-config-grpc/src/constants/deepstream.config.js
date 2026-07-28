// DB(Config 컬렉션) 대체. 이 객체가 그대로 msgpack 으로 인코딩되어 DeepStream 에 전달된다.
// 최상위 형태는 기존 mongoose configSchema 와 동일하게 유지할 것 (guide.md §4).
//
// TODO: guide.md §4-1 의 덤프 커맨드로 기존 레포에서 스키마 기본값을 뽑아
//       아래 트리를 "완전한" 기본값으로 채울 것. 빈 객체를 그대로 두면
//       DeepStream 쪽에서 KeyError 가 날 수 있다.

export const TENANT_ID = process.env.TENANT_ID || "default";

const deepstreamConfig = {
  tenantId: TENANT_ID,
  plantManager: "",
  inspectionManager: "",

  deepstream: {
    input: {
      sources: [],
      // TODO: 원본 스키마의 나머지 input 필드
    },
    infer: {
      models: {},
      // TODO: encoder / tracker / osd / ppe_status / zone_intrusion / ...
    },
    output: {},
    recording: {},
    web: {},
    storage: {},
    depth_service: {},
  },

  gizmo: {},
  volumeSnapshots: {},
};

export default deepstreamConfig;
