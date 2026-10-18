import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page container.
 *
 * Content pages previously stretched to 1400px, which is too wide for Persian
 * body text: line lengths became tiring to track and the layout read as a
 * dashboard rather than a course. These widths keep measure comfortable while
 * still leaving room for the sidebar and cards on large screens.
 */
const WIDTHS = {
  /** Full application chrome: header, footer, admin. */
  wide: "max-w-[1180px]",
  /** Default page content. */
  default: "max-w-[1040px]",
  /** Long-form reading, e.g. a lesson body. */
  reading: "max-w-[46rem]",
  /** Forms and focused flows. */
  narrow: "max-w-[30rem]",
} as const;

export type ContainerSize = keyof typeof WIDTHS;

export function Container({
  size = "default",
  className,
  children,
  as: Tag = "div",
}: {
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
}) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", WIDTHS[size], className)}>{children}</Tag>
  );
}
