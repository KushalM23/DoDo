"use client";

import { useEffect } from "react";

function isElement(value: EventTarget | null): value is Element {
  return value instanceof Element;
}

function allowLocalZoomTarget(target: EventTarget | null): boolean {
  if (!isElement(target)) {
    return false;
  }
  return !!target.closest("[data-allow-local-zoom='true']");
}

function isBrowserZoomHotkey(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey) {
    return false;
  }

  return (
    event.key === "+" ||
    event.key === "=" ||
    event.key === "-" ||
    event.key === "_" ||
    event.key === "0" ||
    event.code === "NumpadAdd" ||
    event.code === "NumpadSubtract" ||
    event.code === "Numpad0"
  );
}

export function BrowserZoomGuard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isBrowserZoomHotkey(event)) {
        event.preventDefault();
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (allowLocalZoomTarget(event.target)) {
        return;
      }

      event.preventDefault();
    };

    const onGesture = (event: Event) => {
      if (allowLocalZoomTarget(event.target)) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("wheel", onWheel, { passive: false });

    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("gestureend", onGesture, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);

      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
    };
  }, []);

  return null;
}
