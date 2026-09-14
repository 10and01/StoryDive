"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/utils/utils";

export type GuideStep = {
  id: string;
  route: string;
  target: string;
  titleKey: string;
  descriptionKey: string;
};

export type GuideState = {
  active: boolean;
  stepIndex: number;
  completed: boolean;
};

const GUIDE_COMPLETE_KEY = "ruju:onboarding-complete:v1";

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "shelf",
    route: "/",
    target: '[data-guide="shelf-relic"]',
    titleKey: "guide.steps.shelf.title",
    descriptionKey: "guide.steps.shelf.description",
  },
  {
    id: "filters",
    route: "/",
    target: '[data-guide="shelf-search"]',
    titleKey: "guide.steps.filters.title",
    descriptionKey: "guide.steps.filters.description",
  },
  {
    id: "reader",
    route: "/read/ak47",
    target: '[data-guide="reader-controls"]',
    titleKey: "guide.steps.reader.title",
    descriptionKey: "guide.steps.reader.description",
  },
  {
    id: "play",
    route: "/read/ak47?enter=0",
    target: '[data-guide="enter-actions"]',
    titleKey: "guide.steps.play.title",
    descriptionKey: "guide.steps.play.description",
  },
  {
    id: "branches",
    route: "/branches",
    target: '[data-guide="branches-page"]',
    titleKey: "guide.steps.branches.title",
    descriptionKey: "guide.steps.branches.description",
  },
  {
    id: "court",
    route: "/court",
    target: '[data-guide="court-page"]',
    titleKey: "guide.steps.court.title",
    descriptionKey: "guide.steps.court.description",
  },
  {
    id: "theater",
    route: "/theater",
    target: '[data-guide="theater-page"]',
    titleKey: "guide.steps.theater.title",
    descriptionKey: "guide.steps.theater.description",
  },
];

type GuideContextValue = {
  state: GuideState;
  startGuide: () => void;
  stopGuide: (completed?: boolean) => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

function routeWithGuide(route: string, stepId: string) {
  const [path, query = ""] = route.split("?");
  const params = new URLSearchParams(query);
  params.set("guide", stepId);
  return `${path}?${params.toString()}`;
}

function routePath(route: string) {
  return route.split("?")[0];
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      const welcomeSeen = localStorage.getItem("ruju:welcome-seen:v1") === "1";
      const guideDone = localStorage.getItem(GUIDE_COMPLETE_KEY) === "1";
      if (welcomeSeen && !guideDone) {
        window.setTimeout(() => {
          setActive(true);
          setStepIndex(0);
        }, 0);
      }
    } catch {
      // Storage is optional; the explicit tutorial entry remains available.
    }
  }, [pathname]);

  const startGuide = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    setCompleted(false);
    if (pathname !== "/") router.push(routeWithGuide("/", GUIDE_STEPS[0].id));
  }, [pathname, router]);

  const stopGuide = useCallback((markComplete = true) => {
    setActive(false);
    if (markComplete) {
      setCompleted(true);
      try {
        localStorage.setItem(GUIDE_COMPLETE_KEY, "1");
      } catch {
        // Private browsing / quota errors should not block the tutorial.
      }
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      state: { active, stepIndex, completed },
      startGuide,
      stopGuide,
    }),
    [active, completed, startGuide, stepIndex, stopGuide],
  );

  return (
    <GuideContext.Provider value={contextValue}>
      {children}
      <GuideOverlay
        active={active}
        stepIndex={stepIndex}
        pathname={pathname}
        setStepIndex={setStepIndex}
        stopGuide={stopGuide}
      />
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const value = useContext(GuideContext);
  if (!value) throw new Error("useGuide must be used inside GuideProvider");
  return value;
}

function GuideOverlay({
  active,
  stepIndex,
  pathname,
  setStepIndex,
  stopGuide,
}: {
  active: boolean;
  stepIndex: number;
  pathname: string;
  setStepIndex: (value: number) => void;
  stopGuide: (completed?: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = GUIDE_STEPS[stepIndex];
  const isCurrentRoute = step ? routePath(step.route) === pathname : false;

  const findTarget = useCallback(() => {
    if (!active || !step || !isCurrentRoute) {
      setRect(null);
      return;
    }
    const target = document.querySelector(step.target);
    if (!target) {
      setRect(null);
      return;
    }
    window.setTimeout(() => setRect(target.getBoundingClientRect()), 160);
  }, [active, isCurrentRoute, step]);

  useEffect(() => {
    const initialTimer = window.setTimeout(findTarget, 0);
    if (!active) return () => window.clearTimeout(initialTimer);
    const onChange = () => findTarget();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const timer = window.setInterval(onChange, 500);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      window.clearInterval(timer);
    };
  }, [active, findTarget, pathname]);

  useEffect(() => {
    if (!active) return;
    cardRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") stopGuide(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, stepIndex, stopGuide]);

  if (!active || !step) return null;

  function next() {
    if (stepIndex >= GUIDE_STEPS.length - 1) {
      stopGuide(true);
      return;
    }
    const nextStep = GUIDE_STEPS[stepIndex + 1];
    setStepIndex(stepIndex + 1);
    if (routePath(nextStep.route) !== pathname || nextStep.route.includes("?")) {
      router.push(routeWithGuide(nextStep.route, nextStep.id));
    }
  }

  function previous() {
    if (stepIndex === 0) return;
    const previousStep = GUIDE_STEPS[stepIndex - 1];
    setStepIndex(stepIndex - 1);
    if (routePath(previousStep.route) !== pathname || previousStep.route.includes("?")) {
      router.push(routeWithGuide(previousStep.route, previousStep.id));
    }
  }

  const cardTop = rect ? Math.min(window.innerHeight - 228, rect.bottom + 16) : undefined;
  const cardLeft = rect
    ? Math.min(Math.max(16, rect.left + rect.width / 2 - 168), window.innerWidth - 352)
    : undefined;

  return (
    <div className="fixed inset-0 z-[80]" aria-label={t("guide.ariaLabel")}>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-sm border border-[color:var(--primary)] shadow-[0_0_0_9999px_rgba(8,9,8,.78),0_0_28px_rgba(214,192,142,.5)] transition-[top,left,width,height] duration-200"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/70" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute w-[min(336px,calc(100vw-32px))] border border-[color:var(--primary)]/55 bg-[#171817] p-4 text-[color:var(--rs-ink)] shadow-[0_18px_55px_rgba(0,0,0,.48)] outline-none"
        style={
          rect
            ? { top: cardTop, left: cardLeft }
            : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-[color:var(--primary)]">
              {t("guide.progress", { n: stepIndex + 1, total: GUIDE_STEPS.length })}
            </p>
            <h2 className="mt-1 font-heading text-xl leading-tight">
              {t(step.titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => stopGuide(true)}
            className="shrink-0 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--rs-ink)]"
            aria-label={t("guide.skip")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#d9ca9b]">{t(step.descriptionKey)}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => stopGuide(true)}
            className="text-xs text-[color:var(--muted-foreground)] underline-offset-4 hover:underline"
          >
            {t("guide.skip")}
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={previous}
                className="inline-flex items-center gap-1 border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--rs-ink)]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("guide.previous")}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className={cn(
                "inline-flex items-center gap-1 bg-[color:var(--primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)]",
                stepIndex === GUIDE_STEPS.length - 1 && "px-4",
              )}
            >
              {stepIndex === GUIDE_STEPS.length - 1 ? t("guide.finish") : t("guide.next")}
              {stepIndex < GUIDE_STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { GUIDE_COMPLETE_KEY };
