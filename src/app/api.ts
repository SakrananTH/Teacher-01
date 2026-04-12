import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase } from "./lib/supabase";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-80ad9986/api`;

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (!error && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  return null;
}

type AuthMode = "user" | "anon";

async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
  hasRetried = false,
  authMode: AuthMode = "user",
  accessTokenOverride?: string,
) {
  const accessToken = accessTokenOverride ?? (authMode === "anon" ? publicAnonKey : await getAccessToken());

  if (!accessToken) {
    throw new Error("SESSION_NOT_READY");
  }

  const headers: Record<string, string> = {
    apikey: publicAnonKey,
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (authMode === "user") {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !hasRetried && authMode === "user") {
    const refreshedToken = await getAccessToken(true);
    if (refreshedToken) {
      return fetchAPI(endpoint, options, true, authMode, refreshedToken);
    }
  }

  if (response.status === 401 && hasRetried && authMode === "user") {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Init
  initMockData: () => fetchAPI("/init", { method: "POST" }),

  // Students
  getStudents: () => fetchAPI("/students"),
  addStudent: (data: { id?: string; name: string; number: number; classRoom?: string }) =>
    fetchAPI("/students", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteStudent: (id: string) =>
    fetchAPI(`/students/${id}`, { method: "DELETE" }),

  // Attendance
  getAttendance: (date: string) => fetchAPI(`/attendance?date=${date}`),
  saveAttendance: (date: string, records: Record<string, string>) =>
    fetchAPI("/attendance", {
      method: "POST",
      body: JSON.stringify({ date, records }),
    }),

  // Savings
  getBalances: () => fetchAPI("/savings"),
  addTransaction: (data: {
    studentId: string;
    amount: number;
    type: "deposit" | "withdraw";
    date: string;
  }) =>
    fetchAPI("/savings/transaction", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTransactions: (studentId: string) =>
    fetchAPI(`/savings/transactions/${studentId}`),
};
