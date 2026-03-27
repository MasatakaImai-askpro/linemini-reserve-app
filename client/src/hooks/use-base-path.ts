import { useLocation } from "wouter";

export function useBasePath(): string {
  const [location] = useLocation();
  if (location.startsWith("/web-sp")) return "/web-sp";
  if (location.startsWith("/web")) return "/web";
  return "/app";
}
