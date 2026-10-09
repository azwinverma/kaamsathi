/** Client-safe copy of SkillLadder's rung mapping (components/signature/skill-ladder.tsx is server-only). */
export function rungsForLevelPure(level: number): number {
  const l = Math.max(0, Math.min(5, Math.round(level || 0)));
  return [1, 2, 3, 3, 4, 5][l];
}
