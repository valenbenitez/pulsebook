import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/shared/auth/config";
import { ApiError } from "./api-error";
import { getAccessToken } from "./get-access-token";

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  throwOnUnauthorized?: boolean;
};

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    auth = false,
    throwOnUnauthorized = false,
    body,
    headers: initHeaders,
    ...rest
  } = options;

  const headers = new Headers(initHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = await getAccessToken();
    if (!token) {
      if (throwOnUnauthorized) {
        throw new ApiError(401, "Missing session");
      }
      redirect("/login");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(buildUrl(path), {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (res.status === 401 && auth && !throwOnUnauthorized) {
    redirect("/login");
  }

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = await res.text().catch(() => null);
    }

    const message =
      typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `Request failed with ${res.status}`;

    throw new ApiError(res.status, message, parsed);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}