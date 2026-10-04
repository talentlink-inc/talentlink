// One button system for the whole app (design review: "one button system:
// primary, secondary, danger, subtle"). A class helper rather than a
// component, so it works on <button>, <a> and <Link> alike.
export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerSoft" | "subtle" | "onDark";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary:
    "border border-black/15 bg-white text-black/80 hover:bg-black/[0.04] dark:border-white/15 dark:bg-transparent dark:text-white/85 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700",
  // Delete buttons that open a confirm dialog: visible, but not shouting.
  dangerSoft:
    "border border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950",
  subtle: "text-black/60 hover:bg-black/[0.05] hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white",
  // Secondary actions sitting on a slate page header.
  onDark: "border border-white/30 text-white hover:bg-white/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}
