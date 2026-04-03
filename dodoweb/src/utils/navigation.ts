const DEFAULT_FALLBACK_PATH = "/tasks";

function isUnsafePath(path: string) {
  return (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/register")
  );
}

export function sanitizeRedirectPath(
  rawPath: string | null | undefined,
  fallbackPath = DEFAULT_FALLBACK_PATH,
) {
  if (!rawPath) {
    return fallbackPath;
  }

  const path = rawPath.trim();
  if (!path || isUnsafePath(path)) {
    return fallbackPath;
  }

  return path;
}

type RouterWithBack = {
  back: () => void;
  replace: (href: string) => void;
};

function hasSameOriginReferrer() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.history.length <= 1 || !document.referrer) {
    return false;
  }

  try {
    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.origin !== window.location.origin) {
      return false;
    }

    return (
      !referrerUrl.pathname.startsWith("/login") &&
      !referrerUrl.pathname.startsWith("/register")
    );
  } catch {
    return false;
  }
}

export function backOrReplace(
  router: RouterWithBack,
  fallbackPath = DEFAULT_FALLBACK_PATH,
) {
  if (hasSameOriginReferrer()) {
    router.back();
    return;
  }

  router.replace(fallbackPath);
}
