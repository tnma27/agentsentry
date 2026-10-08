"use client";

import { useCallback, useEffect, useState } from "react";
import type { SecurityEvent } from "@/lib/types";

const EVENTS_KEY = "agentsentry.events";
const MAX_EVENTS = 20;

/** Real gateway decisions from this browser session (sessionStorage only). Shared by the Agent and Repository labs. */
export function useSessionEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EVENTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (raw) setEvents(JSON.parse(raw) as SecurityEvent[]);
    } catch {
      /* storage unavailable: start empty */
    }
  }, []);

  const save = (next: SecurityEvent[]) => {
    try {
      sessionStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const addEvent = useCallback((event: SecurityEvent) => {
    setEvents((prev) => {
      const next = [event, ...prev].slice(0, MAX_EVENTS);
      save(next);
      return next;
    });
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    save([]);
  }, []);

  return { events, addEvent, clearEvents };
}
