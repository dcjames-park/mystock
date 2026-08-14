"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CHANGE_EVENT, STORAGE_KEYS } from "@/lib/data/local-store";
import type { LocalPost } from "@/lib/data/types";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getPostsSnapshot() {
  return window.localStorage.getItem(STORAGE_KEYS.posts) ?? "[]";
}

function getServerSnapshot() {
  return "[]";
}

function parsePosts(raw: string): LocalPost[] {
  try {
    return JSON.parse(raw) as LocalPost[];
  } catch {
    return [];
  }
}

export function useLocalPosts(): LocalPost[] {
  const raw = useSyncExternalStore(
    subscribe,
    getPostsSnapshot,
    getServerSnapshot,
  );
  return useMemo(() => parsePosts(raw), [raw]);
}

export function useLocalPost(id: string): LocalPost | null {
  const posts = useLocalPosts();
  return posts.find((item) => item.id === id) ?? null;
}
