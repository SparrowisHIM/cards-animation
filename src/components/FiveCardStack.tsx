import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { motion, useReducedMotion, type PanInfo, type Transition } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ProfileCardData } from "../data/cards";

type FiveCardStackProps = {
  cards: ProfileCardData[];
  initialActiveIndex?: number;
  isCompactViewport?: boolean;
};

type CardPosition = {
  name: "far-left" | "left" | "center" | "right" | "far-right";
  offset: -2 | -1 | 0 | 1 | 2;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

type LayoutMode = "clustered" | "spread";
type LayoutTransitionDirection = "opening" | "closing";

type FlipPhase =
  | "idle"
  | "dragging"
  | "committingToBack"
  | "showingBackFace"
  | "settlingIntoBack"
  | "complete";

type FlipState = {
  phase: FlipPhase;
  cardId: string | null;
  direction: DragDirection | null;
};

type DragDirection = "left" | "right";

const CARD_WIDTH = 361;
const CLUSTERED_LAYOUT_X_OFFSETS = {
  inner: 165,
  outer: 300,
};
const CLUSTERED_LAYOUT_Y_OFFSETS = {
  inner: 14,
  outer: 44,
};
const CLUSTERED_LAYOUT_ROTATIONS = {
  inner: 3,
  outer: 8,
};

const CARD_POSITIONS_SPREAD: CardPosition[] = [
  { name: "far-left", offset: -2, x: -575, y: 72, rotate: -18, scale: 0.9, opacity: 1, zIndex: 1 },
  { name: "left", offset: -1, x: -325, y: 28, rotate: -8, scale: 0.94, opacity: 1, zIndex: 2 },
  { name: "center", offset: 0, x: 0, y: 0, rotate: 0, scale: 1.04, opacity: 1, zIndex: 5 },
  { name: "right", offset: 1, x: 325, y: 28, rotate: 8, scale: 0.94, opacity: 1, zIndex: 2 },
  { name: "far-right", offset: 2, x: 575, y: 72, rotate: 18, scale: 0.9, opacity: 1, zIndex: 1 },
];

const CARD_POSITIONS_CLUSTERED: CardPosition[] = [
  {
    name: "far-left",
    offset: -2,
    x: -CLUSTERED_LAYOUT_X_OFFSETS.outer,
    y: CLUSTERED_LAYOUT_Y_OFFSETS.outer,
    rotate: -CLUSTERED_LAYOUT_ROTATIONS.outer,
    scale: 0.9,
    opacity: 1,
    zIndex: 1,
  },
  {
    name: "left",
    offset: -1,
    x: -CLUSTERED_LAYOUT_X_OFFSETS.inner,
    y: CLUSTERED_LAYOUT_Y_OFFSETS.inner,
    rotate: -CLUSTERED_LAYOUT_ROTATIONS.inner,
    scale: 0.94,
    opacity: 1,
    zIndex: 2,
  },
  { name: "center", offset: 0, x: 0, y: 0, rotate: 0, scale: 1.04, opacity: 1, zIndex: 5 },
  {
    name: "right",
    offset: 1,
    x: CLUSTERED_LAYOUT_X_OFFSETS.inner,
    y: CLUSTERED_LAYOUT_Y_OFFSETS.inner,
    rotate: CLUSTERED_LAYOUT_ROTATIONS.inner,
    scale: 0.94,
    opacity: 1,
    zIndex: 2,
  },
  {
    name: "far-right",
    offset: 2,
    x: CLUSTERED_LAYOUT_X_OFFSETS.outer,
    y: CLUSTERED_LAYOUT_Y_OFFSETS.outer,
    rotate: CLUSTERED_LAYOUT_ROTATIONS.outer,
    scale: 0.9,
    opacity: 1,
    zIndex: 1,
  },
];

const CARD_POSITIONS_BY_LAYOUT: Record<LayoutMode, CardPosition[]> = {
  clustered: CARD_POSITIONS_CLUSTERED,
  spread: CARD_POSITIONS_SPREAD,
};

/** Blocks layout toggle on double-click right after this card was promoted from inactive (same gesture). */
const LAYOUT_TOGGLE_COOLDOWN_AFTER_PROMOTION_MS = 520;
const LAYOUT_TRANSITION_STAGGER_S = 0.02;
const LAYOUT_TRANSITION_LOCK_MS = 560;
const layoutTransitionSpring: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 34,
  mass: 1.02,
};

const cardSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 32,
  mass: 0.9,
};

const subtleTween: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

const inactiveCtaTween: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

const dragSnapTransition = {
  bounceStiffness: 260,
  bounceDamping: 32,
};

const backFrameGradientClass =
  "bg-[linear-gradient(135deg,#f7f7f7_0%,#8d8d8d_48%,#050505_100%)]";
const cardBackImageSrc = `${import.meta.env.BASE_URL}card-back.png`;
const dragReturnThreshold = 140;
const returnEase: Transition["ease"] = [0.22, 1, 0.36, 1];
const backGlowTransition: Transition = {
  duration: 0.3,
  ease: returnEase,
};

const wait = (duration: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

export function FiveCardStack({
  cards,
  initialActiveIndex = 2,
  isCompactViewport = false,
}: FiveCardStackProps) {
  const initialCards = useMemo(() => cards.slice(0, 5), [cards]);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("clustered");
  const [layoutTransitionDirection, setLayoutTransitionDirection] =
    useState<LayoutTransitionDirection | null>(null);
  const [isLayoutTransitioning, setIsLayoutTransitioning] = useState(false);
  const [orderedCards, setOrderedCards] = useState(initialCards);
  const [activeCardId, setActiveCardId] = useState(
    initialCards[initialActiveIndex]?.id ?? initialCards[0]?.id ?? "",
  );
  const [flipState, setFlipState] = useState<FlipState>({
    phase: "idle",
    cardId: null,
    direction: null,
  });
  const [isHoverSuppressed, setIsHoverSuppressed] = useState(false);
  const [hoverResetToken, setHoverResetToken] = useState(0);
  const orderedCardsRef = useRef(initialCards);
  const sequenceToken = useRef(0);
  const layoutTransitionTimeoutRef = useRef<number | null>(null);
  const lastInactivePromotionRef = useRef<{ cardId: string; at: number } | null>(
    null,
  );
  const shouldReduceMotion = useReducedMotion() ?? false;

  const visibleCards = orderedCards;
  const activeIndex = Math.max(
    0,
    visibleCards.findIndex((card) => card.id === activeCardId),
  );
  const isSpreadMode = layoutMode === "spread";
  const isInteractionLocked =
    flipState.phase !== "idle" && flipState.phase !== "dragging";
  const isGestureLocked =
    isInteractionLocked ||
    flipState.phase === "dragging" ||
    isLayoutTransitioning;
  const transition = shouldReduceMotion ? { duration: 0 } : cardSpring;

  const clearLayoutTransitionLock = () => {
    if (layoutTransitionTimeoutRef.current !== null) {
      window.clearTimeout(layoutTransitionTimeoutRef.current);
      layoutTransitionTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    orderedCardsRef.current = orderedCards;
  }, [orderedCards]);

  useEffect(() => {
    orderedCardsRef.current = initialCards;
    sequenceToken.current += 1;
    clearLayoutTransitionLock();
    setLayoutMode("clustered");
    setLayoutTransitionDirection(null);
    setIsLayoutTransitioning(false);
    setFlipState({ phase: "idle", cardId: null, direction: null });
    setIsHoverSuppressed(false);
    setOrderedCards(initialCards);
    setActiveCardId((currentActiveId) => {
      if (initialCards.some((card) => card.id === currentActiveId)) {
        return currentActiveId;
      }

      return initialCards[initialActiveIndex]?.id ?? initialCards[0]?.id ?? "";
    });
  }, [initialCards, initialActiveIndex]);

  useEffect(() => {
    return () => {
      clearLayoutTransitionLock();
      sequenceToken.current += 1;
    };
  }, []);

  const moveActiveCardToEdge = (cardId: string, direction: DragDirection) => {
    const currentCards = orderedCardsRef.current;
    const currentIndex = currentCards.findIndex((card) => card.id === cardId);

    if (currentIndex === -1) {
      return;
    }

    const nextActiveCard = getCardAtOffset(
      currentCards,
      currentIndex,
      direction === "left" ? 2 : -2,
    );

    setActiveCardId(nextActiveCard.id);
  };

  const commitActiveCardToEdge = async (
    cardId: string,
    direction: DragDirection,
  ) => {
    if (isInteractionLocked || flipState.phase !== "dragging") {
      return;
    }

    const token = sequenceToken.current + 1;
    sequenceToken.current = token;

    if (shouldReduceMotion) {
      moveActiveCardToEdge(cardId, direction);
      setFlipState({ phase: "idle", cardId: null, direction: null });
      return;
    }

    setFlipState({ phase: "committingToBack", cardId, direction });
    await wait(180);
    if (sequenceToken.current !== token) return;

    setFlipState({ phase: "showingBackFace", cardId, direction });
    await wait(260);
    if (sequenceToken.current !== token) return;

    moveActiveCardToEdge(cardId, direction);
    setFlipState({ phase: "settlingIntoBack", cardId, direction });
    await wait(480);
    if (sequenceToken.current !== token) return;

    setFlipState({ phase: "complete", cardId, direction });
    await wait(240);
    if (sequenceToken.current !== token) return;

    setFlipState({ phase: "idle", cardId: null, direction: null });
  };

  const handleSelectCard = (cardId: string) => {
    if (isGestureLocked) {
      return;
    }

    setActiveCardId((currentId) => {
      if (cardId === currentId) {
        return currentId;
      }

      lastInactivePromotionRef.current = { cardId, at: Date.now() };
      return cardId;
    });
  };

  const handleToggleLayoutMode = () => {
    if (isGestureLocked) {
      return;
    }

    const blockToggle =
      lastInactivePromotionRef.current !== null &&
      lastInactivePromotionRef.current.cardId === activeCardId &&
      Date.now() - lastInactivePromotionRef.current.at <
        LAYOUT_TOGGLE_COOLDOWN_AFTER_PROMOTION_MS;

    if (blockToggle) {
      return;
    }

    const nextLayoutMode = layoutMode === "clustered" ? "spread" : "clustered";
    const nextTransitionDirection =
      nextLayoutMode === "spread" ? "opening" : "closing";

    clearLayoutTransitionLock();
    lastInactivePromotionRef.current = null;
    setIsLayoutTransitioning(true);
    setLayoutTransitionDirection(nextTransitionDirection);
    setLayoutMode(nextLayoutMode);

    if (shouldReduceMotion) {
      setLayoutTransitionDirection(null);
      setIsLayoutTransitioning(false);
      return;
    }

    layoutTransitionTimeoutRef.current = window.setTimeout(() => {
      layoutTransitionTimeoutRef.current = null;
      setLayoutTransitionDirection(null);
      setIsLayoutTransitioning(false);
    }, LAYOUT_TRANSITION_LOCK_MS);
  };

  const handleDragStart = (cardId: string) => {
    if (
      !isSpreadMode ||
      isInteractionLocked ||
      isLayoutTransitioning ||
      cardId !== activeCardId
    ) {
      return;
    }

    setFlipState({ phase: "dragging", cardId, direction: null });
  };

  const handleDragEnd = (cardId: string, info: PanInfo) => {
    if (!isSpreadMode || cardId !== activeCardId || flipState.phase !== "dragging") {
      return;
    }

    const horizontalDrag = info.offset.x;
    setIsHoverSuppressed(true);
    setHoverResetToken((token) => token + 1);

    if (Math.abs(horizontalDrag) < dragReturnThreshold) {
      setFlipState({ phase: "idle", cardId: null, direction: null });
      return;
    }

    void commitActiveCardToEdge(
      cardId,
      horizontalDrag < 0 ? "left" : "right",
    );
  };

  return (
    <section
      className="relative mx-auto flex h-[760px] w-full items-center justify-center overflow-visible"
      aria-label="One Piece character card stack"
      onPointerMoveCapture={() => {
        if (isHoverSuppressed) {
          setIsHoverSuppressed(false);
        }
      }}
    >
      <div
        className="relative h-[542px] w-full"
        role="list"
        aria-live="polite"
      >
        {visibleCards.map((card, index) => {
          const position = getCardPosition(
            index,
            activeIndex,
            visibleCards.length,
            layoutMode,
          );
          const isActive = index === activeIndex;

          return (
            <ProfileCard
              key={card.id}
              card={card}
              isActive={isActive}
              flipPhase={flipState.cardId === card.id ? flipState.phase : "idle"}
              flipDirection={flipState.cardId === card.id ? flipState.direction : null}
              isGestureLocked={isGestureLocked}
              isHoverSuppressed={isHoverSuppressed}
              hoverResetToken={hoverResetToken}
              position={position}
              layoutMode={layoutMode}
              isCompactViewport={isCompactViewport}
              shouldReduceMotion={shouldReduceMotion}
              transition={transition}
              layoutTransitionDirection={layoutTransitionDirection}
              isLayoutTransitioning={isLayoutTransitioning}
              onSelect={() => handleSelectCard(card.id)}
              onToggleLayoutMode={handleToggleLayoutMode}
              onDragStart={() => handleDragStart(card.id)}
              onDragEnd={(_, info) => handleDragEnd(card.id, info)}
            />
          );
        })}
      </div>
    </section>
  );
}

function getCardPosition(
  cardIndex: number,
  activeIndex: number,
  cardCount: number,
  layoutMode: LayoutMode,
) {
  let offset = cardIndex - activeIndex;

  if (offset > Math.floor(cardCount / 2)) {
    offset -= cardCount;
  }

  if (offset < -Math.floor(cardCount / 2)) {
    offset += cardCount;
  }

  const positions = CARD_POSITIONS_BY_LAYOUT[layoutMode];

  return (
    positions.find((position) => position.offset === offset) ??
    positions[2]
  );
}

function getCardAtOffset(
  cards: ProfileCardData[],
  activeIndex: number,
  offset: number,
) {
  return cards[(activeIndex + offset + cards.length) % cards.length];
}

function getFlipRotation(phase: FlipPhase, direction: DragDirection | null) {
  const directionSign = direction === "left" ? -1 : 1;

  switch (phase) {
    case "committingToBack":
      return {
        rotateY: directionSign * 66,
        rotateX: 0.8,
        rotateZ: directionSign * 0.25,
      };
    case "showingBackFace":
      return {
        rotateY: directionSign * 176,
        rotateX: 1.4,
        rotateZ: directionSign * -0.35,
      };
    case "settlingIntoBack":
      return {
        rotateY: directionSign * 326,
        rotateX: 0.45,
        rotateZ: directionSign * -0.18,
      };
    case "complete":
      return { rotateY: directionSign * 360, rotateX: 0, rotateZ: 0 };
    case "dragging":
    case "idle":
    default:
      return { rotateY: 0, rotateX: 0, rotateZ: 0 };
  }
}

function getReturnMotion(phase: FlipPhase, direction: DragDirection | null) {
  const directionSign = direction === "left" ? -1 : direction === "right" ? 1 : 0;

  switch (phase) {
    case "committingToBack":
      return { x: directionSign * 44, y: -12, scale: 0.012, opacity: 1 };
    case "showingBackFace":
      return { x: directionSign * 96, y: -8, scale: 0.004, opacity: 1 };
    case "settlingIntoBack":
      return { x: 0, y: -6, scale: 0.012, opacity: 0.98 };
    case "complete":
      return { x: 0, y: 0, scale: 0, opacity: 1 };
    case "dragging":
    case "idle":
    default:
      return { x: 0, y: 0, scale: 0, opacity: 1 };
  }
}

function getReturnStackTransition(
  phase: FlipPhase,
  defaultTransition: Transition,
): Transition {
  switch (phase) {
    case "committingToBack":
      return { duration: 0.18, ease: returnEase };
    case "showingBackFace":
      return { duration: 0.26, ease: returnEase };
    case "settlingIntoBack":
      return { type: "spring", stiffness: 190, damping: 31, mass: 1 };
    case "complete":
      return { duration: 0.24, ease: returnEase };
    case "dragging":
    case "idle":
    default:
      return defaultTransition;
  }
}

function getLayoutTransitionDelay(
  offset: CardPosition["offset"],
  direction: LayoutTransitionDirection | null,
) {
  const absoluteOffset = Math.abs(offset);

  if (absoluteOffset === 0 || direction === null) {
    return 0;
  }

  if (direction === "opening") {
    return absoluteOffset * LAYOUT_TRANSITION_STAGGER_S;
  }

  return (2 - absoluteOffset) * LAYOUT_TRANSITION_STAGGER_S;
}

function getCardStackTransition({
  phase,
  defaultTransition,
  isLayoutTransitioning,
  layoutTransitionDirection,
  offset,
  shouldReduceMotion,
}: {
  phase: FlipPhase;
  defaultTransition: Transition;
  isLayoutTransitioning: boolean;
  layoutTransitionDirection: LayoutTransitionDirection | null;
  offset: CardPosition["offset"];
  shouldReduceMotion: boolean;
}): Transition {
  if (phase !== "idle" && phase !== "dragging") {
    return getReturnStackTransition(phase, defaultTransition);
  }

  if (!isLayoutTransitioning || layoutTransitionDirection === null) {
    return defaultTransition;
  }

  if (shouldReduceMotion) {
    return { duration: 0 };
  }

  return {
    ...layoutTransitionSpring,
    delay: getLayoutTransitionDelay(offset, layoutTransitionDirection),
  };
}

function getFlipTransition(phase: FlipPhase): Transition {
  switch (phase) {
    case "committingToBack":
      return { duration: 0.18, ease: returnEase };
    case "showingBackFace":
      return { duration: 0.26, ease: returnEase };
    case "settlingIntoBack":
      return { duration: 0.48, ease: [0.25, 0.9, 0.3, 1] };
    case "complete":
      return { duration: 0.24, ease: returnEase };
    case "dragging":
    case "idle":
    default:
      return { duration: 0 };
  }
}

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

type ProfileCardProps = {
  card: ProfileCardData;
  isActive: boolean;
  flipPhase: FlipPhase;
  flipDirection: DragDirection | null;
  isGestureLocked: boolean;
  isHoverSuppressed: boolean;
  hoverResetToken: number;
  position: CardPosition;
  layoutMode: LayoutMode;
  isCompactViewport: boolean;
  shouldReduceMotion: boolean;
  transition: Transition;
  layoutTransitionDirection: LayoutTransitionDirection | null;
  isLayoutTransitioning: boolean;
  onSelect: () => void;
  onToggleLayoutMode: () => void;
  onDragStart: () => void;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
};

function ProfileCard({
  card,
  isActive,
  flipPhase,
  flipDirection,
  isGestureLocked,
  isHoverSuppressed,
  hoverResetToken,
  position,
  layoutMode,
  isCompactViewport,
  shouldReduceMotion,
  transition,
  layoutTransitionDirection,
  isLayoutTransitioning,
  onSelect,
  onToggleLayoutMode,
  onDragStart,
  onDragEnd,
}: ProfileCardProps) {
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isInactivePointerPressing, setIsInactivePointerPressing] = useState(false);
  const hoverEndTimer = useRef<number | undefined>(undefined);
  const isPointerInside = useRef(false);
  const inactivePointerStart = useRef({ x: 0, y: 0 });
  const didInactivePointerDrag = useRef(false);
  const isSpreadMode = layoutMode === "spread";
  const isInactiveHoverEnabled = isSpreadMode;
  const layoutToggleLabel = isSpreadMode ? "Close stack" : "Open stack";
  const activeCardButtonLabel = isActive ? layoutToggleLabel : `Show ${card.name}`;
  const isCtaEnabled = isActive ? !isGestureLocked : isSpreadMode && !isGestureLocked;
  const shouldForceActiveCtaReveal = isActive && isCompactViewport;
  const focusLift =
    isSpreadMode && isKeyboardFocused
      ? !isActive
        ? -8
        : -3
      : 0;
  const hoverLift = isActive ? -4 : -10;
  const hoverScale = isActive ? position.scale + 0.006 : position.scale + 0.006;
  const canShowInactiveHover = !isInactivePointerPressing;
  const hasInactiveHoverReveal =
    !isActive &&
    isInactiveHoverEnabled &&
    canShowInactiveHover &&
    isCardHovered;
  const hasActiveHoverReveal = isActive && isCardHovered;
  const isSteppedForward =
    !isActive && (hasInactiveHoverReveal || isKeyboardFocused);
  const isFlipping = flipPhase !== "idle" && flipPhase !== "dragging";
  const isSettlingToBack =
    flipPhase === "settlingIntoBack" || flipPhase === "complete";
  const isInnerInactive = !isActive && Math.abs(position.offset) === 1;
  const outwardDirection = position.offset < 0 ? -1 : 1;
  const stepForwardX = isInnerInactive ? outwardDirection * 75 : 0;
  const activeStepX = isSteppedForward ? stepForwardX : 0;
  const returnMotion = getReturnMotion(flipPhase, flipDirection);
  const stackTransition = getCardStackTransition({
    phase: flipPhase,
    defaultTransition: transition,
    isLayoutTransitioning,
    layoutTransitionDirection,
    offset: position.offset,
    shouldReduceMotion,
  });

  const handleHoverStart = () => {
    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    isPointerInside.current = true;
    if (isGestureLocked) {
      setIsCardHovered(false);
      return;
    }

    if (!isSpreadMode && !isActive) {
      setIsCardHovered(false);
      return;
    }

    if (isHoverSuppressed) {
      setIsCardHovered(false);
      return;
    }

    if (isInactivePointerPressing) {
      setIsCardHovered(false);
      return;
    }

    setIsCardHovered(true);
  };

  const handleHoverEnd = () => {
    isPointerInside.current = false;
    hoverEndTimer.current = window.setTimeout(() => {
      setIsCardHovered(false);
    }, 120);
  };

  const handlePointerMove = (event: { clientX: number; clientY: number }) => {
    if (isGestureLocked) {
      setIsCardHovered(false);
      return;
    }

    if (isInactivePointerPressing) {
      const dragDistance = Math.hypot(
        event.clientX - inactivePointerStart.current.x,
        event.clientY - inactivePointerStart.current.y,
      );

      if (dragDistance > 4) {
        didInactivePointerDrag.current = true;
      }

      setIsCardHovered(false);
      setIsKeyboardFocused(false);
      return;
    }

    if (!isSpreadMode && !isActive) {
      setIsCardHovered(false);
      return;
    }

    if (!isHoverSuppressed && isPointerInside.current) {
      setIsCardHovered(true);
    }
  };

  const handlePointerDownCapture = (event: { clientX: number; clientY: number }) => {
    if (!isSpreadMode || isGestureLocked) {
      return;
    }

    if (isActive) {
      return;
    }

    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    inactivePointerStart.current = {
      x: event.clientX,
      y: event.clientY,
    };
    didInactivePointerDrag.current = false;
    setIsInactivePointerPressing(true);
    setIsCardHovered(false);
    setIsKeyboardFocused(false);
  };

  const handlePointerRelease = () => {
    setIsInactivePointerPressing(false);
    setIsCardHovered(false);
    setIsKeyboardFocused(false);
  };

  const handleCardButtonClick = () => {
    if (didInactivePointerDrag.current) {
      didInactivePointerDrag.current = false;
      return;
    }

    if (!isActive) {
      if (isSpreadMode && !isGestureLocked) {
        onSelect();
      }

      return;
    }
  };

  const handleCardButtonKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!isActive) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();

    if (!isGestureLocked) {
      onToggleLayoutMode();
    }
  };

  const handleActiveLayoutDoubleClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();

    if (isGestureLocked) {
      return;
    }

    onToggleLayoutMode();
  };

  useEffect(() => {
    if (isActive) {
      setIsKeyboardFocused(false);
      setIsInactivePointerPressing(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isInactivePointerPressing) {
      return;
    }

    const handleGlobalPointerRelease = () => {
      setIsInactivePointerPressing(false);
      setIsCardHovered(false);
      setIsKeyboardFocused(false);
    };

    window.addEventListener("pointerup", handleGlobalPointerRelease);
    window.addEventListener("pointercancel", handleGlobalPointerRelease);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerRelease);
      window.removeEventListener("pointercancel", handleGlobalPointerRelease);
    };
  }, [isInactivePointerPressing]);

  useEffect(() => {
    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    setIsCardHovered(false);
  }, [hoverResetToken]);

  useEffect(() => {
    if (!isGestureLocked) {
      return;
    }

    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    setIsCardHovered(false);
    setIsInactivePointerPressing(false);
    setIsKeyboardFocused(false);
  }, [isGestureLocked]);

  useEffect(() => {
    if (!isSpreadMode) {
      setIsCardHovered(false);
      setIsInactivePointerPressing(false);
      setIsKeyboardFocused(false);
    }
  }, [isSpreadMode]);

  useEffect(() => {
    return () => {
      if (hoverEndTimer.current !== undefined) {
        window.clearTimeout(hoverEndTimer.current);
      }
    };
  }, []);

  const flipRotation = getFlipRotation(flipPhase, flipDirection);
  const flipTransition = getFlipTransition(flipPhase);
  const backGlowOpacity = getBackGlowOpacity(flipPhase);
  const backGlowScale = getBackGlowScale(flipPhase);
  const backSurfaceGlowOpacity = getBackSurfaceGlowOpacity(flipPhase);
  const backEdgeGlowOpacity = getBackEdgeGlowOpacity(flipPhase);

  return (
    <motion.article
      className={[
        "absolute left-1/2 top-0 h-[542px] w-[361px] origin-center [perspective:1600px]",
        isSteppedForward ? "brightness-[1.015]" : "",
      ].join(" ")}
      style={{
        zIndex: isFlipping
          ? isSettlingToBack
            ? 3
            : 8
          : isSteppedForward
            ? isInnerInactive
              ? 6
              : 4
            : position.zIndex,
        marginLeft: CARD_WIDTH / -2,
      }}
      initial={false}
      animate={{
        x: position.x + activeStepX + returnMotion.x,
        y: position.y + focusLift + returnMotion.y,
        rotate: position.rotate,
        scale: position.scale + returnMotion.scale,
        opacity: position.opacity * returnMotion.opacity,
      }}
      whileHover={
        (!isSpreadMode && !isActive) ||
        shouldReduceMotion ||
        isGestureLocked ||
        isInactivePointerPressing ||
        (!isActive && !isInactiveHoverEnabled)
          ? undefined
          : {
              y: position.y + hoverLift,
              scale: hoverScale,
            }
      }
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onLostPointerCapture={handlePointerRelease}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      onPointerMove={handlePointerMove}
      transition={stackTransition}
      role="listitem"
      aria-current={isActive ? "true" : undefined}
      aria-label={`${card.name}, ${card.role}${isActive ? ", active card" : ""}`}
    >
      <motion.div
        className="relative h-full w-full rounded-[20px] [transform-style:preserve-3d]"
        initial={false}
        animate={flipRotation}
        transition={shouldReduceMotion ? { duration: 0 } : flipTransition}
        drag={isSpreadMode && isActive && !isGestureLocked}
        dragMomentum={false}
        dragElastic={0.12}
        dragSnapToOrigin
        dragTransition={dragSnapTransition}
        whileDrag={shouldReduceMotion ? undefined : { scale: 1.018 }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className={[
            "absolute inset-0 isolate rounded-[20px] p-5 shadow-card transition-[box-shadow,filter] duration-200 [backface-visibility:hidden]",
            isActive ? "bg-[#222222] text-white" : "bg-white text-black",
            isSteppedForward ? "shadow-[0_18px_42px_rgba(0,0,0,0.16)]" : "",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            className={[
              "pointer-events-none absolute inset-0 rounded-[20px] ring-1 transition-opacity duration-200",
              isSteppedForward ? "opacity-100 ring-black/10" : "opacity-0 ring-transparent",
            ].join(" ")}
          />

          <button
            type="button"
            className="absolute inset-0 z-10 rounded-[20px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-4"
            onClick={handleCardButtonClick}
            onDoubleClick={isActive ? handleActiveLayoutDoubleClick : undefined}
            onKeyDown={handleCardButtonKeyDown}
            onMouseDown={(event) => {
              if (isActive || isGestureLocked) {
                event.preventDefault();
              }
            }}
            onFocus={() => {
              if (isSpreadMode && !isActive && !isGestureLocked) {
                setIsKeyboardFocused(true);
              }
            }}
            onBlur={() => setIsKeyboardFocused(false)}
            tabIndex={!isSpreadMode && !isActive ? -1 : 0}
            aria-expanded={isActive ? isSpreadMode : undefined}
            aria-label={activeCardButtonLabel}
            aria-description={
              isActive
                ? `Press Enter or Space to ${layoutToggleLabel.toLowerCase()}. Double-click with a mouse to do the same.`
                : undefined
            }
            title={isActive ? `Double-click to ${layoutToggleLabel.toLowerCase()}` : undefined}
          />

          <div
            className={[
              "pointer-events-none relative z-20 flex h-[250px] w-[320px] items-start justify-center overflow-hidden rounded-[20px] pt-[33px]",
              isActive ? "bg-[#3f3f3f]" : "bg-[rgba(196,196,196,0.29)]",
            ].join(" ")}
          >
            <img
              src={card.imageSrc}
              alt={card.imageAlt}
              className={[
                "object-contain transition-[filter,opacity,transform] duration-200",
                isActive
                  ? ["h-[184px] w-[160px]", card.imageClassName ?? ""].join(" ")
                  : "h-[184px] w-[160px] grayscale saturate-0 contrast-75 opacity-70 mix-blend-multiply",
              ].join(" ")}
              draggable={false}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          </div>

          <CardCta
            isActive={isActive}
            name={card.name}
            position={position}
            isRevealed={
              shouldForceActiveCtaReveal ||
              hasActiveHoverReveal ||
              hasInactiveHoverReveal ||
              (!isActive && isKeyboardFocused)
            }
            isEnabled={isCtaEnabled}
            isLayoutExpanded={isSpreadMode}
            layoutToggleLabel={layoutToggleLabel}
            shouldReduceMotion={shouldReduceMotion}
            onSelect={onSelect}
            onToggleLayoutMode={isActive ? onToggleLayoutMode : undefined}
          />

          <div className="pointer-events-none relative z-20 mt-[39px] w-[332px]">
            <p
              className={[
                "text-[16px] font-medium leading-[19.36px]",
                isActive ? "text-white/70" : "text-black/70",
              ].join(" ")}
            >
              {card.role}
            </p>
            <h2 className="mt-2 text-[36px] font-semibold leading-[43.57px] tracking-normal">
              {card.name}
            </h2>
            <p
              className={[
                "mt-2 text-[16px] font-medium leading-[19.36px]",
                isActive ? "text-white" : "text-black/70",
              ].join(" ")}
            >
              {card.description}
            </p>
          </div>
        </div>

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
      </motion.div>
    </motion.article>
  );
}

type CardCtaProps = {
  isActive: boolean;
  name: string;
  position: CardPosition;
  isRevealed: boolean;
  isEnabled: boolean;
  isLayoutExpanded: boolean;
  layoutToggleLabel: string;
  shouldReduceMotion: boolean;
  onSelect: () => void;
  onToggleLayoutMode?: () => void;
};

function CardCta({
  isActive,
  name,
  position,
  isRevealed,
  isEnabled,
  isLayoutExpanded,
  layoutToggleLabel,
  shouldReduceMotion,
  onSelect,
  onToggleLayoutMode,
}: CardCtaProps) {
  const [isCtaFocused, setIsCtaFocused] = useState(false);
  const idleWidth = 40;
  const hoverWidth = isActive ? 126 : 132;
  const label = isActive ? layoutToggleLabel : "View work";
  const isExpanded = isRevealed || (isEnabled && isCtaFocused);
  const iconSize = isActive && isExpanded ? 20 : 24;
  const isLeftSide = position.offset < 0;
  const ctaTransition = shouldReduceMotion
    ? { duration: 0 }
    : isActive
      ? subtleTween
      : inactiveCtaTween;

  useEffect(() => {
    if (isActive || !isEnabled) {
      setIsCtaFocused(false);
    }
  }, [isActive, isEnabled]);

  return (
    <motion.button
      type="button"
      className={[
        "absolute top-[13px] z-30 flex h-10 items-center overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2",
        isLeftSide ? "left-[13px]" : "right-[13px]",
        isActive ? "bg-white text-[#0c0c0c]" : "bg-black text-white",
        !isEnabled ? "pointer-events-none" : "",
      ].join(" ")}
      initial={false}
      animate={{ width: isExpanded && !shouldReduceMotion ? hoverWidth : idleWidth }}
      transition={ctaTransition}
      onFocus={() => {
        if (isEnabled) {
          setIsCtaFocused(true);
        }
      }}
      onBlur={() => setIsCtaFocused(false)}
      onMouseDown={(event) => {
        if (!isEnabled || isActive) {
          event.preventDefault();
        }
      }}
      onClick={() => {
        if (!isEnabled) {
          return;
        }

        if (isActive) {
          onToggleLayoutMode?.();
          return;
        }

        if (!isActive) {
          onSelect();
        }
      }}
      tabIndex={isEnabled ? 0 : -1}
      aria-expanded={isActive ? isLayoutExpanded : undefined}
      aria-label={isActive ? label : `${label} for ${name}`}
      title={isActive ? label : undefined}
    >
      <motion.span
        aria-hidden="true"
        className="absolute left-2.5 top-[10px] whitespace-nowrap text-[16px] font-medium leading-[19.36px]"
        initial={false}
        animate={{
          opacity: isExpanded && !shouldReduceMotion ? 1 : 0,
          x: isExpanded && !shouldReduceMotion ? 0 : 6,
        }}
        transition={ctaTransition}
      >
        {label}
      </motion.span>
      <span
        className="absolute right-2 top-1/2 flex shrink-0 -translate-y-1/2 items-center justify-center"
        style={{
          width: iconSize,
          height: iconSize,
        }}
        aria-hidden="true"
      >
        <ArrowUpRight aria-hidden="true" className="h-full w-full stroke-[2]" />
      </span>
    </motion.button>
  );
}
