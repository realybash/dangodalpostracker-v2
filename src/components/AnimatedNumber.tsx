import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
}

export function AnimatedNumber({ value = 0, format }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    
    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const duration = 600; // Smooth 600ms transition
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Beautiful ease-out quad transition curve
      const easeProgress = progress * (2 - progress);
      const currentValue = startValue + (endValue - startValue) * easeProgress;
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  return <span>{format ? format(displayValue) : Math.round(displayValue).toString()}</span>;
}
