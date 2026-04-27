import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  info: any;

  constructor(message: string, status: number, info: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.info = info;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let info: any = null;
    let message = res.statusText;

    try {
      const text = await res.text();
      try {
        info = JSON.parse(text);
        message = info.message || message;
      } catch {
        message = text || message;
      }
    } catch (e) {
      // Fallback if text() fails
    }

    throw new ApiError(message, res.status, info);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Import auth headers dynamically to avoid circular imports
  const { getAuthHeaders } = await import('./auth');
  const authHeaders = getAuthHeaders();

  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      // Import auth headers dynamically to avoid circular imports
      const { getAuthHeaders } = await import('./auth');
      const authHeaders = getAuthHeaders();

      const res = await fetch(queryKey.join("/") as string, {
        headers: authHeaders,
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000, // 2 minutes - optimize for perceived performance
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
