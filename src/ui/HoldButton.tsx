import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface HoldButtonProps {
  /** How long the button must be held, in ms. */
  holdMs: number;
  onHeld: () => void;
  label: string;
  className?: string;
  children: ReactNode;
  testId?: string;
}

/**
 * A button that only fires after a deliberate press-and-hold, with a
 * progress ring. Used for the parent gear (3 s) and for leaving a session,
 * so stray taps can never trigger either.
 */
export function HoldButton({
  holdMs,
  onHeld,
  label,
  className = 'icon-button icon-button--ghost',
  children,
  testId,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | undefined>(undefined);
  const startedAt = useRef<number | null>(null);
  const held = useRef(onHeld);
  held.current = onHeld;

  const cancel = () => {
    startedAt.current = null;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    setProgress(0);
  };

  useEffect(() => cancel, []);

  const start = () => {
    startedAt.current = performance.now();
    const tick = () => {
      if (startedAt.current === null) return;
      const fraction = (performance.now() - startedAt.current) / holdMs;
      if (fraction >= 1) {
        cancel();
        held.current();
        return;
      }
      setProgress(fraction);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const circumference = 2 * Math.PI * 46;
  return (
    <button
      type="button"
      className={`hold-button ${className}`}
      aria-label={label}
      data-testid={testId}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
      {progress > 0 && (
        <svg className="hold-button__ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="46"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
      )}
    </button>
  );
}
