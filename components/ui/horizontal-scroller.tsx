"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const SCROLL_STEP = 360;
const EDGE_TOLERANCE = 4;
const DRAG_EASING = 0.28;

export function HorizontalScroller({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, dragged: false });
  const dragTargetRef = useRef(0);
  const easingRef = useRef(DRAG_EASING);
  const animationFrameRef = useRef<number | null>(null);
  const boundaryFrameRef = useRef<number | null>(null);
  const canScrollRef = useRef({ left: false, right: false });
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const stopDragAnimation = useCallback(() => {
    if (animationFrameRef.current === null) return;
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const updateScrollBoundaries = useCallback(() => {
    if (boundaryFrameRef.current !== null) return;
    boundaryFrameRef.current = requestAnimationFrame(() => {
      boundaryFrameRef.current = null;
      const scroller = scrollRef.current;
      if (!scroller) return;

      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const next = {
        left: scroller.scrollLeft > EDGE_TOLERANCE,
        right: maxScrollLeft - scroller.scrollLeft > EDGE_TOLERANCE,
      };
      if (next.left === canScrollRef.current.left && next.right === canScrollRef.current.right) {
        return;
      }
      canScrollRef.current = next;
      setCanScroll(next);
    });
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    updateScrollBoundaries();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollBoundaries);
    resizeObserver?.observe(scroller);
    window.addEventListener("resize", updateScrollBoundaries);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollBoundaries);
      if (boundaryFrameRef.current !== null) {
        cancelAnimationFrame(boundaryFrameRef.current);
        boundaryFrameRef.current = null;
      }
      stopDragAnimation();
    };
  }, [stopDragAnimation, updateScrollBoundaries]);

  const animateTowardTarget = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const animate = () => {
      const scroller = scrollRef.current;
      if (!scroller) {
        animationFrameRef.current = null;
        return;
      }

      const remaining = dragTargetRef.current - scroller.scrollLeft;
      if (Math.abs(remaining) < 0.5) {
        scroller.scrollLeft = dragTargetRef.current;
        animationFrameRef.current = null;
        return;
      }

      scroller.scrollLeft += remaining * easingRef.current;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    stopDragAnimation();
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const target = Math.max(
      0,
      Math.min(maxScrollLeft, scroller.scrollLeft + (direction === "right" ? SCROLL_STEP : -SCROLL_STEP)),
    );
    scroller.scrollTo({ left: target, behavior: "smooth" });
  };

  return (
    <div className="group relative select-none">
      {canScroll.left && (
        <button
          aria-label={t("scrollLeft", { title })}
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/50 text-white/60 opacity-0 backdrop-blur transition group-hover:opacity-100"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label={title}
        onScroll={updateScrollBoundaries}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          scroll(event.key === "ArrowRight" ? "right" : "left");
        }}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.pointerType === "touch" || event.button !== 0) return;
          stopDragAnimation();
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: event.currentTarget.scrollLeft,
            dragged: false,
          };
          dragTargetRef.current = event.currentTarget.scrollLeft;
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag.pointerId !== event.pointerId) return;

          const distance = event.clientX - drag.startX;
          if (Math.abs(distance) > 4 && !drag.dragged) {
            drag.dragged = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (drag.dragged) {
            const maxScrollLeft = event.currentTarget.scrollWidth - event.currentTarget.clientWidth;
            dragTargetRef.current = Math.max(
              0,
              Math.min(maxScrollLeft, drag.startScrollLeft - distance),
            );
            easingRef.current = DRAG_EASING;
            animateTowardTarget();
          }
        }}
        onPointerUp={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) return;
          if (dragRef.current.dragged) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          dragRef.current.pointerId = -1;
        }}
        onPointerCancel={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) return;
          dragRef.current.pointerId = -1;
        }}
        onClickCapture={(event) => {
          if (!dragRef.current.dragged) return;
          event.preventDefault();
          event.stopPropagation();
          dragRef.current.dragged = false;
        }}
        className={`flex cursor-grab touch-pan-x touch-pan-y gap-3 overflow-x-auto pb-1 active:cursor-grabbing [scrollbar-width:none] ${className}`}
      >
        {children}
      </div>
      {canScroll.right && (
        <button
          aria-label={t("scrollRight", { title })}
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 translate-x-4 items-center justify-center rounded-full border border-white/12 bg-black/50 text-white/60 opacity-0 backdrop-blur transition group-hover:opacity-100"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
