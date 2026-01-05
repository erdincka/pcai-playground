export const API_BASE_URL = "/api";

export async function apiRequest(path: string, options: RequestInit = {}) {
    const token = typeof window !== "undefined" ? localStorage.getItem("pcai_token") : null;

    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "An error occurred" }));
        throw new Error(error.detail || response.statusText);
    }

    return response.json();
}

export const labsApi = {
    list: (params?: { category?: string; persona?: string }) => {
        const searchParams = new URLSearchParams(params as any).toString();
        return apiRequest(`/labs${searchParams ? `?${searchParams}` : ""}`);
    },
    get: (id: string) => apiRequest(`/labs/${id}`),
};

export const sessionsApi = {
    create: (labId: string) => apiRequest("/sessions", {
        method: "POST",
        body: JSON.stringify({ lab_id: labId }),
    }),
    listMy: () => apiRequest("/sessions/me"),
    extend: (id: string) => apiRequest(`/sessions/${id}/extend`, { method: "POST" }),
    terminate: (id: string) => apiRequest(`/sessions/${id}`, { method: "DELETE" }),
};

export const adminApi = {
    listSessions: (status?: string) => {
        const path = status ? `/admin/sessions?status=${status}` : "/admin/sessions";
        return apiRequest(path);
    },
    terminateSession: (id: string) => apiRequest(`/admin/sessions/${id}`, { method: "DELETE" }),
    getStats: () => apiRequest("/admin/stats"),
};
