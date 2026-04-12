import { z } from "zod";

const envSchema = z.object({
  SELLAUTH_API_KEY: z.string().min(1),
  SELLAUTH_SHOP_ID: z.string().min(1),
  SELLAUTH_API_BASE: z.string().url().default("https://api.sellauth.com/v1")
});

export type SellAuthMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class SellAuthError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    super("SellAuth request failed");
    this.status = status;
    this.payload = payload;
  }
}

export function getSellAuthConfig() {
  return envSchema.parse({
    SELLAUTH_API_KEY: process.env.SELLAUTH_API_KEY,
    SELLAUTH_SHOP_ID: process.env.SELLAUTH_SHOP_ID,
    SELLAUTH_API_BASE:
      process.env.SELLAUTH_API_BASE || "https://api.sellauth.com/v1"
  });
}

export async function sellauthRequest<T>(
  path: string,
  options: {
    method?: SellAuthMethod;
    query?: URLSearchParams;
    body?: unknown;
  } = {}
) {
  const config = getSellAuthConfig();
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`${config.SELLAUTH_API_BASE.replace(/\/$/, "")}/${cleanPath}`);

  options.query?.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${config.SELLAUTH_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new SellAuthError(response.status, payload);
  }

  return payload as T;
}

export function shopPath(resource = "") {
  const { SELLAUTH_SHOP_ID } = getSellAuthConfig();
  const cleanResource = resource.replace(/^\/+/, "");
  return cleanResource
    ? `shops/${SELLAUTH_SHOP_ID}/${cleanResource}`
    : `shops/${SELLAUTH_SHOP_ID}`;
}
