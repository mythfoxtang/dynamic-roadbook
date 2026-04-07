"use client";

const DAY_PLAN_STORAGE_KEY = "dynamic-roadbook-day-plan-v1";
const DAY_EXECUTION_STORAGE_KEY = "dynamic-roadbook-day-execution-v1";

function readJson(key) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Current local adapter. Swap these implementations for cloud APIs later.
export function loadDayPlans() {
  return readJson(DAY_PLAN_STORAGE_KEY);
}

export function saveDayPlans(value) {
  writeJson(DAY_PLAN_STORAGE_KEY, value);
}

export function loadDayExecutions() {
  return readJson(DAY_EXECUTION_STORAGE_KEY);
}

export function saveDayExecutions(value) {
  writeJson(DAY_EXECUTION_STORAGE_KEY, value);
}
