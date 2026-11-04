import { useEffect, useState } from "react";
import { FiveCardStack } from "./components/FiveCardStack";
import { PhoneCardStack } from "./components/PhoneCardStack";
import { workCards } from "./data/cards";

const DESKTOP_STAGE_WIDTH = 1560;
const DESKTOP_STAGE_HEIGHT = 760;
const PHONE_MAX_WIDTH = 640;

export default function App() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? DESKTOP_STAGE_WIDTH : window.innerWidth,
    height: typeof window === "undefined" ? DESKTOP_STAGE_HEIGHT : window.innerHeight,
  }));

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  if (viewport.width < PHONE_MAX_WIDTH) {
    return (
      <main className="flex h-[100dvh] items-center justify-center overflow-hidden bg-[#d8d2c8]">
        <PhoneCardStack cards={workCards} initialActiveIndex={2} viewport={viewport} />
      </main>
    );
  }

  const horizontalInset = 64;
  const verticalInset = 96;
  const availableWidth = Math.max(0, viewport.width - horizontalInset);
  const availableHeight = Math.max(0, viewport.height - verticalInset);
  const stageScale = Math.min(
    1,
    availableWidth / DESKTOP_STAGE_WIDTH,
    availableHeight / DESKTOP_STAGE_HEIGHT,
  );
  const safeStageScale = Number.isFinite(stageScale)
    ? Math.max(0, stageScale)
    : 1;
  const isCompactViewport = safeStageScale < 0.98;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#d8d2c8] px-3 py-6 sm:px-8 sm:py-16">
      <div
        className="relative flex items-center justify-center"
        style={{
          width: DESKTOP_STAGE_WIDTH * safeStageScale,
          height: DESKTOP_STAGE_HEIGHT * safeStageScale,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: DESKTOP_STAGE_WIDTH,
            height: DESKTOP_STAGE_HEIGHT,
            transform: `translate(-50%, -50%) scale(${safeStageScale})`,
            transformOrigin: "center center",
          }}
        >
          <FiveCardStack
            cards={workCards}
            initialActiveIndex={2}
            isCompactViewport={isCompactViewport}
          />
        </div>
      </div>
    </main>
  );
}
