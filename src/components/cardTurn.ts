import type { Transition } from "framer-motion";

export type DragDirection = "left" | "right";

export type FlipPhase =
  | "idle"
  | "dragging"
  | "committingToBack"
  | "showingBackFace"
  | "settlingIntoBack"
  | "complete";

/** The four beats of a card's turn, in milliseconds. */
export const TURN_BEATS_MS = {
  committingToBack: 180,
  showingBackFace: 260,
  settlingIntoBack: 480,
  complete: 240,
} as const;

export const returnEase: Transition["ease"] = [0.22, 1, 0.36, 1];

const THROW_COAST_S = 0.15;
const THROW_MIN_OFFSET = 12;

export const liftTransition: Transition = {
  duration: 0.14,
  ease: returnEase,
};

/**
 * Reads a release. A throw is judged by where the card would coast to, so a
 * quick flick counts, but only towards the side the card is already on: a card
 * swung back towards the stack is a change of mind, however fast it moves.
 */
export function getThrowDirection(
  offset: number,
  velocity: number,
  distance: number,
): DragDirection | null {
  const coastedTo = offset + velocity * THROW_COAST_S;

  if (
    Math.abs(offset) < THROW_MIN_OFFSET ||
    Math.abs(coastedTo) < distance ||
    Math.sign(coastedTo) !== Math.sign(offset)
  ) {
    return null;
  }

  return coastedTo < 0 ? "left" : "right";
}

export const wait = (duration: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });

export function getFlipRotation(phase: FlipPhase, direction: DragDirection | null) {
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

export function getReturnMotion(phase: FlipPhase, direction: DragDirection | null) {
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

export function getReturnStackTransition(
  phase: FlipPhase,
  defaultTransition: Transition,
): Transition {
  switch (phase) {
    case "committingToBack":
      return { duration: TURN_BEATS_MS.committingToBack / 1000, ease: returnEase };
    case "showingBackFace":
      return { duration: TURN_BEATS_MS.showingBackFace / 1000, ease: returnEase };
    case "settlingIntoBack":
      return { type: "spring", stiffness: 190, damping: 31, mass: 1 };
    case "complete":
      return { duration: TURN_BEATS_MS.complete / 1000, ease: returnEase };
    case "dragging":
    case "idle":
    default:
      return defaultTransition;
  }
}

export function getFlipTransition(phase: FlipPhase): Transition {
  switch (phase) {
    case "committingToBack":
      return { duration: TURN_BEATS_MS.committingToBack / 1000, ease: returnEase };
    case "showingBackFace":
      return { duration: TURN_BEATS_MS.showingBackFace / 1000, ease: returnEase };
    case "settlingIntoBack":
      return {
        duration: TURN_BEATS_MS.settlingIntoBack / 1000,
        ease: [0.25, 0.9, 0.3, 1],
      };
    case "complete":
      return { duration: TURN_BEATS_MS.complete / 1000, ease: returnEase };
    case "dragging":
    case "idle":
    default:
      return { duration: 0 };
  }
}
