import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "smile-map-favorites";

function loadFavorites(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "number");
    return [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>(loadFavorites);

  useEffect(() => {
    const sync = () => setFavorites(loadFavorites());
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  const toggleFavorite = useCallback((shopId: number) => {
    const current = loadFavorites();
    const next = current.includes(shopId)
      ? current.filter((id) => id !== shopId)
      : [...current, shopId];
    saveFavorites(next);
    setFavorites(next);
    notify();
  }, []);

  const isFavorite = useCallback(
    (shopId: number) => favorites.includes(shopId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
