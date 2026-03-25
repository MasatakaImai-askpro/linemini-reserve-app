import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "shop_admin";
  shopId: number | null;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) return null;
      return res.json();
    },
    staleTime: 30000,
    retry: false,
  });

  return { user: user ?? null, isLoading };
}

export function useLogin() {
  const [, navigate] = useLocation();

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ログインに失敗しました");
      return data as AuthUser;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate(`/admin/shop/${user.shopId}`);
      }
    },
  });
}

export function useLogout() {
  const [, navigate] = useLocation();

  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      navigate("/login");
    },
  });
}
