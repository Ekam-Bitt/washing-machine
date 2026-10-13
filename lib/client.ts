"use client";

import type { Person } from "./types";

export async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong"), { status: res.status });
  return data;
}

const PROFILE_KEY = "wm:profile";

export function loadProfile(): Person {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return { name: p.name ?? "", room: p.room ?? "", phone: p.phone ?? "" };
  } catch {
    return { name: "", room: "", phone: "" };
  }
}

export function saveProfile(p: Person) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

export type PushSupport = "granted" | "default" | "denied" | "unsupported" | "needs-home-screen";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "needs-home-screen" : "unsupported";
  }
  return Notification.permission;
}

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Asks for notification permission and registers this device for pushes.
 * Call it straight from a click handler: Safari only shows the prompt then.
 */
export async function enablePush(test = false): Promise<PushSupport> {
  const support = pushSupport();
  if (support === "unsupported" || support === "needs-home-screen" || support === "denied") return support;
  const permission = support === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unsupported";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api("POST", "/api/push", { subscription: sub.toJSON(), test });
  return "granted";
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function minutesFromNow(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function clock(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
