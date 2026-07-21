// SPDX-License-Identifier: AGPL-3.0-only
import { validatePlan } from './model';
import type { Plan } from './types';

const KEY = 'triclinium.plan.v1';

export function loadPlan(): Plan | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    return validatePlan(JSON.parse(s));
  } catch {
    return null;
  }
}

export function savePlan(plan: Plan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    // storage full or unavailable — the plan still lives in memory
  }
}
