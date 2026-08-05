import React, { forwardRef, useState } from 'react';

// Lightweight motion proxy for high-performance mobile previews
export const motion = new Proxy(
  {},
  {
    get(_target, prop: string) {
      const MotionComponent = forwardRef<any, any>((props, ref) => {
        const {
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          whileFocus: _whileFocus,
          whileDrag: _whileDrag,
          whileInView: _whileInView,
          viewport: _viewport,
          layout: _layout,
          layoutId: _layoutId,
          layoutScroll: _layoutScroll,
          layoutDependency: _layoutDependency,
          drag: _drag,
          dragControls: _dragControls,
          dragListener: _dragListener,
          dragConstraints: _dragConstraints,
          dragDirectionLock: _dragDirectionLock,
          dragElastic: _dragElastic,
          dragMomentum: _dragMomentum,
          dragPropagation: _dragPropagation,
          dragSnapToOrigin: _dragSnapToOrigin,
          onDrag: _onDrag,
          onDragStart: _onDragStart,
          onDragEnd: _onDragEnd,
          onDirectionLock: _onDirectionLock,
          onDragTransitionEnd: _onDragTransitionEnd,
          variants: _variants,
          transformTemplate: _transformTemplate,
          onAnimationStart: _onAnimationStart,
          onAnimationComplete: _onAnimationComplete,
          onUpdate: _onUpdate,
          onPan: _onPan,
          onPanStart: _onPanStart,
          onPanEnd: _onPanEnd,
          onHoverStart: _onHoverStart,
          onHoverEnd: _onHoverEnd,
          onTap: _onTap,
          onTapStart: _onTapStart,
          onTapCancel: _onTapCancel,
          ...restProps
        } = props;
        const Component = prop as any;
        return <Component ref={ref} {...restProps} />;
      });
      MotionComponent.displayName = `Motion.${prop}`;
      return MotionComponent;
    }
  }
) as Record<string, React.ForwardRefExoticComponent<any>>;

export const AnimatePresence: React.FC<{ children: React.ReactNode; mode?: string }> = ({ children }) => {
  return <>{children}</>;
};

export function useSpring(initialValue: number, _config?: any) {
  const [val, setVal] = useState(initialValue);
  return {
    get: () => val,
    set: (v: number) => setVal(v),
    jump: (v: number) => setVal(v),
    onChange: (_fn: (v: number) => void) => () => {},
  };
}

export function useTransform(val: any, transformFn: (v: number) => any) {
  if (val && typeof val.get === 'function') {
    return transformFn(val.get());
  }
  return transformFn(typeof val === 'number' ? val : 0);
}
