"use client";

import { useEffect, useState } from "react";

// Deterministic, privacy-safe preview data. Never imported by product routes.
const COVER_PREVIEW_DATA = {
  title: "秦始皇登月计划",
  paragraph:
    "「陛下，微臣李斯，有要事禀报。」车门被推开，李斯见了我大惊失色，抽剑相向。",
  hint: "李斯神色慌张——从这里分叉",
  actions: ["对戏", "分叉", "改写"] as const,
  outcome: "【平行走向】若在此处「信任周继盛」，李斯的谋划被迫提前……",
};

// Autonomous loop states: read → pulse enter point → pick 分叉 → branch grows.
type Step = "idle" | "pulse" | "pick" | "grow";

export function CoverPreview() {
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep("pulse"), 500),
      setTimeout(() => setStep("pick"), 1600),
      setTimeout(() => setStep("grow"), 2700),
      setTimeout(() => setStep("idle"), 4200),
    ];
    const loop = setInterval(() => {
      setStep("idle");
      setTimeout(() => setStep("pulse"), 500);
      setTimeout(() => setStep("pick"), 1600);
      setTimeout(() => setStep("grow"), 2700);
    }, 4700);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  return (
    <div
      className="relative isolate flex h-full min-h-[100svh] w-full flex-col overflow-hidden bg-[#171817] px-5 pt-14"
      style={{ fontFamily: "var(--font-heading), Georgia, serif" }}
    >
      <div className="rs-grain" aria-hidden />
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-[10px] tracking-[0.16em] text-[#a08c6d]">
          盐选 · 活故事
        </div>
        <h1 className="mb-3 text-3xl leading-tight text-[#ede3c1]">
          {COVER_PREVIEW_DATA.title}
        </h1>
        <p className="text-[15px] leading-[1.85] text-[#ede3c1]">
          {COVER_PREVIEW_DATA.paragraph}
        </p>

        {/* enter point */}
        <div
          className="mt-3 flex items-center gap-2.5 border px-3 py-2.5 transition-all duration-300"
          style={{
            borderColor:
              step === "idle" ? "rgba(214,192,142,.25)" : "rgba(214,192,142,.6)",
            background:
              step === "pulse" ? "rgba(214,192,142,.14)" : "rgba(214,192,142,.06)",
          }}
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{
              background: "#d6c08e",
              boxShadow:
                step === "pulse"
                  ? "0 0 0 6px rgba(214,192,142,.18),0 0 18px rgba(214,192,142,.9)"
                  : "0 0 10px rgba(214,192,142,.6)",
              transform: step === "pulse" ? "scale(1.2)" : "scale(1)",
              transition: "all .3s",
            }}
          />
          <span className="text-[12px] text-[#d9ca9b]">{COVER_PREVIEW_DATA.hint}</span>
        </div>

        {/* three actions, 分叉 highlights on pick */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {COVER_PREVIEW_DATA.actions.map((a) => {
            const active = a === "分叉" && (step === "pick" || step === "grow");
            return (
              <div
                key={a}
                className="border px-1 py-2 text-center text-[13px] transition-colors duration-300"
                style={{
                  borderColor: active ? "#d6c08e" : "rgba(214,192,142,.5)",
                  background: active ? "#d6c08e" : "rgba(214,192,142,.08)",
                  color: active ? "#171817" : "#ede3c1",
                }}
              >
                {a}
              </div>
            );
          })}
        </div>

        {/* branch grows */}
        <div
          className="mt-2.5 overflow-hidden transition-all duration-500"
          style={{
            maxHeight: step === "grow" ? "120px" : "0px",
            opacity: step === "grow" ? 1 : 0,
          }}
        >
          <p className="border-l-2 border-[#7b9e99] bg-[#171817] p-2.5 text-[13px] leading-relaxed text-[#d9ca9b]">
            {COVER_PREVIEW_DATA.outcome}
          </p>
        </div>
      </div>
    </div>
  );
}
