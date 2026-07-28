// 상수 파일(JS) 대신 파일 기반 핫 리로드를 쓰고 싶을 때 사용 (guide.md §4-3).
// TODO: JSON 핫 리로드를 쓸지, deepstream.config.js 를 직접 import 할지 결정할 것.

import fs from "fs";
import path from "path";

export const CONFIG_FILE =
  process.env.CONFIG_FILE ||
  path.resolve(process.cwd(), "src/constants/deepstream.config.json");

export function loadConfig() {
  // TODO: JSON 파일을 읽어 파싱하고, cfg.deepstream 누락 시 에러를 던질 것
  throw new Error("loadConfig() not implemented");
}
