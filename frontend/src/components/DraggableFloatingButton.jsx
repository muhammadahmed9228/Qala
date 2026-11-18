import { useRef, useState } from "react";

const EDGE_GAP = 8;
const DRAG_THRESHOLD = 6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export default function DraggableFloatingButton({
  as: Element = "button",
  onClick,
  style,
  className = "",
  children,
  ...props
}) {
  const elementRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState(null);

  const handlePointerDown = (event) => {
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    const element = elementRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !element) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (distance < DRAG_THRESHOLD && !drag.moved) return;

    drag.moved = true;
    suppressClickRef.current = true;

    const maxLeft = window.innerWidth - element.offsetWidth - EDGE_GAP;
    const maxTop = window.innerHeight - element.offsetHeight - EDGE_GAP;

    setPosition({
      left: clamp(event.clientX - drag.offsetX, EDGE_GAP, maxLeft),
      top: clamp(event.clientY - drag.offsetY, EDGE_GAP, maxTop),
    });
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleClick = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }

    onClick?.(event);
  };

  const positionStyle = position
    ? { left: `${position.left}px`, top: `${position.top}px`, right: "auto", bottom: "auto" }
    : {};

  return (
    <Element
      ref={elementRef}
      {...props}
      style={{ ...style, ...positionStyle, touchAction: "none" }}
      className={`${className} select-none`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
    >
      {children}
    </Element>
  );
}
