import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Risk darajalari — Safety Center va dashboard bo'ylab bir xil ranglar. */
export type RiskLevel = "red" | "orange" | "yellow" | "green";

export const RISK_STYLES: Record<
  RiskLevel,
  { label: string; dot: string; pill: string; row: string }
> = {
  red: {
    label: "Shoshilinch",
    dot: "bg-urgent",
    pill: "bg-urgent-bg text-urgent border border-urgent-line",
    row: "bg-urgent-bg",
  },
  orange: {
    label: "Jiddiy",
    dot: "bg-serious",
    pill: "bg-serious-bg text-serious border border-serious-line",
    row: "bg-serious-bg/60",
  },
  yellow: {
    label: "Ogohlantirish",
    dot: "bg-warn",
    pill: "bg-warn-bg text-warn border border-warn-line",
    row: "",
  },
  green: {
    label: "Xavfsiz",
    dot: "bg-safe",
    pill: "bg-safe-bg text-safe border border-safe-line",
    row: "",
  },
};
