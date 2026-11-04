import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Transition,
} from "framer-motion";
import type { ProfileCardData } from "../data/cards";
import { CardBack } from "./CardBack";
import {
  TURN_BEATS_MS,
  getFlipRotation,
  getFlipTransition,
  getReturnMotion,
  getReturnStackTransition,
  getThrowDirection,
  liftTransition,
  wait,
  type DragDirection,
  type FlipPhase,
} from "./cardTurn";
import { useSnapBack } from "./useSnapBack";

/**
 * The stack under 640 px wide. Scaling the desktop stage down leaves cards too
 * small to read or throw, so here the front card is near full width with its
 * neighbours fanned behind it, and the stack is always open: a closed stack on
 * a phone is one more tap before anything works. It shares the turn with the
 * desktop stack. What differs is that a throw moves one place, so the card you
 * can see is the one that comes forward, and that a tap turns the front card
 * away, because cards this close together cannot swap layers in plain sight.
 */
type PhoneCardStackProps = {
  cards: ProfileCardData[];
  initialActiveIndex?: number;
  viewport: { width: number; height: number };
};

/** Which neighbour comes forward next: -1 is the card on the left, 1 the card on the right. */
type Side = -1 | 1;

type Slot = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  zIndex: number;
};

/** A tap turns the front card away, then tucks it behind the card you tapped. */
type TapPhase = "tapTurn" | "tapTuck";
type TurnPhase = FlipPhase | TapPhase;

type CardTurn = {
  phase: TurnPhase;
  direction: DragDirection;
  /** The finger's speed at release, so the card leaves at that speed. */
  releaseVelocity: number;
};

const CARD_MAX_WIDTH = 361;
const CARD_ASPECT = 542 / 361;
/** The share of the screen kept free on each side for the neighbours to peek into. */
const SIDE_GUTTER = 0.082;
/** How far the far cards hang below the front card, in card widths. */
const FAN_HANG = 0.17;
const FAN_MARGIN = 12;
/** The card's text size as a share of its width: 15 px on a 326 px card. */
const CARD_TEXT_SIZE = 15 / 326;
/** Keeps the turn's depth the same as on the 361 px desktop card with its 1600 px perspective. */
const CARD_PERSPECTIVE = 1600 / 361;

const NEAR_SLOT = { x: 0.1, y: 0.09, rotate: 3.5, scale: 0.96 };
const FAR_SLOT = { x: 0.17, y: 0.17, rotate: 7.5, scale: 0.92 };

const Z_FLYING = 8;
const Z_FRONT = 5;
const Z_NEAR = 3;
const Z_FAR = 1;
/** A card that has turned behind the new front lands in a near slot on the far side of the lead. */
const Z_TUCKED = Z_NEAR;

/** A release throws the card when it would coast past this share of the card's width. */
const THROW_DISTANCE = 0.3;
const TAP_SLOP = 10;
const TAP_MAX_MS = 400;
/** A press acts on pointer up, so the click a browser sends after it is ignored for this long. */
const CLICK_AFTER_PRESS_MS = 500;

/** Where a thrown card shows its back, in card widths from the stack: clear of it, and still on screen. */
const THROW_FLIGHT = 0.26;
const TAP_FLIGHT = 0.2;
const TAP_BEATS_MS = { tapTurn: 130, tapTuck: 390 } as const;
const DRAG_TILT = 6;

const slotSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 32,
  mass: 0.9,
};

function getCardWidth({ width, height }: PhoneCardStackProps["viewport"]) {
  return Math.floor(
    Math.min(
      CARD_MAX_WIDTH,
      width * (1 - SIDE_GUTTER * 2),
      (height - FAN_MARGIN * 2) / (CARD_ASPECT + FAN_HANG),
    ),
  );
}

function getRingOffset(cardIndex: number, activeIndex: number, cardCount: number) {
  let offset = cardIndex - activeIndex;

  if (offset > Math.floor(cardCount / 2)) {
    offset -= cardCount;
  }

  if (offset < -Math.floor(cardCount / 2)) {
    offset += cardCount;
  }

  return offset;
}

function getSlot(offset: number, cardWidth: number, leadSide: Side): Slot {
  if (offset === 0) {
    return { x: 0, y: 0, rotate: 0, scale: 1, zIndex: Z_FRONT };
  }

  const side = Math.sign(offset);
  const isNear = Math.abs(offset) === 1;
  const fan = isNear ? NEAR_SLOT : FAR_SLOT;

  return {
    x: side * fan.x * cardWidth,
    y: fan.y * cardWidth,
    rotate: side * fan.rotate,
    scale: fan.scale,
    zIndex: (isNear ? Z_NEAR : Z_FAR) + (side === leadSide ? 1 : 0),
  };
}

