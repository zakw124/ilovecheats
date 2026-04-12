import React, {
  cloneElement,
  isValidElement,
  useMemo,
  useState
} from "react";
import type {
  CSSProperties,
  MouseEvent,
  ReactElement,
  ReactNode
} from "react";
import { cn } from "@/lib/utils";

interface RippleState {
  key: number;
  x: number;
  y: number;
  size: number;
}

interface RippleEffectProps extends React.HTMLAttributes<HTMLElement> {
  children: ReactNode;
  rippleColor?: string;
  rippleDuration?: number;
  disabled?: boolean;
}

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

function RippleOverlay({
  ripples,
  color,
  duration
}: {
  ripples: RippleState[];
  color: string;
  duration: number;
}) {
  return (
    <div className="ripple-overlay">
      {ripples.map((ripple) => (
        <span
          className="ripple-wave"
          key={ripple.key}
          style={
            {
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              backgroundColor: color,
              "--ripple-duration": `${duration}ms`
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function RippleEffect({
  children,
  rippleColor,
  rippleDuration = 600,
  disabled = false,
  className,
  ...props
}: RippleEffectProps) {
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const color = useMemo(
    () => rippleColor || "rgba(255, 255, 255, 0.34)",
    [rippleColor]
  );

  function createRipple(event: MouseEvent<HTMLElement>) {
    if (disabled) {
      return;
    }

    const container = event.currentTarget;
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const newRipple = {
      key: Date.now(),
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
      size
    };

    setRipples((current) => [...current, newRipple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((ripple) => ripple.key !== newRipple.key));
    }, rippleDuration);
  }

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const child = children as ReactElement<{
    className?: string;
    children?: ReactNode;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
  const isVoid =
    typeof child.type === "string" && voidElements.has(child.type);

  if (isVoid) {
    return (
      <div
        className={cn("ripple-target", child.props.className, className)}
        onClick={createRipple}
        {...props}
      >
        {child}
        <RippleOverlay ripples={ripples} color={color} duration={rippleDuration} />
      </div>
    );
  }

  return cloneElement(child, {
    ...props,
    className: cn("ripple-target", child.props.className, className),
    onClick: (event: MouseEvent<HTMLElement>) => {
      createRipple(event);
      child.props.onClick?.(event);
    },
    children: (
      <>
        {child.props.children}
        <RippleOverlay ripples={ripples} color={color} duration={rippleDuration} />
      </>
    )
  });
}
