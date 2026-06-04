import { useState, useCallback, useEffect } from "react";

const LIKED_KEY = "odekake-liked-shops";
const COUNTS_KEY = "odekake-like-counts";

function seedCount(shopId: number): number {
  return 30 + ((shopId * 37 + shopId * shopId * 7) % 120);
}

function loadLiked(): number[] {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

function loadCounts(): Record<number, number> {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveLiked(ids: number[]) {
  localStorage.setItem(LIKED_KEY, JSON.stringify(ids));
}

function saveCounts(counts: Record<number, number>) {
  localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function useLikes(shopId: number) {
  const [liked, setLiked] = useState<boolean>(() => loadLiked().includes(shopId));
  const [count, setCount] = useState<number>(() => {
    const counts = loadCounts();
    return counts[shopId] ?? seedCount(shopId);
  });

  useEffect(() => {
    const sync = () => {
      setLiked(loadLiked().includes(shopId));
      const counts = loadCounts();
      setCount(counts[shopId] ?? seedCount(shopId));
    };
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [shopId]);

  const like = useCallback(() => {
    const currentLiked = loadLiked();
    if (currentLiked.includes(shopId)) return;

    const nextLiked = [...currentLiked, shopId];
    saveLiked(nextLiked);

    const counts = loadCounts();
    const newCount = (counts[shopId] ?? seedCount(shopId)) + 1;
    counts[shopId] = newCount;
    saveCounts(counts);

    setLiked(true);
    setCount(newCount);
    notify();
  }, [shopId]);

  return { liked, count, like };
}
