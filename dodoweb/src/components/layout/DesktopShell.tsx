import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { cx, tw } from "@/lib/tw";

const NAV_ITEMS: { to: string; label: string; icon: AppIconName }[] = [
  { to: "/habits", label: "Habits", icon: "repeat" },
  { to: "/notes", label: "Notes", icon: "file-text" },
  { to: "/tasks", label: "Tasks", icon: "check-square" },
  { to: "/calendar", label: "Calendar", icon: "calendar" },
  { to: "/profile", label: "Profile", icon: "user" },
];

const STACK_SCREEN_PATTERNS = [
  /^\/tasks\/[^/]+$/,
  /^\/habits\/[^/]+$/,
  /^\/notes\/[^/]+$/,
  /^\/settings(?:\/.*)?$/,
];

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
    animate: boolean;
  }>({
    left: 0,
    width: 0,
    ready: false,
    animate: false,
  });
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const hasInitRef = useRef(false);

  const activeItem = NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(item.to + "/"),
  );
  const isStackScreen = STACK_SCREEN_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  );
  const isFullBleedTabScreen = pathname === "/notes";
  const allowPageScroll = pathname === "/profile";
  const showBottomNav = !isStackScreen;
  const contentShellClassName = pathname.startsWith("/notes/")
    ? "flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5 xl:px-7 xl:pb-7 xl:pt-6"
    : isFullBleedTabScreen
    ? "h-full min-h-0 overflow-hidden px-0 pb-28 sm:pb-32 xl:pb-32"
    : isStackScreen
    ? "h-full min-h-0 overflow-hidden p-4 pb-6 sm:p-6 sm:pb-7 xl:p-7 xl:pb-7"
    : allowPageScroll
    ? "min-h-full p-4 pb-28 sm:p-6 sm:pb-32 xl:p-7 xl:pb-32"
    : "h-full min-h-0 overflow-hidden p-4 pb-28 sm:p-6 sm:pb-32 xl:p-7 xl:pb-32";

  const recalcPill = useCallback(() => {
    const activeTo = activeItem?.to ?? NAV_ITEMS[2].to;
    const activeNode = itemRefs.current[activeTo];

    if (!activeNode) {
      return;
    }

    const nextX = activeNode.offsetLeft;
    const nextWidth = activeNode.offsetWidth;

    if (!hasInitRef.current) {
      hasInitRef.current = true;
      setPillStyle({
        left: nextX,
        width: nextWidth,
        ready: true,
        animate: false,
      });
      return;
    }

    setPillStyle({
      left: nextX,
      width: nextWidth,
      ready: true,
      animate: true,
    });
  }, [activeItem]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(recalcPill);
    const settleTimer = window.setTimeout(recalcPill, 240);

    const onResize = () => recalcPill();
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [recalcPill]);

  return (
    <div className={tw.appShell}>
      <main
        className={cx(
          "relative h-[100dvh] min-h-[100dvh]",
          allowPageScroll
            ? "overflow-x-hidden overflow-y-auto"
            : "overflow-hidden",
        )}
      >
        <div className={contentShellClassName}>{children}</div>
      </main>

      {showBottomNav ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-2 z-40 flex justify-center px-5 pt-2"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          }}
        >
          <div className="pointer-events-auto max-w-full rounded-[40px] shadow-[0_10px_30px_var(--shadow)]">
            <nav className="max-w-[calc(100vw-40px)] overflow-x-auto rounded-[40px] bg-surface px-4 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="relative inline-flex min-w-max items-center justify-center overflow-hidden rounded-[34px]">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-[7px] rounded-[30px] bg-accent"
                  style={{
                    left: pillStyle.left,
                    width: pillStyle.width,
                    opacity: pillStyle.ready ? 1 : 0,
                    transform: "translateZ(0)",
                    transitionProperty: "left, width, opacity",
                    transitionDuration: pillStyle.animate
                      ? "340ms, 340ms, 140ms"
                      : "0ms, 0ms, 0ms",
                    transitionTimingFunction: pillStyle.animate
                      ? "cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1), linear"
                      : "linear, linear, linear",
                    willChange: "left, width",
                  }}
                />

                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.to === (activeItem?.to ?? NAV_ITEMS[2].to);
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      ref={(node) => {
                        itemRefs.current[item.to] = node;
                      }}
                      className={cx(
                        "relative z-[1] flex h-13 shrink-0 items-center justify-center gap-2.5 rounded-[30px] px-4 py-3.5 active:opacity-70 sm:px-5",
                        isActive ? "text-text" : "text-muted-text",
                      )}
                    >
                      <AppIcon
                        name={item.icon}
                        size={22}
                        color={isActive ? "var(--text)" : "var(--muted-text)"}
                      />
                      <span
                        className={cx(
                          "truncate whitespace-nowrap font-sans-bold text-sm leading-none tracking-[0.2px]",
                          isActive ? "text-text" : "text-muted-text",
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