function isTapPhase(phase: TurnPhase | undefined): phase is TapPhase {
  return phase === "tapTurn" || phase === "tapTuck";
}

function getTapRotation(phase: TapPhase, sign: number) {
  return {
    rotateY: sign * (phase === "tapTurn" ? 90 : 360),
    rotateX: 0,
    rotateZ: 0,
  };
}

function getTapTransition(phase: TapPhase): Transition {
  return {
    duration: TAP_BEATS_MS[phase] / 1000,
    ease: phase === "tapTurn" ? "easeIn" : "easeOut",
  };
}

function getFlight(
  turn: CardTurn | undefined,
  cardWidth: number,
): { x: number; transition: Transition } {
  const sign = turn?.direction === "left" ? -1 : 1;

  switch (turn?.phase) {
    case undefined:
      return { x: 0, transition: { duration: 0 } };
    case "tapTurn":
      return {
        x: sign * cardWidth * TAP_FLIGHT,
        transition: getTapTransition("tapTurn"),
      };
    case "committingToBack":
    case "showingBackFace":
      return {
        x: sign * cardWidth * THROW_FLIGHT,
        transition: {
          type: "spring",
          stiffness: 240,
          damping: 30,
          velocity: turn.releaseVelocity,
        },
      };
    default:
      return {
        x: 0,
        transition: { type: "spring", stiffness: 190, damping: 31, mass: 1 },
      };
  }
}

