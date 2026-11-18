import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import DraggableFloatingButton from "./DraggableFloatingButton";

const inMemoryScrollPositions = new Map();

function getScrollKey(loc) {
  return `${loc.pathname}${loc.search}`;
}

function savePosition(key, scrollY) {
  if (!key) return;
  inMemoryScrollPositions.set(key, scrollY);
  try {
    sessionStorage.setItem(`qala_scroll_${key}`, String(scrollY));
  } catch {
    // ignore
  }
}

function getPosition(key) {
  if (!key) return 0;
  if (inMemoryScrollPositions.has(key)) {
    return inMemoryScrollPositions.get(key);
  }
  try {
    const saved = sessionStorage.getItem(`qala_scroll_${key}`);
    if (saved !== null) {
      const num = Number(saved);
      return Number.isNaN(num) ? 0 : num;
    }
  } catch {
    // ignore
  }
  return 0;
}

function forceScrollTo(top = 0) {
  window.scrollTo({ top, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = top;
  }
}

export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const currentKeyRef = useRef(getScrollKey(location));
  const isProgrammaticScrollRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Disable native browser scroll restoration immediately
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const handleScrollButtonVisibility = () => {
      setShowScrollButton(window.scrollY > 280);
    };

    handleScrollButtonVisibility();
    window.addEventListener("scroll", handleScrollButtonVisibility, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollButtonVisibility);
  }, []);

  // Save scroll position on user scrolling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          savePosition(currentKeyRef.current, window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Handle route change
  useLayoutEffect(() => {
    const currentKey = getScrollKey(location);
    currentKeyRef.current = currentKey;
    isProgrammaticScrollRef.current = true;

    if (navType === "PUSH" || navType === "REPLACE") {
      // 1. New navigation (e.g. clicking footer links, navbar links, products):
      // ALWAYS force scroll to the very top immediately
      forceScrollTo(0);

      // Re-apply in next frames to guarantee top position across async DOM mounts
      const frame1 = requestAnimationFrame(() => {
        forceScrollTo(0);
        const frame2 = requestAnimationFrame(() => {
          forceScrollTo(0);
          isProgrammaticScrollRef.current = false;
        });
        return () => cancelAnimationFrame(frame2);
      });

      const timer = setTimeout(() => {
        forceScrollTo(0);
        isProgrammaticScrollRef.current = false;
      }, 50);

      return () => {
        cancelAnimationFrame(frame1);
        clearTimeout(timer);
      };
    }

    if (navType === "POP") {
      // 2. Browser Back / Forward button:
      const savedY = getPosition(currentKey);

      if (savedY <= 0) {
        forceScrollTo(0);
        const timer = setTimeout(() => {
          forceScrollTo(0);
          isProgrammaticScrollRef.current = false;
        }, 50);
        return () => clearTimeout(timer);
      }

      // If user was scrolled down, restore position once content is available
      let restored = false;
      const attemptRestore = () => {
        if (restored) return;
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll >= savedY * 0.9) {
          forceScrollTo(savedY);
          restored = true;
          isProgrammaticScrollRef.current = false;
        }
      };

      attemptRestore();

      const observer = new MutationObserver(() => {
        attemptRestore();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      const startTime = Date.now();
      const intervalId = setInterval(() => {
        if (restored || Date.now() - startTime > 2500) {
          clearInterval(intervalId);
          observer.disconnect();
          if (!restored) {
            forceScrollTo(0);
          }
          isProgrammaticScrollRef.current = false;
          return;
        }
        attemptRestore();
      }, 50);

      return () => {
        clearInterval(intervalId);
        observer.disconnect();
      };
    }

    forceScrollTo(0);
    isProgrammaticScrollRef.current = false;
  }, [location, navType]);

  const handleScrollToTop = () => {
    savePosition(currentKeyRef.current, 0);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return showScrollButton ? (
    <DraggableFloatingButton
      type="button"
      onClick={handleScrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      className="fixed bottom-24 right-6 z-[9998] flex h-12 w-12 items-center justify-center rounded-full border border-qala-bronze/60 bg-transparent text-qala-bronze shadow-sm transition hover:border-qala-bronze hover:text-qala-espresso hover:shadow-md"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 7-7 7 7M12 19V6" />
      </svg>
    </DraggableFloatingButton>
  ) : null;
}
