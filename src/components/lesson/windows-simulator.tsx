"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Windows 10 desktop simulator.
 *
 * A hands-on playground for the "کار با کیبورد و ماوس" lesson: the four mouse
 * moves are all practised here for real — single click selects, double click
 * opens, right click shows a context menu, and icons/windows are draggable.
 * Delete removes the selected icon to the Recycle Bin (where it can be
 * restored), and Esc closes whatever is open.
 *
 * The chrome is laid out left-to-right so it reads like the Windows desktop
 * learners will actually see; window bodies are right-to-left for Persian text.
 */

const ICON_SIZE = 80;
const ICON_GAP = 92;

const APPS = [
  { id: "explorer", label: "File Explorer", glyph: "FolderTree" },
  { id: "notepad", label: "Notepad", glyph: "Pencil" },
  { id: "word", label: "Word", glyph: "FileText" },
  { id: "excel", label: "Excel", glyph: "Table2" },
  { id: "browser", label: "مرورگر", glyph: "Globe" },
  { id: "settings", label: "تنظیمات", glyph: "Settings" },
] as const;

type DesktopIcon = {
  id: string;
  label: string;
  glyph: string;
  open: string; // app id to open, or "recycle"
  x: number;
  y: number;
};

const INITIAL_ICONS: DesktopIcon[] = [
  { id: "pc", label: "This PC", glyph: "Monitor", open: "explorer", x: 12, y: 12 },
  { id: "docs", label: "اسناد من", glyph: "FileText", open: "explorer", x: 12, y: 12 + ICON_GAP },
  { id: "images", label: "تصاویر", glyph: "Images", open: "explorer", x: 12, y: 12 + ICON_GAP * 2 },
  { id: "recycle", label: "سطل بازیافت", glyph: "Trash2", open: "recycle", x: 12, y: 12 + ICON_GAP * 3 },
];

type WindowState = {
  id: string;
  appId: string;
  title: string;
  glyph: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
};

/** The Recycle Bin is a window like the apps, but is not listed in Start. */
const RECYCLE_APP = { id: "recycle", label: "سطل بازیافت", glyph: "Trash2" };

function appMeta(appId: string) {
  return (
    APPS.find((app) => app.id === appId) ??
    (appId === RECYCLE_APP.id ? RECYCLE_APP : { id: appId, label: appId, glyph: "PlayCircle" })
  );
}

const WINDOW_W = 340;
const WINDOW_H = 210;

