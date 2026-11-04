import { motion, type Transition } from "framer-motion";
import { returnEase, type FlipPhase } from "./cardTurn";

const backFrameGradientClass =
  "bg-[linear-gradient(135deg,#f7f7f7_0%,#8d8d8d_48%,#050505_100%)]";
const cardBackImageSrc = `${import.meta.env.BASE_URL}card-back.webp`;
const backGlowTransition: Transition = {
  duration: 0.3,
  ease: returnEase,
};

function getBackGlowOpacity(phase: FlipPhase) {
  switch (phase) {
    case "showingBackFace":
      return 0.56;
    case "settlingIntoBack":
      return 0.12;
    default:
      return 0;
  }
}

function getBackGlowScale(phase: FlipPhase) {
  switch (phase) {
    case "showingBackFace":
      return 1;
    case "settlingIntoBack":
      return 0.985;
    default:
      return 0.96;
  }
}

function getBackSurfaceGlowOpacity(phase: FlipPhase) {
  switch (phase) {
    case "showingBackFace":
      return 0.34;
    case "settlingIntoBack":
      return 0.08;
    default:
      return 0;
  }
}

function getBackEdgeGlowOpacity(phase: FlipPhase) {
  switch (phase) {
    case "showingBackFace":
      return 0.42;
    case "settlingIntoBack":
      return 0.14;
    default:
      return 0;
  }
}

type CardBackProps = {
  phase: FlipPhase;
  shouldReduceMotion: boolean;
};

export function CardBack({ phase, shouldReduceMotion }: CardBackProps) {
  const backGlowOpacity = getBackGlowOpacity(phase);
  const backGlowScale = getBackGlowScale(phase);
  const backSurfaceGlowOpacity = getBackSurfaceGlowOpacity(phase);
  const backEdgeGlowOpacity = getBackEdgeGlowOpacity(phase);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[20px] shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]"
    >
      <div
        className={[
          "absolute inset-0 rounded-[20px]",
          backFrameGradientClass,
        ].join(" ")}
      />
      <div className="relative z-0 h-full w-full p-[10px]">
        <div className="relative h-full w-full overflow-hidden rounded-[10px]">
          <img
            src={cardBackImageSrc}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          <motion.span
            className="absolute inset-0 rounded-[10px] bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.24),rgba(255,255,255,0.08)_36%,rgba(255,255,255,0)_72%)]"
            initial={false}
            animate={{ opacity: backSurfaceGlowOpacity }}
            transition={shouldReduceMotion ? { duration: 0 } : backGlowTransition}
          />
        </div>
      </div>
      <motion.span
        className="absolute inset-[2px] z-10 rounded-[18px] bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.3),rgba(255,255,255,0.12)_32%,rgba(255,255,255,0)_74%)] blur-[14px]"
        initial={false}
        animate={{
          opacity: backGlowOpacity,
          scale: backGlowScale,
        }}
        transition={shouldReduceMotion ? { duration: 0 } : backGlowTransition}
      />
      <motion.span
        className="absolute inset-[1px] z-20 rounded-[19px] bg-[linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_34%,rgba(0,0,0,0)_68%)]"
        initial={false}
        animate={{ opacity: backEdgeGlowOpacity }}
        transition={shouldReduceMotion ? { duration: 0 } : backGlowTransition}
      />
      <motion.span
        className="absolute inset-0 z-30 rounded-[20px] shadow-[inset_0_0_24px_rgba(255,255,255,0.1),inset_0_0_1px_rgba(255,255,255,0.28)]"
        initial={false}
        animate={{ opacity: backEdgeGlowOpacity }}
        transition={shouldReduceMotion ? { duration: 0 } : backGlowTransition}
      />
    </div>
  );
}
