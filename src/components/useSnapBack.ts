import { useCallback, useRef } from "react";
import {
  animate,
  type AnimationPlaybackControls,
  type MotionValue,
  type Transition,
} from "framer-motion";
import { returnEase } from "./cardTurn";

const snapBackSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 38,
};

const reducedSnapBack: Transition = {
  duration: 0.12,
  ease: returnEase,
};

/**
 * Sends a dragged card home, and lets a new touch catch it on the way. The
 * controls live in a ref because the end of a drag can leave a motion value
 * without a reference to this animation, and then stopping the value would do
 * nothing.
 */
export function useSnapBack(
  shouldReduceMotion: boolean,
  x: MotionValue<number>,
  y?: MotionValue<number>,
) {
  const controls = useRef<AnimationPlaybackControls[]>([]);

  const stopSnapBack = useCallback(() => {
    controls.current.forEach((control) => control.stop());
    controls.current = [];
  }, []);

  const snapBack = useCallback(
    (velocities: number[] = [], transition: Transition = snapBackSpring) => {
      stopSnapBack();
      controls.current = (y ? [x, y] : [x]).map((value, index) =>
        animate(
          value,
          0,
          shouldReduceMotion
            ? reducedSnapBack
            : { ...transition, velocity: velocities[index] ?? 0 },
        ),
      );
    },
    [shouldReduceMotion, stopSnapBack, x, y],
  );

  return { snapBack, stopSnapBack };
}
