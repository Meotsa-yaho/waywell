import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";

import { cn } from "../../../lib/utils";

/* ── types ───────────────────────────────────────────────────── */

export interface ProgressiveFluxPhase {
  /** Progress threshold (`0`–`100`) at or past which `label` is shown. */
  at: number;
  /** Text revealed once this threshold is reached. */
  label: string;
}

export interface ProgressiveFluxLoaderProps {
  /**
   * Controlled progress, `0`–`100`. When set, the loader follows this value and
   * the phase label switches at the configured thresholds. Omit it to let the
   * loader run its own looping sweep.
   */
  value?: number;
  /** Phase thresholds and their labels. Each `at` is a `0`–`100` mark. */
  phases?: ProgressiveFluxPhase[];
  /** Seconds for one full sweep when uncontrolled. Default `12`. */
  duration?: number;
  /** Restart from `0` after reaching `100` (uncontrolled only). Default `true`. */
  loop?: boolean;
  /** Show the animated phase label above the bar. Default `true`. */
  showLabel?: boolean;
  /**
   * CSS background for the bar fill. Defaults to the signature vivid blue → cyan
   * flux gradient. Pass any CSS background to replace it, or recolor the default
   * via the `--flux-from` / `--flux-to` CSS variables (e.g. set them to
   * `hsl(var(--primary))` to follow the theme).
   */
  gradient?: string;
  /** Fires once when progress reaches `100` — in both controlled and uncontrolled modes. */
  onComplete?: () => void;
  /** Classes for the root wrapper. */
  className?: string;
  /** Classes for the bar track. */
  barClassName?: string;
  /** Classes for the phase label. */
  textClassName?: string;
  /** Custom children inside or underneath */
  children?: React.ReactNode;
}

/* ── constants ───────────────────────────────────────────────── */

const DEFAULT_PHASES: ProgressiveFluxPhase[] = [
  { at: 0, label: "시작하기" },
  { at: 40, label: "맞춤 설정" },
  { at: 75, label: "회원가입" },
];

const FLUX_FROM = "var(--flux-from, #059669)";
const FLUX_TO = "var(--flux-to, #34d399)";
const FLUX_MID = `color-mix(in oklab, ${FLUX_FROM}, ${FLUX_TO})`;

const DEFAULT_GRADIENT = `linear-gradient(90deg, ${FLUX_FROM} 0%, ${FLUX_MID} 35%, ${FLUX_TO} 55%, ${FLUX_MID} 78%, ${FLUX_FROM} 100%)`;

const BAR_SHADOW = `0 0 16px color-mix(in oklab, ${FLUX_FROM} 40%, transparent), 0 0 24px color-mix(in oklab, ${FLUX_TO} 30%, transparent), inset 0 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 3px rgba(0, 40, 20, 0.25)`;

const SHEEN_GRADIENT =
  "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.55) 50%, transparent 100%)";

const Z_TRANSITION: Transition = { duration: 0.9, ease: [0.22, 1, 0.36, 1] };
const LETTER_TRANSITION: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

/* ── helpers ─────────────────────────────────────────────────── */

/** Latest label whose threshold has been crossed. Expects pre-sorted phases. */
function pickLabel(value: number, sortedPhases: ProgressiveFluxPhase[]) {
  let active = sortedPhases[0]?.label ?? "";
  for (const phase of sortedPhases) {
    if (value >= phase.at) active = phase.label;
  }
  return active;
}

/* ── label ───────────────────────────────────────────────────── */

interface FluxLabelProps {
  label: string;
  /** Render plain, static text instead of the 3D fly-in (reduced motion). */
  reduced: boolean;
  className?: string;
}

function FluxLabel({ label, reduced, className }: FluxLabelProps) {
  const base = cn(
    "absolute inset-0 flex items-center justify-center text-center text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl",
    className,
  );

  if (reduced) {
    return (
      <div aria-hidden className={base}>
        {label}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={label}
        aria-hidden
        className={base}
        style={{ transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, z: -380, scale: 0.65, filter: "blur(14px)" }}
        animate={{
          opacity: [0, 1, 1, 1],
          z: [-380, 60, -8, 0],
          scale: [0.65, 1.08, 0.985, 1],
          filter: ["blur(14px)", "blur(0px)", "blur(0px)", "blur(0px)"],
        }}
        exit={{
          opacity: 0,
          z: 220,
          scale: 1.35,
          filter: "blur(10px)",
          transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] },
        }}
        transition={Z_TRANSITION}
      >
        <span className="inline-flex">
          {label.split("").map((char, index) => (
            <motion.span
              key={`${label}-${index}`}
              className="inline-block"
              initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...LETTER_TRANSITION, delay: 0.18 + index * 0.035 }}
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── component ───────────────────────────────────────────────── */

export function ProgressiveFluxLoader({
  value,
  phases = DEFAULT_PHASES,
  duration = 12,
  loop = true,
  showLabel = true,
  gradient = DEFAULT_GRADIENT,
  onComplete,
  className,
  barClassName,
  textClassName,
  children,
}: ProgressiveFluxLoaderProps) {
  const reduced = !!useReducedMotion();
  const isControlled = typeof value === "number";
  const [internal, setInternal] = React.useState(0);

  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (isControlled) return;
    let raf = 0;
    let timer = 0;
    let start: number | null = null;
    const totalMs = Math.max(500, duration * 1000);

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const pct = Math.min(100, ((ts - start) / totalMs) * 100);
      setInternal(pct);
      if (pct >= 100) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
        if (loop) {
          start = null;
          completedRef.current = false;
          timer = window.setTimeout(() => {
            setInternal(0);
            raf = requestAnimationFrame(tick);
          }, 700);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [isControlled, duration, loop]);

  const raw = isControlled ? value! : internal;
  const current = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;

  React.useEffect(() => {
    if (!isControlled) return;
    if (current >= 100 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    } else if (current < 100) {
      completedRef.current = false;
    }
  }, [isControlled, current]);

  const sortedPhases = React.useMemo(
    () => [...phases].sort((a, b) => a.at - b.at),
    [phases],
  );
  const label = React.useMemo(
    () => pickLabel(current, sortedPhases),
    [current, sortedPhases],
  );
  const rounded = Math.round(current);

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center gap-2",
        className,
      )}
    >
      {showLabel && (
        <div
          className="relative h-9 w-full select-none"
          style={reduced ? undefined : { perspective: "1000px" }}
        >
          <FluxLabel
            label={label}
            reduced={reduced}
            className={textClassName}
          />
        </div>
      )}

      <div
        className={cn(
          "relative h-8 w-full overflow-hidden rounded-full bg-slate-100/90 shadow-[inset_0_2px_3px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.8)] border border-slate-200/50",
          barClassName,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={label ? `${rounded}% – ${label}` : `${rounded}%`}
        aria-label="Onboarding Progress"
      >
        <motion.div
          className="relative h-full rounded-full"
          style={{ background: gradient, boxShadow: BAR_SHADOW }}
          initial={false}
          animate={{ width: `${current}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {!reduced && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-full"
              style={{ background: SHEEN_GRADIENT, mixBlendMode: "screen" }}
              animate={{ x: ["-110%", "210%"] }}
              transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            />
          )}
        </motion.div>

        {/* Inner step labels overlay on the bar */}
        {children}
      </div>
    </div>
  );
}

export default ProgressiveFluxLoader;