export function WindowsSimulator({ hint }: { hint?: string }) {
  const surface = useRef<HTMLDivElement>(null);

  const [icons, setIcons] = useState<DesktopIcon[]>(INITIAL_ICONS);
  const [trash, setTrash] = useState<DesktopIcon[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ iconId: string; x: number; y: number } | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [topZ, setTopZ] = useState(10);
  const [clock, setClock] = useState<string | null>(null);

  // Clock is filled in after mount so the server and client markup agree.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(now) +
          " • " +
          new Intl.DateTimeFormat("fa-IR", { month: "2-digit", day: "2-digit", year: "numeric" }).format(now),
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const focusWindow = (id: string) => {
    const z = topZ + 1;
    setTopZ(z);
    setWindows((current) => current.map((win) => (win.id === id ? { ...win, z, minimized: false } : win)));
  };

  const openApp = (appId: string) => {
    setStartOpen(false);
    setMenu(null);

    const z = topZ + 1;
    setTopZ(z);

    setWindows((current) => {
      const existing = current.find((win) => win.appId === appId);
      if (existing) {
        return current.map((win) => (win.id === existing.id ? { ...win, minimized: false, z } : win));
      }
      const index = current.length;
      return [
        ...current,
        {
          id: `${appId}-${index}`,
          appId,
          title: appMeta(appId).label,
          glyph: appMeta(appId).glyph,
          x: 48 + index * 26,
          y: 44 + index * 26,
          w: WINDOW_W,
          h: WINDOW_H,
          minimized: false,
          maximized: false,
          z,
        },
      ];
    });
  };

  const closeWindow = (id: string) => setWindows((current) => current.filter((win) => win.id !== id));

  const removeSelected = () => {
    if (!selected) return;
    const icon = icons.find((item) => item.id === selected);
    if (!icon) return;
    setIcons((current) => current.filter((item) => item.id !== selected));
    setTrash((current) => [...current, icon]);
    setSelected(null);
    setMenu(null);
  };

  const restoreIcon = (icon: DesktopIcon) => {
    setTrash((current) => current.filter((item) => item.id !== icon.id));
    setIcons((current) => [...current, icon]);
  };

  // Tracked in state (not read from the ref during render) so the context menu
  // can be kept inside the desktop.
  const [surfaceWidth, setSurfaceWidth] = useState(640);

  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const update = () => setSurfaceWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** Generic pointer drag for icons and window title bars. */
  const startDrag = (
    event: ReactPointerEvent,
    startX: number,
    startY: number,
    move: (x: number, y: number) => void,
    clamp: (x: number, y: number) => { x: number; y: number },
  ) => {
    // Only the primary button drags, so a right click still opens the menu.
    if (event.button !== 0) return;

    const originX = event.clientX;
    const originY = event.clientY;
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Not every pointer can be captured (synthetic events, some touch stacks);
      // the window-level listeners below are what actually drive the drag.
    }

    const onMove = (moveEvent: PointerEvent) => {
      const next = clamp(startX + (moveEvent.clientX - originX), startY + (moveEvent.clientY - originY));
      move(next.x, next.y);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const openWindows = windows.filter((win) => !win.minimized);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        ref={surface}
        dir="ltr"
        tabIndex={0}
        aria-label="شبیه‌سازی محیط ویندوز ۱۰"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setMenu(null);
            setStartOpen(false);
          }
          if (event.key === "Delete") removeSelected();
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelected(null);
            setMenu(null);
            setStartOpen(false);
          }
        }}
        className="relative h-80 overflow-hidden bg-gradient-to-br from-sky-300 via-sky-200 to-indigo-200 outline-none ring-inset select-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:from-sky-900 dark:via-slate-900 dark:to-indigo-950"
      >
        {/* Desktop icons */}
        {icons.map((icon) => {
          const Icon = getIcon(icon.glyph);
          const isSelected = selected === icon.id;

          return (
            <button
              key={icon.id}
              type="button"
              style={{ left: icon.x, top: icon.y, width: ICON_SIZE }}
              onClick={() => {
                setSelected(icon.id);
                setMenu(null);
              }}
              onDoubleClick={() => openApp(icon.open)}
              onContextMenu={(event) => {
                event.preventDefault();
                setSelected(icon.id);
                setStartOpen(false);
                setMenu({ iconId: icon.id, x: icon.x, y: icon.y });
              }}
              onPointerDown={(event) => {
                setSelected(icon.id);
                startDrag(
                  event,
                  icon.x,
                  icon.y,
                  (x, y) => setIcons((current) => current.map((item) => (item.id === icon.id ? { ...item, x, y } : item))),
                  (x, y) => ({
                    x: Math.max(0, Math.min(x, (surface.current?.clientWidth ?? 640) - ICON_SIZE)),
                    y: Math.max(0, Math.min(y, (surface.current?.clientHeight ?? 320) - 130)),
                  }),
                );
              }}
              className={cn(
                "absolute flex touch-none flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-[0.6875rem] text-white transition-colors",
                isSelected ? "bg-primary/40 ring-1 ring-white/70" : "hover:bg-white/20",
              )}
            >
              <Icon size={30} className="drop-shadow" aria-hidden="true" />
              <span className="line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{icon.label}</span>
            </button>
          );
        })}

        {/* Context menu (right click) */}
        {menu ? (
          <div
            style={{ left: Math.max(8, Math.min(menu.x + 90, surfaceWidth - 170)), top: menu.y }}
            className="absolute z-40 w-40 overflow-hidden rounded-lg border border-border bg-card/95 py-1 text-xs shadow-xl backdrop-blur"
            dir="rtl"
          >
            <MenuItem
              icon="FolderTree"
              label="باز کردن"
              onClick={() => {
                const icon = icons.find((item) => item.id === menu.iconId);
                if (icon) openApp(icon.open);
              }}
            />
            <MenuItem icon="Pencil" label="تغییر نام" onClick={() => setMenu(null)} />
            <MenuItem icon="Copy" label="کپی" onClick={() => setMenu(null)} />
            <div className="my-1 border-t border-border" />
            <MenuItem icon="Trash2" label="حذف" danger onClick={removeSelected} />
          </div>
        ) : null}

        {/* Windows */}
        {openWindows.map((win) => {
          const Icon = getIcon(win.glyph);
          return (
            <div
              key={win.id}
              style={{
                left: win.x,
                top: win.y,
                width: win.maximized ? "100%" : win.w,
                height: win.maximized ? "calc(100% - 40px)" : win.h,
                zIndex: win.z,
              }}
              onPointerDown={() => focusWindow(win.id)}
              className="absolute flex flex-col overflow-hidden rounded-t-lg border border-slate-400/60 bg-card shadow-2xl"
            >
              <div
                className="flex shrink-0 cursor-move touch-none items-center gap-2 bg-slate-800 px-2.5 py-1.5 text-white"
                onPointerDown={(event) =>
                  startDrag(
                    event,
                    win.x,
                    win.y,
                    (x, y) => setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, x, y } : item))),
                    (x, y) => ({
                      x: Math.max(0, Math.min(x, (surface.current?.clientWidth ?? 640) - win.w)),
                      y: Math.max(0, Math.min(y, (surface.current?.clientHeight ?? 320) - 90)),
                    }),
                  )
                }
              >
                <Icon size={13} aria-hidden="true" />
                <span className="truncate text-[0.6875rem] font-medium">{win.title}</span>
                <span className="ms-auto flex items-center">
                  <TitleBarButton label={`کوچک کردن ${win.title}`} glyph="Minus" onClick={() => setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, minimized: true } : item)))} />
                  <TitleBarButton label={`بزرگ کردن ${win.title}`} glyph={win.maximized ? "Minus" : "Copy"} onClick={() => setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, maximized: !item.maximized } : item)))} />
                  <TitleBarButton label={`بستن ${win.title}`} glyph="X" danger onClick={() => closeWindow(win.id)} />
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-card p-3 text-xs select-text" dir="rtl">
                <WindowBody appId={win.appId} trash={trash} onRestore={restoreIcon} />
              </div>
            </div>
          );
        })}

        {/* Start menu */}
        {startOpen ? (
          <div
            className="absolute bottom-10 z-50 w-60 rounded-lg border border-border bg-card/95 p-2 shadow-2xl backdrop-blur"
            style={{ left: 8 }}
            dir="rtl"
          >
            <p className="px-2 pb-1.5 text-[0.625rem] text-subtle-foreground">برنامه‌ها</p>
            <ul>
              {APPS.map((app) => {
                const Icon = getIcon(app.glyph);
                return (
                  <li key={app.id}>
                    <button
                      type="button"
                      onClick={() => openApp(app.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-xs hover:bg-muted"
                    >
                      <Icon size={15} aria-hidden="true" />
                      {app.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Taskbar */}
        <div className="absolute inset-x-0 bottom-0 z-50 flex h-10 items-center gap-1.5 bg-slate-900/85 px-1.5 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setStartOpen((open) => !open);
              setMenu(null);
            }}
            aria-expanded={startOpen}
            aria-label="منوی استارت"
            className="inline-flex size-8 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20"
          >
            <WindowsGlyph />
          </button>

          <span className="hidden items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[0.625rem] text-white/70 sm:inline-flex">
            <SearchGlyph />
            جستجو
          </span>

          <span className="flex min-w-0 flex-1 items-center gap-1">
            {windows.map((win) => {
              const Icon = getIcon(win.glyph);
              return (
                <button
                  key={win.id}
                  type="button"
                  onClick={() => (win.minimized ? focusWindow(win.id) : setWindows((current) => current.map((item) => (item.id === win.id ? { ...item, minimized: true } : item))))}
                  className={cn(
                    "inline-flex max-w-32 items-center gap-1.5 rounded-md px-2 py-1 text-[0.625rem] text-white transition-colors",
                    win.minimized ? "bg-white/10 hover:bg-white/20" : "border-b-2 border-primary bg-white/20",
                  )}
                >
                  <Icon size={12} aria-hidden="true" />
                  <span className="truncate">{win.title}</span>
                </button>
              );
            })}
          </span>

          <span className="shrink-0 px-1.5 text-[0.625rem] text-white/85" dir="rtl">
            {clock ?? "…"}
          </span>
          <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-white/20" />
        </div>
      </div>

      <p className="border-t border-border bg-card-muted px-3 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground" dir="rtl">
        {hint ?? "روی آیکون‌ها کلیک کنید، دوبار کلیک کنید تا باز شوند، کلیک راست کنید تا فهرست گزینه‌ها را ببینید و آیکون‌ها را بکشید."}
        {" "}با کلید <span className="font-bold">Esc</span> فهرست‌ها بسته می‌شوند و با کلید{" "}
        <span className="font-bold">Delete</span> آیکون انتخاب‌شده به سطل بازیافت می‌رود.
      </p>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const Icon = getIcon(icon);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2.5 py-1.5 text-start hover:bg-muted",
        danger ? "text-danger" : "text-foreground",
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </button>
  );
}

function TitleBarButton({
  label,
  glyph,
  onClick,
  danger,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const Icon = getIcon(glyph);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex size-6 items-center justify-center text-white/85 transition-colors hover:bg-white/20",
        danger && "hover:bg-danger",
      )}
    >
      <Icon size={12} aria-hidden="true" />
    </button>
  );
}

/** Small, static window contents — enough to feel like the real program. */
function WindowBody({
  appId,
  trash,
  onRestore,
}: {
  appId: string;
  trash: DesktopIcon[];
  onRestore: (icon: DesktopIcon) => void;
}) {
  if (appId === "recycle") {
    if (trash.length === 0) {
      return <p className="text-muted-foreground">سطل بازیافت خالی است.</p>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {trash.map((icon) => (
          <li key={icon.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate">{icon.label}</span>
            <button
              type="button"
              onClick={() => onRestore(icon)}
              className="shrink-0 rounded-md bg-primary-soft px-2 py-1 text-[0.625rem] font-medium text-primary"
            >
              بازگرداندن
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (appId === "explorer") {
    const entries = ["اسناد", "تصاویر", "دانلودها", "موسیقی", "ویدیوها"];
    return (
      <ul className="grid grid-cols-2 gap-1.5">
        {entries.map((entry) => (
          <li key={entry} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
            <FolderGlyph />
            {entry}
          </li>
        ))}
      </ul>
    );
  }

  if (appId === "notepad") {
    return (
      <textarea
        aria-label="یادداشت"
        rows={5}
        defaultValue={"اینجا می‌توانید تایپ کنید.\nکلید Enter خط جدید می‌سازد."}
        className="h-full w-full resize-none rounded-lg border border-border bg-card p-2 text-xs leading-relaxed outline-none focus-visible:border-primary"
      />
    );
  }

  if (appId === "word") {
    return (
      <div className="rounded-lg border border-border bg-white p-3 leading-loose shadow-inner dark:bg-card">
        <p className="text-center font-bold">گزارش تمرین</p>
        <p className="mt-2 text-muted-foreground">این یک سند Word شبیه‌سازی‌شده است.</p>
      </div>
    );
  }

  if (appId === "excel") {
    return (
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="bg-muted">
            <th className="border border-border px-2 py-1 font-bold">A</th>
            <th className="border border-border px-2 py-1 font-bold">B</th>
            <th className="border border-border px-2 py-1 font-bold">C</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["نام", "نمره", "وضعیت"],
            ["زهرا", "۱۸", "قبول"],
            ["علی", "۱۴", "قبول"],
          ].map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-border px-2 py-1">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (appId === "browser") {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
          <SearchGlyph />
          <span dir="ltr" className="text-[0.6875rem]">www.google.com</span>
        </div>
        <ul className="flex flex-col gap-2">
          {["آموزش ICDL چیست؟", "چگونه فایل را کپی کنم؟", "فرمول SUM در اکسل"].map((title) => (
            <li key={title} className="rounded-lg border border-border px-2.5 py-1.5">
              <span className="font-medium text-primary">{title}</span>
              <span dir="ltr" className="block text-[0.625rem] text-success">www.example.com</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (appId === "settings") {
    return (
      <ul className="flex flex-col gap-1.5">
        {["نمایش", "صدا", "زبان و منطقه", "شبکه و اینترنت"].map((row) => (
          <li key={row} className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5">
            <span>{row}</span>
            <SettingsGlyph />
          </li>
        ))}
      </ul>
    );
  }

  return <p className="text-muted-foreground">این پنجره شبیه‌سازی شده است.</p>;
}

// ─────────────────────────────────────────────────────────────
// Glyphs
// ─────────────────────────────────────────────────────────────

function WindowsGlyph() {
  const Icon = getIcon("LayoutDashboard");
  return <Icon size={16} aria-hidden="true" />;
}
function SearchGlyph() {
  const Icon = getIcon("Search");
  return <Icon size={13} aria-hidden="true" />;
}
function FolderGlyph() {
  const Icon = getIcon("FolderTree");
  return <Icon size={15} className="shrink-0 text-amber-500" aria-hidden="true" />;
}
function SettingsGlyph() {
  const Icon = getIcon("ChevronRight");
  return <Icon size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />;
}
