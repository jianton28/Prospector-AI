"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getTodaySnapshot = () => new Date().toISOString().split("T")[0];
const getServerTodaySnapshot = () => "";

export function useTodayStr(): string {
  return useSyncExternalStore(emptySubscribe, getTodaySnapshot, getServerTodaySnapshot);
}
