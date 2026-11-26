import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useReading } from "@/lib/reading";

export function Shell({ children, mark }: { children: ReactNode; mark?: string }) {
  const theme = useReading((state) => state.theme);
  const setTheme = useReading((state) => state.setTheme);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const ghost = useRef<HTMLSpanElement>(null);
  const atHome = pathname === "/";

  useEffect(() => {
    void useReading.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const el = ghost.current;
    if (!el) return;
    let timer = 0;
    const paint = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 1) {
        el.style.opacity = "0";
        return;
      }
      const view = window.innerHeight;
      const thumb = Math.max(40, (view / document.documentElement.scrollHeight) * view);
      const y = (window.scrollY / max) * (view - thumb);
      el.style.height = `${thumb}px`;
      el.style.transform = `translateY(${y}px)`;
      el.style.opacity = "1";
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.style.opacity = "0";
      }, 700);
    };
    window.addEventListener("scroll", paint, { passive: true });
    return () => {
      window.removeEventListener("scroll", paint);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-parchment text-ink">
      <div className="veil" aria-hidden="true">
        <span
          className={mark ? "veil-mark" : "veil-cross"}
          style={mark ? { backgroundImage: `url("${mark}")` } : undefined}
        />
        <span className="veil-corner veil-tl" />
        <span className="veil-corner veil-tr" />
        <span className="veil-corner veil-bl" />
        <span className="veil-corner veil-br" />
      </div>
      <span ref={ghost} className="scroll-ghost" aria-hidden="true" />
      <div className="relative z-10">
        <header className="bar sticky top-0 z-30">
          <div className="relative mx-auto flex h-16 w-full max-w-5xl items-center px-4">
            {atHome ? (
              <Link to="/" search={{ q: "" }} className="mark" aria-label="موسوعة الكتاب المقدس" />
            ) : (
              <button
                type="button"
                className="back-btn"
                onClick={() => {
                  if (window.history.length > 1) window.history.back();
                  else void navigate({ to: "/", search: { q: "" } });
                }}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
                رجوع
              </button>
            )}
            <Link
              to="/"
              search={{ q: "" }}
              className="absolute inset-x-28 truncate text-center font-serif text-lg leading-tight"
            >
              موسوعة الكتاب المقدس
            </Link>
            <button
              type="button"
              className="panel ms-auto flex size-11 items-center justify-center rounded-full text-ink"
              onClick={() => setTheme(theme === "day" ? "night" : "day")}
              aria-label={theme === "day" ? "مظهر ليلي" : "مظهر نهاري"}
            >
              {theme === "day" ? (
                <Moon className="size-5" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Sun className="size-5" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
