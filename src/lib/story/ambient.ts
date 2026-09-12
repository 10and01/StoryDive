// 环境氛围音的基调名（与 AmbientPlayer 的氛围音轨映射一一对应）。
// 放在独立模块，避免类型定义与 "use client" 组件互相耦合。
export type AmbientMoodName =
  | "palace"
  | "horror"
  | "battle"
  | "rural"
  | "fantasy"
  | "calm";

// 每种基调对应一首免版权（CC-BY）氛围曲，放在 /public/ambient 下同源提供、循环播放。
export const AMBIENT_TRACKS: Record<AmbientMoodName, string> = {
  palace: "/ambient/melancholy.ogg",
  horror: "/ambient/horror.ogg",
  battle: "/ambient/horror.ogg",
  rural: "/ambient/calm.ogg",
  fantasy: "/ambient/fantasy.ogg",
  calm: "/ambient/calm.ogg",
};

// 曲目版权署名（CC-BY 需注明来源）。展示在设置/关于位置。
export const AMBIENT_CREDITS: { title: string; by: string; license: string }[] = [
  { title: "The Long Dark", by: "Scott Buckley", license: "CC-BY 4.0" },
  { title: "Placid Ambient", by: "MusicLFiles", license: "CC-BY 4.0" },
  { title: "Deep", by: "Alex-Productions", license: "CC-BY 3.0" },
  { title: "Zero Point", by: "Dreamstate Logic", license: "CC-BY 3.0" },
];