export function PhoneCardStack({
  cards,
  initialActiveIndex = 2,
  viewport,
}: PhoneCardStackProps) {
  const stackCards = useMemo(() => cards.slice(0, 5), [cards]);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [turns, setTurns] = useState<Record<string, CardTurn>>({});
  const [leadSide, setLeadSide] = useState<Side>(1);
  const activeIndexRef = useRef(activeIndex);
  const turnsRef = useRef(turns);
  const sectionRef = useRef<HTMLElement>(null);
  const shouldFocusFront = useRef(false);
  const lastPressEnd = useRef(-Infinity);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const cardWidth = getCardWidth(viewport);
  const cardHeight = cardWidth * CARD_ASPECT;

  useEffect(() => {
    if (!shouldFocusFront.current) {
      return;
    }

    shouldFocusFront.current = false;
    sectionRef.current
      ?.querySelector<HTMLButtonElement>('[aria-current="true"] button')
      ?.focus();
  }, [activeIndex]);

  const setCardTurn = (cardId: string, turn: CardTurn | null) => {
    const nextTurns = { ...turnsRef.current };

    if (turn) {
      nextTurns[cardId] = turn;
    } else {
      delete nextTurns[cardId];
    }

    turnsRef.current = nextTurns;
    setTurns(nextTurns);
  };

  const isFrontTurning = () =>
    stackCards[activeIndexRef.current].id in turnsRef.current;

  const moveRing = (step: number) => {
    const nextIndex =
      (activeIndexRef.current + step + stackCards.length) % stackCards.length;

    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  };

  const throwFrontCard = async (
    cardId: string,
    direction: DragDirection,
    releaseVelocity: number,
  ) => {
    const step = direction === "left" ? 1 : -1;

    if (shouldReduceMotion) {
      moveRing(step);
      return;
    }

    const setPhase = (phase: FlipPhase) =>
      setCardTurn(cardId, { phase, direction, releaseVelocity });

    setPhase("committingToBack");
    await wait(TURN_BEATS_MS.committingToBack);

    setPhase("showingBackFace");
    await wait(TURN_BEATS_MS.showingBackFace);

    moveRing(step);
    setPhase("settlingIntoBack");
    await wait(TURN_BEATS_MS.settlingIntoBack);

    setPhase("complete");
    await wait(TURN_BEATS_MS.complete);

    setCardTurn(cardId, null);
  };

  const bringForward = async (offset: number) => {
    if (offset === 0 || isFrontTurning()) {
      return;
    }

    const frontCard = stackCards[activeIndexRef.current];

    setLeadSide(offset > 0 ? 1 : -1);

    if (shouldReduceMotion) {
      moveRing(offset);
      return;
    }

    const setPhase = (phase: TapPhase) =>
      setCardTurn(frontCard.id, {
        phase,
        direction: offset > 0 ? "left" : "right",
        releaseVelocity: 0,
      });

    setPhase("tapTurn");
    moveRing(offset);
    await wait(TAP_BEATS_MS.tapTurn);

    setPhase("tapTuck");
    await wait(TAP_BEATS_MS.tapTuck);

    setCardTurn(frontCard.id, null);
  };

  const handleLean = (dragOffset: number) => {
    if (dragOffset !== 0) {
      setLeadSide(dragOffset < 0 ? 1 : -1);
    }
  };

  const handleRelease = (cardId: string, { offset, velocity }: PanInfo) => {
    const direction = getThrowDirection(
      offset.x,
      velocity.x,
      cardWidth * THROW_DISTANCE,
    );

    if (!direction || isFrontTurning()) {
      return false;
    }

    void throwFrontCard(cardId, direction, velocity.x);
    return true;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();

    if (isFrontTurning()) {
      return;
    }

    shouldFocusFront.current = true;
    void bringForward(event.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <section
      ref={sectionRef}
      className="relative w-full touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
      style={{ height: cardHeight, marginTop: -cardWidth * FAN_HANG }}
      aria-label="Card stack"
      onKeyDown={handleKeyDown}
      onPointerUpCapture={(event) => {
        lastPressEnd.current = event.timeStamp;
      }}
      onClickCapture={(event) => {
        // The click can land on the new front card, so it is stopped here. A
        // click with no press before it is a keyboard or a screen reader.
        if (event.timeStamp - lastPressEnd.current < CLICK_AFTER_PRESS_MS) {
          event.stopPropagation();
        }
      }}
    >
      <div className="relative h-full w-full" role="list">
        {stackCards.map((card, index) => {
          const offset = getRingOffset(index, activeIndex, stackCards.length);

          return (
            <PhoneCard
              key={card.id}
              card={card}
              offset={offset}
              slot={getSlot(offset, cardWidth, leadSide)}
              turn={turns[card.id]}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              shouldReduceMotion={shouldReduceMotion}
              onBringForward={(cardOffset) => void bringForward(cardOffset)}
              onLean={handleLean}
              onRelease={(info) => handleRelease(card.id, info)}
            />
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {stackCards[activeIndex].name}
      </p>
    </section>
  );
}

type PhoneCardProps = {
  card: ProfileCardData;
  offset: number;
  slot: Slot;
  turn: CardTurn | undefined;
  cardWidth: number;
  cardHeight: number;
  shouldReduceMotion: boolean;
  onBringForward: (offset: number) => void;
  onLean: (dragOffset: number) => void;
  onRelease: (info: PanInfo) => boolean;
};

function PhoneCard({
  card,
  offset,
  slot,
  turn,
  cardWidth,
  cardHeight,
  shouldReduceMotion,
  onBringForward,
  onLean,
  onRelease,
}: PhoneCardProps) {
  const x = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const press = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDragging = useRef(false);
  const { snapBack, stopSnapBack } = useSnapBack(shouldReduceMotion, x);
  const isActive = offset === 0;
  const tapPhase = isTapPhase(turn?.phase) ? turn.phase : null;
  const flipPhase: FlipPhase =
    !turn || isTapPhase(turn.phase) ? "idle" : turn.phase;
  const turnSign = turn?.direction === "left" ? -1 : 1;
  // A tapped-away card stops being the front at once, but keeps its face until
  // it is edge-on, so it never fades while you can still see it.
  const showsFrontFace = isActive || tapPhase === "tapTurn";

  const tilt = useTransform(
    x,
    [-cardWidth, 0, cardWidth],
    shouldReduceMotion ? [0, 0, 0] : [-DRAG_TILT, 0, DRAG_TILT],
  );
  // The cards overlap almost completely, so a card only changes layer when it
  // is edge-on and has no visible width: the first edge for a tap, which clears
  // the way at once, and the second for a throw, which shows its back first.
  const tuckAngle = tapPhase ? 90 : 270;
  const turnZIndex = useTransform(rotateY, (angle) => {
    if (Math.abs(angle) < tuckAngle) {
      return Z_FLYING;
    }

    return isActive ? Z_FRONT : Z_TUCKED;
  });
  // A card in flight lets touches through, so the new front can be grabbed at once.
  const turnPointerEvents = useTransform(rotateY, (angle) =>
    Math.abs(angle) < tuckAngle ? "none" : "auto",
  );

  const returnMotion = getReturnMotion(flipPhase, turn?.direction ?? null);
  const flight = getFlight(turn, cardWidth);
  const rotation = tapPhase
    ? getTapRotation(tapPhase, turnSign)
    : getFlipRotation(flipPhase, turn?.direction ?? null);
  const turnTransition = tapPhase
    ? getTapTransition(tapPhase)
    : getFlipTransition(flipPhase);

  useEffect(() => {
    if (turn) {
      stopSnapBack();
    }
  }, [turn, stopSnapBack]);

  const bringThisSideForward = (button: HTMLElement, pressX?: number) => {
    if (!isActive) {
      onBringForward(offset);
      return;
    }

    const { left, width } = button.getBoundingClientRect();
    onBringForward(pressX === undefined || pressX >= left + width / 2 ? 1 : -1);
  };

  const handleDragEnd = (info: PanInfo) => {
    const wasThrown = onRelease(info);

    isDragging.current = false;

    if (!wasThrown) {
      snapBack([info.velocity.x]);
    } else if (shouldReduceMotion) {
      x.jump(0);
    }
  };

  /** A press can catch the card on its way back and let go without dragging it. */
  const finishPress = () => {
    press.current = null;

    if (!isDragging.current && x.get() !== 0) {
      snapBack();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    stopSnapBack();
    press.current = {
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    };
  };

  // Browsers can drop the click after a swipe, so a press acts on pointer up.
  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current;

    if (
      start &&
      event.timeStamp - start.time <= TAP_MAX_MS &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) <= TAP_SLOP
    ) {
      bringThisSideForward(event.currentTarget, event.clientX);
    }

    finishPress();
  };

  return (
    <motion.article
      className="absolute left-1/2 top-0 origin-center"
      style={{
        zIndex: turn ? turnZIndex : slot.zIndex,
        pointerEvents: turn ? turnPointerEvents : undefined,
        marginLeft: cardWidth / -2,
        width: cardWidth,
        height: cardHeight,
        fontSize: cardWidth * CARD_TEXT_SIZE,
        perspective: cardWidth * CARD_PERSPECTIVE,
      }}
      initial={false}
      animate={{
        x: slot.x,
        y: slot.y + returnMotion.y,
        rotate: slot.rotate,
        scale: slot.scale + returnMotion.scale,
        opacity: returnMotion.opacity,
      }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : getReturnStackTransition(flipPhase, slotSpring)
      }
      role="listitem"
      aria-current={isActive ? "true" : undefined}
      aria-label={`${card.name}, ${card.role}${isActive ? ", active card" : ""}`}
    >
      <motion.div
        className="relative h-full w-full rounded-[20px] [transform-style:preserve-3d]"
        style={{ x, rotateY, rotate: tilt }}
        initial={false}
        animate={{ ...rotation, x: flight.x }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { ...turnTransition, x: flight.transition, scale: liftTransition }
        }
        drag={isActive && !turn ? "x" : false}
        dragMomentum={false}
        whileDrag={shouldReduceMotion ? undefined : { scale: 1.018 }}
        onDragStart={() => {
          isDragging.current = true;
        }}
        onDrag={(_, info) => onLean(info.offset.x)}
        onDragEnd={(_, info) => handleDragEnd(info)}
      >
        <div
          className={[
            "absolute inset-0 isolate flex flex-col rounded-[1.25em] p-[1.1em] text-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.10)] transition-colors duration-[240ms] [backface-visibility:hidden]",
            showsFrontFace ? "bg-[#222222]" : "bg-white",
          ].join(" ")}
        >
          <button
            type="button"
            className={[
              "absolute inset-0 z-10 rounded-[1.25em] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-4",
              isActive ? "cursor-grab active:cursor-grabbing" : "",
            ].join(" ")}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={finishPress}
            onClick={(event) => bringThisSideForward(event.currentTarget)}
            aria-label={isActive ? "Show the next card" : `Show ${card.name}`}
          />

          <div
            className={[
              "pointer-events-none relative z-20 aspect-[320/250] w-full shrink-0 overflow-hidden rounded-[1.1em] transition-colors duration-[240ms]",
              showsFrontFace ? "bg-[#3f3f3f]" : "bg-[rgba(196,196,196,0.29)]",
            ].join(" ")}
          >
            <img
              src={card.imageSrc}
              alt={card.imageAlt}
              className={[
                "h-full w-full object-cover transition-[filter,opacity] duration-200",
                showsFrontFace ? "" : "opacity-70 contrast-75 grayscale saturate-0",
              ].join(" ")}
              draggable={false}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          </div>

          <div
            className={[
              "pointer-events-none relative z-20 mt-[1.3em] w-full transition-opacity duration-200",
              showsFrontFace ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <p className="text-[1em] font-medium leading-[1.3] text-white/70">
              {card.role}
            </p>
            <h2 className="mt-[0.2em] text-[2.1em] font-semibold leading-[1.2] tracking-normal">
              {card.name}
            </h2>
            <p className="mt-[0.4em] text-[1em] font-medium leading-[1.34]">
              {card.description}
            </p>
          </div>
        </div>

        <CardBack phase={flipPhase} shouldReduceMotion={shouldReduceMotion} />
      </motion.div>
    </motion.article>
  );
}
