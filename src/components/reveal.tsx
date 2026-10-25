"use client";
import { motion, useReducedMotion } from "motion/react";
export function Reveal({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={false}
      whileInView={reduced ? {} : { opacity: [0.75, 1], y: [12, 0] }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
