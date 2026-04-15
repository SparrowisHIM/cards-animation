import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
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

export function FiveCardStack({
  cards,
  initialActiveIndex = 2,
}: FiveCardStackProps) {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const visibleCards = useMemo(() => cards.slice(0, 5), [cards]);
  const transition = shouldReduceMotion ? { duration: 0 } : cardSpring;

  return (
    <section
      className="relative mx-auto flex h-[760px] w-full items-center justify-center overflow-visible"
      aria-label="One Piece character card spread"
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
              position={position}
              shouldReduceMotion={shouldReduceMotion}
              transition={transition}
              onSelect={() => setActiveIndex(index)}
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

type ProfileCardProps = {
  card: ProfileCardData;
  isActive: boolean;
  position: CardPosition;
  shouldReduceMotion: boolean;
  transition: Transition;
  onSelect: () => void;
};

function ProfileCard({
  card,
  isActive,
  position,
  shouldReduceMotion,
  transition,
  onSelect,
}: ProfileCardProps) {
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const hoverEndTimer = useRef<number | undefined>(undefined);
  const focusLift = isKeyboardFocused && !isActive ? -8 : isKeyboardFocused ? -3 : 0;
  const hoverLift = isActive ? -4 : -10;
  const hoverScale = isActive ? position.scale + 0.006 : position.scale + 0.006;
  const isSteppedForward = !isActive && (isCardHovered || isKeyboardFocused);
  const isInnerInactive = !isActive && Math.abs(position.offset) === 1;
  const outwardDirection = position.offset < 0 ? -1 : 1;
  const stepForwardX = isInnerInactive ? outwardDirection * 75 : 0;
  const activeStepX = isSteppedForward ? stepForwardX : 0;

  const handleHoverStart = () => {
    if (hoverEndTimer.current !== undefined) {
      window.clearTimeout(hoverEndTimer.current);
    }

    setIsCardHovered(true);
  };

  const handleHoverEnd = () => {
    hoverEndTimer.current = window.setTimeout(() => {
      setIsCardHovered(false);
    }, 120);
  };

  useEffect(() => {
    if (isActive) {
      setIsKeyboardFocused(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (hoverEndTimer.current !== undefined) {
        window.clearTimeout(hoverEndTimer.current);
      }
    };
  }, []);

  return (
    <motion.article
      className={[
        "absolute left-1/2 top-0 isolate h-[542px] w-[361px] origin-center rounded-[20px] p-5 shadow-card transition-[box-shadow,filter] duration-200",
        isActive ? "bg-[#222222] text-white" : "bg-white text-black",
        isSteppedForward ? "shadow-[0_18px_42px_rgba(0,0,0,0.16)] brightness-[1.015]" : "",
      ].join(" ")}
      style={{
        zIndex: isSteppedForward ? (isInnerInactive ? 6 : 4) : position.zIndex,
        marginLeft: CARD_WIDTH / -2,
      }}
      initial={false}
      animate={{
        x: position.x + activeStepX,
        y: position.y + focusLift,
        rotate: position.rotate,
        scale: position.scale,
        opacity: position.opacity,
      }}
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              y: position.y + hoverLift,
              scale: hoverScale,
            }
      }
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      transition={transition}
      role="listitem"
      aria-current={isActive ? "true" : undefined}
      aria-label={`${card.name}, ${card.role}${isActive ? ", active card" : ""}`}
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
          if (!isActive) {
            onSelect();
          }
        }}
        onMouseDown={(event) => {
          if (isActive) {
            event.preventDefault();
          }
        }}
        onFocus={() => {
          if (!isActive) {
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
        isRevealed={isCardHovered || isKeyboardFocused}
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
