import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

void "JinozXD";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
