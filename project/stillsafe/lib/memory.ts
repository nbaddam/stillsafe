// Opt-in, device-only memory. Nothing leaves the browser. Wrapped in try/catch because storage can be unavailable.
import type { Answers } from "./score";

export type Visit = { at: string; per1000: number; baseline: number; top: string[] };
/** Where they were when last saved, so a refresh resumes mid-intake and a later visit becomes a check-in. */
export type Session = {
  status: "intake" | "done";
  scope: "core" | "deep";
  returning: boolean;
  previous: Answers;       // saved answers being re-confirmed in a check-in round
  expectedWeeks?: number;  // weeks we expect them to be at now, for the check-in prompt
};
export type Memory = { enabled: boolean; answers: Answers; notes: string[]; visits: Visit[]; updatedAt: string; session?: Session };

const KEY = "stillsafe.memory.v1";

export function loadMemory(): Memory | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Memory) : null;
  } catch {
    return null;
  }
}

export function saveMemory(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...m, updatedAt: new Date().toISOString() }));
  } catch { /* storage unavailable: memory just won't persist */ }
}

export function forgetMemory() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
