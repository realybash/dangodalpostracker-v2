import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
}

export function AnimatedNumber({ value, format }: AnimatedNumberProps) {
  const isFirstRender = useRef(true);
  const spring = useSpring(value, { mass: 0.5, stiffness: 200, damping: 25 });
  const display = useTransform(spring, (latest) =>
    format ? format(latest) : Math.round(latest).toString()
  );

  useEffect(() => {
    if (isFirstRender.current) {
      spring.jump(value);
      isFirstRender.current = false;
    } else {
      spring.set(value);
    }
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}
