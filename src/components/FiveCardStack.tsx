import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, type PanInfo, type Transition } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ProfileCardData } from "../data/cards";

type FiveCardStackProps = {
  cards: ProfileCardData[];
  initialActiveIndex?: number;
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

const CARD_POSITIONS: CardPosition[] = [
  { name: "far-left", offset: -2, x: -575, y: 72, rotate: -18, scale: 0.9, opacity: 1, zIndex: 1 },
  { name: "left", offset: -1, x: -325, y: 28, rotate: -8, scale: 0.94, opacity: 1, zIndex: 2 },
  { name: "center", offset: 0, x: 0, y: 0, rotate: 0, scale: 1.04, opacity: 1, zIndex: 5 },
  { name: "right", offset: 1, x: 325, y: 28, rotate: 8, scale: 0.94, opacity: 1, zIndex: 2 },
  { name: "far-right", offset: 2, x: 575, y: 72, rotate: 18, scale: 0.9, opacity: 1, zIndex: 1 },
];

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

const dragReturnThreshold = 140;
const returnEase: Transition["ease"] = [0.22, 1, 0.36, 1];

const wait = (duration: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

export function FiveCardStack({
  cards,
  initialActiveIndex = 2,
}: FiveCardStackProps) {
  const initialCards = useMemo(() => cards.slice(0, 5), [cards]);
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
  const shouldReduceMotion = useReducedMotion() ?? false;

  const visibleCards = orderedCards;
  const activeIndex = Math.max(
    0,
    visibleCards.findIndex((card) => card.id === activeCardId),
  );
  const isInteractionLocked =
    flipState.phase !== "idle" && flipState.phase !== "dragging";
  const transition = shouldReduceMotion ? { duration: 0 } : cardSpring;

  useEffect(() => {
    orderedCardsRef.current = orderedCards;
  }, [orderedCards]);

  useEffect(() => {
    orderedCardsRef.current = initialCards;
    sequenceToken.current += 1;
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
    if (isInteractionLocked) {
      return;
    }

    setActiveCardId(cardId);
  };

  const handleDragStart = (cardId: string) => {
    if (isInteractionLocked || cardId !== activeCardId) {
      return;
    }

    setFlipState({ phase: "dragging", cardId, direction: null });
  };

  const handleDragEnd = (cardId: string, info: PanInfo) => {
    if (cardId !== activeCardId || flipState.phase !== "dragging") {
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
      aria-label="One Piece character card spread"
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
          const position = getCardPosition(index, activeIndex, visibleCards.length);
          const isActive = index === activeIndex;

          return (
            <ProfileCard
              key={card.id}
              card={card}
              isActive={isActive}
              flipPhase={flipState.cardId === card.id ? flipState.phase : "idle"}
              flipDirection={flipState.cardId === card.id ? flipState.direction : null}
              isInteractionLocked={isInteractionLocked}
              isHoverSuppressed={isHoverSuppressed}
              hoverResetToken={hoverResetToken}
              position={position}
              shouldReduceMotion={shouldReduceMotion}
              transition={transition}
              onSelect={() => handleSelectCard(card.id)}
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
) {
  let offset = cardIndex - activeIndex;

  if (offset > Math.floor(cardCount / 2)) {
    offset -= cardCount;
  }

  if (offset < -Math.floor(cardCount / 2)) {
    offset += cardCount;
  }

  return (
    CARD_POSITIONS.find((position) => position.offset === offset) ??
    CARD_POSITIONS[2]
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
      return 0.82;
    case "settlingIntoBack":
      return 0.22;
    default:
      return 0;
  }
}

function getBackGlowScale(phase: FlipPhase) {
  switch (phase) {
    case "showingBackFace":
      return 1;
    case "settlingIntoBack":
      return 0.96;
    default:
      return 0.92;
  }
}

type ProfileCardProps = {
  card: ProfileCardData;
  isActive: boolean;
  flipPhase: FlipPhase;
  flipDirection: DragDirection | null;
  isInteractionLocked: boolean;
  isHoverSuppressed: boolean;
  hoverResetToken: number;
  position: CardPosition;
  shouldReduceMotion: boolean;
  transition: Transition;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
};

function ProfileCard({
  card,
  isActive,
  flipPhase,
  flipDirection,
  isInteractionLocked,
  isHoverSuppressed,
  hoverResetToken,
  position,
  shouldReduceMotion,
  transition,
  onSelect,
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
  const focusLift = isKeyboardFocused && !isActive ? -8 : isKeyboardFocused ? -3 : 0;
  const hoverLift = isActive ? -4 : -10;
  const hoverScale = isActive ? position.scale + 0.006 : position.scale + 0.006;
  const canShowInactiveHover = !isInactivePointerPressing;
  const isSteppedForward =
    !isActive && canShowInactiveHover && (isCardHovered || isKeyboardFocused);
  const isFlipping = flipPhase !== "idle" && flipPhase !== "dragging";
  const isSettlingToBack =
    flipPhase === "settlingIntoBack" || flipPhase === "complete";
  const isInnerInactive = !isActive && Math.abs(position.offset) === 1;
  const outwardDirection = position.offset < 0 ? -1 : 1;
  const stepForwardX = isInnerInactive ? outwardDirection * 75 : 0;
  const activeStepX = isSteppedForward ? stepForwardX : 0;
  const returnMotion = getReturnMotion(flipPhase, flipDirection);
  const stackTransition = getReturnStackTransition(flipPhase, transition);

  const handleHoverStart = () => {
    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    isPointerInside.current = true;
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

    if (!isHoverSuppressed && isPointerInside.current) {
      setIsCardHovered(true);
    }
  };

  const handlePointerDownCapture = (event: { clientX: number; clientY: number }) => {
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
        shouldReduceMotion || isInteractionLocked || isInactivePointerPressing
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
        drag={isActive && !isInteractionLocked}
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
            onClick={() => {
              if (didInactivePointerDrag.current) {
                didInactivePointerDrag.current = false;
                return;
              }

              if (!isActive && !isInteractionLocked) {
                onSelect();
              }
            }}
            onMouseDown={(event) => {
              if (isActive || isInteractionLocked) {
                event.preventDefault();
              }
            }}
            onFocus={() => {
              if (!isActive && !isInteractionLocked) {
                setIsKeyboardFocused(true);
              }
            }}
            onBlur={() => setIsKeyboardFocused(false)}
            aria-pressed={isActive}
            aria-label={`Show ${card.name}`}
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
            isRevealed={canShowInactiveHover && (isCardHovered || isKeyboardFocused)}
            shouldReduceMotion={shouldReduceMotion}
            onSelect={onSelect}
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
          className="pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[20px] bg-[#111111] shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <img
            src="/card-back.png"
            alt=""
            className="relative z-0 h-full w-full object-cover"
            draggable={false}
          />
          <motion.span
            className="absolute inset-0 z-10 rounded-[20px] bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.34),rgba(255,255,255,0.12)_34%,rgba(255,255,255,0)_72%)] blur-[10px]"
            initial={false}
            animate={{
              opacity: backGlowOpacity,
              scale: backGlowScale,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.28, ease: returnEase }
            }
          />
          <motion.span
            className="absolute inset-[1px] z-20 rounded-[19px] bg-[linear-gradient(145deg,rgba(255,255,255,0.2),rgba(255,255,255,0.04)_38%,rgba(0,0,0,0)_68%)]"
            initial={false}
            animate={{ opacity: backGlowOpacity * 0.72 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.24, ease: returnEase }
            }
          />
          <motion.span
            className="absolute inset-0 z-30 rounded-[20px] shadow-[inset_0_0_34px_rgba(255,255,255,0.13),inset_0_0_1px_rgba(255,255,255,0.34)]"
            initial={false}
            animate={{ opacity: backGlowOpacity * 0.9 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: returnEase }
            }
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
  shouldReduceMotion: boolean;
  onSelect: () => void;
};

function CardCta({
  isActive,
  name,
  position,
  isRevealed,
  shouldReduceMotion,
  onSelect,
}: CardCtaProps) {
  const [isCtaFocused, setIsCtaFocused] = useState(false);
  const idleWidth = 40;
  const hoverWidth = isActive ? 97 : 132;
  const label = isActive ? "Follow" : "View work";
  const isExpanded = isRevealed || isCtaFocused;
  const iconSize = isActive && isExpanded ? 20 : 24;
  const isLeftSide = position.offset < 0;
  const ctaTransition = shouldReduceMotion
    ? { duration: 0 }
    : isActive
      ? subtleTween
      : inactiveCtaTween;

  useEffect(() => {
    if (isActive) {
      setIsCtaFocused(false);
    }
  }, [isActive]);

  return (
    <motion.button
      type="button"
      className={[
        "absolute top-[13px] z-30 flex h-10 items-center overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2",
        isLeftSide ? "left-[13px]" : "right-[13px]",
        isActive ? "bg-white text-[#0c0c0c]" : "bg-black text-white",
      ].join(" ")}
      initial={false}
      animate={{ width: isExpanded && !shouldReduceMotion ? hoverWidth : idleWidth }}
      transition={ctaTransition}
      onFocus={() => setIsCtaFocused(true)}
      onBlur={() => setIsCtaFocused(false)}
      onMouseDown={(event) => {
        if (isActive) {
          event.preventDefault();
        }
      }}
      onClick={() => {
        if (!isActive) {
          onSelect();
        }
      }}
      aria-label={`${label} for ${name}`}
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
