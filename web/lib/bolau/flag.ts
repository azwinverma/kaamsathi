/** Bolau feature-flag helpers shared by server and client code (pure, unit-tested). */
export const BOLAU_FLAG = "bolau";

/** A public flag-gated Bolau endpoint answers 200 when the flag is on (404 when off). */
export function bolauOnFromStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Client flags payload (`GET /flags`) → is Bolau on? Missing/unknown → off. */
export function bolauOnFromFlags(flags: Record<string, boolean> | null | undefined): boolean {
  return !!flags?.[BOLAU_FLAG];
}
