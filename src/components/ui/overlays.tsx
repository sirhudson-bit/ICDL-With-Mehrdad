"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import { getIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Accessible overlay primitives.
 *
 * Thin wrappers over Radix so focus trapping, escape handling, scroll locking
 * and ARIA wiring come from a well-tested implementation rather than being
 * re-invented, while the visual language stays consistent with the design
 * system.
 */

/* ── Dialog ─────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const widths = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-[var(--animate-fade-in)] fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          // Centred with *physical* left/translate, not `start-1/2`. The logical
          // property resolves to `right: 50%` in RTL while `-translate-x-1/2`
          // stays physical, so every dialog landed off-centre against the left
          // edge in this RTL app.
          "animate-[var(--animate-pop)] fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-raised)] sm:p-6",
          "max-h-[calc(100dvh-3rem)] overflow-y-auto",
          widths,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="بستن"
        >
          <CloseGlyph />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, description, className }: { title: string; description?: string; className?: string }) {
  return (
    <div className={cn("mb-4 space-y-1 pe-10", className)}>
      <DialogPrimitive.Title className="text-base font-bold">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

/* ── Dropdown menu ──────────────────────────────────────────── */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[75] min-w-52 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-raised)]",
          "animate-[var(--animate-pop)]",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  children,
  asChild,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { icon?: string }) {
  const Icon = icon ? getIcon(icon) : null;
  const glyph = Icon ? (
    <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  ) : null;

  /*
   * With `asChild`, Radix hands our child to Slot, which requires exactly one
   * element. Rendering the glyph *beside* that child passed two children and
   * threw "Primitive.div failed to slot onto its children" the moment a menu
   * with icons opened — which is what made the account menu — and therefore the
   * admin panel — unreachable. When slotted, the glyph is injected into the
   * child instead.
   */
  const content =
    asChild && isValidElement(children) ? (
      cloneElement(
        children as ReactElement<{ children?: ReactNode }>,
        undefined,
        glyph,
        (children as ReactElement<{ children?: ReactNode }>).props.children,
      )
    ) : (
      <>
        {glyph}
        {children}
      </>
    );

  return (
    <DropdownMenuPrimitive.Item
      asChild={asChild}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors",
        "data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      {content}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DropdownMenuPrimitive.Label className={cn("px-3 py-2 text-xs text-muted-foreground", className)}>
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />;
}

/* ── Tabs ───────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "hide-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors",
        "hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4 outline-none", className)} {...props} />;
}

function CloseGlyph() {
  const Icon = getIcon("X");
  return <Icon size={16} aria-hidden="true" />;
}
