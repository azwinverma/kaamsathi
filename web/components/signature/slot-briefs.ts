import "server-only";
import { cache } from "react";

/**
 * Request-scoped switch for showing photo-slot shot descriptions on the page (React `cache` is per
 * request in server components). On in development; in production only with `?slots=1`.
 */
const state = cache(() => ({ show: process.env.NODE_ENV === "development" }));

export function enableSlotBriefs(param: string | string[] | undefined) {
  if (param === "1" || (Array.isArray(param) && param.includes("1"))) state().show = true;
}

export function slotBriefsVisible(): boolean {
  return state().show;
}
