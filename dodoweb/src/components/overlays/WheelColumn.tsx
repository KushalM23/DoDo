"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/tw";
import { hapticImpact } from "@/utils/haptics";

type WheelColumnProps = {
  items: string[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  itemHeight?: number;
  visibleRowCount?: number;
};

export function WheelColumn({
  items,
  selectedIndex,
  onSelectedIndexChange,
  itemHeight = 48,
  visibleRowCount = 7,
}: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localIndex, setLocalIndex] = useState(selectedIndex);
  const hapticIndexRef = useRef(selectedIndex);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const halfDisplay = Math.floor(visibleRowCount / 2);
  const containerHeight = itemHeight * visibleRowCount;

  function clampIndex(index: number) {
    return Math.max(0, Math.min(items.length - 1, index));
  }

  function commitIndex(index: number, smooth = false) {
    if (!containerRef.current || items.length === 0) {
      return;
    }
    const nextIndex = clampIndex(index);
    const top = nextIndex * itemHeight;
    containerRef.current.scrollTo({
      top,
      behavior: smooth ? "smooth" : "auto",
    });
    setLocalIndex(nextIndex);
    onSelectedIndexChange(nextIndex);
  }

  useEffect(() => {
    setLocalIndex(selectedIndex);
    if (containerRef.current) {
      containerRef.current.scrollTop = selectedIndex * itemHeight;
    }
  }, [selectedIndex, itemHeight]);

  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const newIndex = clampIndex(Math.round(scrollTop / itemHeight));
    if (newIndex !== localIndex && newIndex >= 0 && newIndex < items.length) {
      setLocalIndex(newIndex);
      if (newIndex !== hapticIndexRef.current) {
        hapticIndexRef.current = newIndex;
        hapticImpact("soft");
      }
    }

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = setTimeout(() => {
      commitIndex(newIndex, false);
    }, 80);
  };

  const handleScrollEnd = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    commitIndex(Math.round(scrollTop / itemHeight), false);
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: containerHeight }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 -translate-y-1/2 rounded-control"
        style={{ height: itemHeight }}
      >
        <div
          className="absolute inset-0 rounded-control"
          style={{ backgroundColor: "var(--accent-light)" }}
        />
      </div>

      <div
        ref={containerRef}
        className="hide-scrollbar scrollbar-none h-full w-full snap-y snap-mandatory overflow-y-auto"
        style={{
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
        }}
        onScroll={handleScroll}
        onMouseUp={handleScrollEnd}
        onTouchEnd={handleScrollEnd}
      >
        <div
          style={{
            paddingTop: itemHeight * halfDisplay,
            paddingBottom: itemHeight * halfDisplay,
          }}
        >
          {items.map((item, index) => {
            const distance = Math.abs(index - localIndex);
            const isSelected = index === localIndex;

            let scale = 1;
            let opacity = 1;
            let rotateX = 0;

            if (distance === 1) {
              scale = 0.95;
              opacity = 0.45;
              rotateX = 8;
            } else if (distance >= 2) {
              scale = 0.85;
              opacity = 0.12;
              rotateX = 16;
            }

            return (
              <div
                key={`${item}-${index}`}
                className="flex cursor-pointer snap-center items-center justify-center transition-all duration-200"
                style={{
                  height: itemHeight,
                  transform: `perspective(800px) rotateX(${
                    isSelected ? 0 : rotateX
                  }deg) scale(${scale})`,
                  opacity,
                }}
                onClick={() => {
                  commitIndex(index, true);
                }}
              >
                <div
                  className={cx(
                    "select-none text-center",
                    isSelected
                      ? "font-sans-bold text-[28px] text-accent"
                      : "font-sans-medium text-[26px] text-muted-text",
                  )}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
