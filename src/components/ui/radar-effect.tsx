"use client";

import React from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

export const Circle = ({
  className,
  idx,
  style
}: {
  className?: string;
  idx: number;
  style?: React.CSSProperties;
}) => {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.1, duration: 0.2 }}
      className={twMerge("radar-circle", className)}
    />
  );
};

export const Radar = ({ className }: { className?: string }) => {
  const circles = new Array(6).fill(1);

  return (
    <div className={twMerge("radar-root", className)}>
      <div className="radar-sweep">
        <div />
      </div>
      {circles.map((_, idx) => (
        <Circle
          style={{
            height: `${(idx + 1) * 2.65}rem`,
            width: `${(idx + 1) * 5.3}rem`,
            borderColor: `rgba(255, 82, 119, ${0.58 - (idx + 1) * 0.06})`
          }}
          key={`circle-${idx}`}
          idx={idx}
        />
      ))}
    </div>
  );
};

export const IconContainer = ({
  icon,
  text,
  delay,
  position
}: {
  icon?: React.ReactNode;
  text?: string;
  delay?: number;
  position?: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: delay ?? 0 }}
      className={`radar-icon-container radar-icon-position-${position ?? 0}`}
    >
      <div className="radar-icon">{icon || <span />}</div>
      <div className="radar-icon-label">{text || "Signal"}</div>
    </motion.div>
  );
};

export function RadarPanel() {
  const icons = [
    { text: "Stock", symbol: "S", delay: 0.2 },
    { text: "Secure", symbol: "U", delay: 0.35 },
    { text: "Stealth", symbol: "R", delay: 0.5 }
  ];

  return (
    <div className="radar-panel" aria-label="Under the radar signals">
      <div className="radar-icons-row">
        {icons.map((item, index) => (
          <IconContainer
            text={item.text}
            delay={item.delay}
            icon={<span>{item.symbol}</span>}
            key={item.text}
            position={index}
          />
        ))}
      </div>
      <Radar className="radar-panel-radar" />
      <div className="radar-baseline" />
    </div>
  );
}
