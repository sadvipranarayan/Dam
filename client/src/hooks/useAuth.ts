import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isAuthenticated = !!user && !error;

  return {
    user: isAuthenticated ? user : undefined,
    isLoading,
    isAuthenticated,
  };
}
