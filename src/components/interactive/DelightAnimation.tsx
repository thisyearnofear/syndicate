import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { animation } from "@/lib/constants/design";

/**
 * DelightAnimation
 *
 * Simple placeholder animation using Framer Motion.
 * Demonstrates micro‑interaction capability for Week 3.
 *
 * Props:
 * - children: ReactNode – content to animate
 *
 * The component follows the Core Principles:
 *   - MODULAR: isolated animation logic
 *   - PERFORMANT: lightweight motion config
 *   - DRY: reusable across the app
 */
export interface DelightAnimationProps {
  children: React.ReactNode;
}

/**
 * Fade‑in + scale animation.
 */

export const DelightAnimation: React.FC<DelightAnimationProps> = ({
  children,
}) => {
  const shouldReduce = useReducedMotion();

  const variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: shouldReduce ? 0 : animation.duration },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
};

export default DelightAnimation;
