import type { Story } from "./types";
import { qinshihuang } from "./stories/qinshihuang";
import { huatangchun } from "./stories/huatangchun";
import { renlian } from "./stories/renlian";
import { jiaxin } from "./stories/jiaxin";
import { taoli } from "./stories/taoli";
import { ak47 } from "./stories/ak47";
import { jinshi } from "./stories/jinshi";
import { zhongfo } from "./stories/zhongfo";
import { jingshenbing } from "./stories/jingshenbing";
import { lanxue } from "./stories/lanxue";
import { chongzhen } from "./stories/chongzhen";
import { smith } from "./stories/smith";
import { room } from "./stories/room";
import { wanglian } from "./stories/wanglian";
import { lingshou } from "./stories/lingshou";
import { duanfei } from "./stories/duanfei";
import { shanhui } from "./stories/shanhui";
import { chirenxin } from "./stories/chirenxin";
import { mihuwei } from "./stories/mihuwei";
import { xuekexiuxian } from "./stories/xuekexiuxian";
import { chaonengli } from "./stories/chaonengli";
import { zhengdunhougong } from "./stories/zhengdunhougong";
import { angmapzs } from "./stories/angmapzs";
import { shaxianchengdao } from "./stories/shaxianchengdao";
import { shuituzhuo } from "./stories/shuituzhuo";

// Built-in 盐选 story library — the app's real narrative content, one module per story.
export const STORIES: Story[] = [
  qinshihuang,
  huatangchun,
  renlian,
  jiaxin,
  taoli,
  ak47,
  jinshi,
  zhongfo,
  jingshenbing,
  lanxue,
  chongzhen,
  smith,
  room,
  wanglian,
  lingshou,
  duanfei,
  shanhui,
  chirenxin,
  mihuwei,
  xuekexiuxian,
  chaonengli,
  zhengdunhougong,
  angmapzs,
  shaxianchengdao,
  shuituzhuo,
];

export function getStory(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}
