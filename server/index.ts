import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { SellAuthError, shopPath, sellauthRequest, type SellAuthMethod } from "./sellauth.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || process.env.SERVER_PORT || 8787);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../dist");
const ssrEntryPath = path.resolve(__dirname, "../dist-ssr/entry-server.js");
const checkoutSchema = z.object({
  productId: z.union([z.number(), z.string()]),
  variantId: z.union([z.number(), z.string()]),
  quantity: z.number().int().min(1).max(100).default(1),
  email: z.string().email().optional(),
  coupon: z.string().min(1).optional(),
  gateway: z.string().min(1).optional()
});

type SellAuthProduct = {
  id?: number | string;
  path?: string;
  status_text?: string;
  status_color?: string;
  description?: string;
  instructions?: string;
};

type SellAuthShop = {
  url?: string;
};

type CacheEntry<T> = {
  expires: number;
  value: T;
};

let productsCache: CacheEntry<unknown> | null = null;
const productCache = new Map<string, CacheEntry<unknown>>();
const productStatusCache = new Map<string, CacheEntry<unknown>>();
const storefrontCacheMs = Number(process.env.STOREFRONT_CACHE_MS || 60000);

type DiscordApiMessage = {
  id: string;
  content?: string;
  timestamp?: string;
  author?: {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
  attachments?: Array<{
    filename?: string;
    url?: string;
  }>;
  embeds?: unknown[];
};

function getErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; message?: unknown };
    return String(record.message || record.error || "");
  }

  return String(payload || "");
}

async function getHostedProductUrl(productId: string | number) {
  const [shop, product] = await Promise.all([
    sellauthRequest<SellAuthShop>(shopPath()),
    sellauthRequest<SellAuthProduct>(shopPath(`products/${productId}`))
  ]);

  if (!shop.url || !product.path) {
    return undefined;
  }

  return `${shop.url.replace(/\/$/, "")}/product/${product.path}`;
}

function getPayloadProducts(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as SellAuthProduct[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as {
      data?: SellAuthProduct[];
      products?: SellAuthProduct[];
    };

    return record.data || record.products || [];
  }

  return [];
}

async function enrichProductStatuses(payload: unknown) {
  const products = getPayloadProducts(payload);

  await Promise.all(
    products.map(async (product) => {
      if (!product.id) {
        return;
      }

      try {
        const details = await sellauthRequest<SellAuthProduct>(
          shopPath(`products/${product.id}`)
        );

        product.status_text = details.status_text || product.status_text;
        product.status_color = details.status_color || product.status_color;
        product.description = details.description || product.description;
        product.instructions = details.instructions || product.instructions;
      } catch {
        // Keep the list usable if one detail lookup fails.
      }
    })
  );

  return payload;
}

async function cached<T>(entry: CacheEntry<T> | undefined | null, loader: () => Promise<T>) {
  if (entry && entry.expires > Date.now()) {
    return entry.value;
  }

  return loader();
}

async function getCachedProducts(query: URLSearchParams) {
  return cached(productsCache, async () => {
    const payload = await sellauthRequest(shopPath("products"), { query });
    const value = await enrichProductStatuses(payload);
    productsCache = {
      value,
      expires: Date.now() + storefrontCacheMs
    };
    return value;
  });
}

async function getCachedProduct(productId: string | number) {
  const key = String(productId);

  return cached(productCache.get(key), async () => {
    const value = await sellauthRequest(shopPath(`products/${productId}`));
    productCache.set(key, {
      value,
      expires: Date.now() + storefrontCacheMs
    });
    return value;
  });
}

async function getCachedProductStatus(productId: string | number) {
  const key = String(productId);

  return cached(productStatusCache.get(key), async () => {
    const product = await sellauthRequest<{
      status_text?: string;
      status_color?: string;
      stock?: number;
    }>(shopPath(`products/${productId}`));
    const value = {
      statusText: product.status_text || "Live",
      statusColor: product.status_color || "#21d66b",
      stock: product.stock
    };

    productStatusCache.set(key, {
      value,
      expires: Date.now() + storefrontCacheMs
    });
    return value;
  });
}

function serializeInitialData(payload: unknown) {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

async function getSsrProducts() {
  const query = new URLSearchParams();
  query.set("perPage", "48");
  query.set("page", "1");
  query.set("orderColumn", "products_sold");
  query.set("orderDirection", "desc");

  return getCachedProducts(query);
}

function getDiscordAvatarUrl(message: DiscordApiMessage, index: number) {
  const author = message.author;

  if (author?.id && author.avatar) {
    const extension = author.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${extension}?size=64`;
  }

  return `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`;
}

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "ILCFRONTEND",
    sellauthConfigured: Boolean(
      process.env.SELLAUTH_API_KEY && process.env.SELLAUTH_SHOP_ID
    )
  });
});

app.get("/api/storefront/products", async (request, response, next) => {
  try {
    const query = new URLSearchParams();
    query.set("perPage", String(request.query.perPage || 24));
    query.set("page", String(request.query.page || 1));
    query.set("orderColumn", String(request.query.orderColumn || "products_sold"));
    query.set("orderDirection", String(request.query.orderDirection || "desc"));

    response.json(await getCachedProducts(query));
  } catch (error) {
    next(error);
  }
});

app.get("/api/storefront/products/:productId", async (request, response, next) => {
  try {
    response.json(await getCachedProduct(request.params.productId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/storefront/products/:productId/status", async (request, response, next) => {
  try {
    response.json(await getCachedProductStatus(request.params.productId));
  } catch (error) {
    next(error);
  }
});

app.get("/api/discord/messages", async (request, response, next) => {
  try {
    const token = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const limit = Math.min(Math.max(Number(request.query.limit || 8), 1), 20);

    if (!token || !channelId) {
      response.json({
        configured: false,
        messages: []
      });
      return;
    }

    const discordResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
          "User-Agent": "ILCFRONTEND Discord Preview (https://ilovecheats.com, 1.0)"
        }
      }
    );

    if (!discordResponse.ok) {
      response.status(discordResponse.status).json({
        configured: true,
        error: "Unable to load Discord chat"
      });
      return;
    }

    const payload = (await discordResponse.json()) as DiscordApiMessage[];

    response.json({
      configured: true,
      messages: payload.reverse().map((message, index) => {
        const attachment = message.attachments?.[0];
        const hasEmbed = Boolean(message.embeds?.length);

        return {
          id: message.id,
          author: message.author?.global_name || message.author?.username || "Discord Member",
          avatarUrl: getDiscordAvatarUrl(message, index),
          content:
            message.content ||
            (attachment ? `Shared ${attachment.filename || "an attachment"}` : "") ||
            (hasEmbed ? "Shared an embed" : ""),
          timestamp: message.timestamp,
          attachmentUrl: attachment?.url,
          bot: Boolean(message.author?.bot)
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/storefront/checkout", async (request, response, next) => {
  try {
    const checkout = checkoutSchema.parse(request.body);
    const forwardedFor = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(",")[0]?.trim() || request.ip;
    const safeIp = ip === "::1" || ip === "127.0.0.1" ? "1.1.1.1" : ip;

    let payload: {
      success?: boolean;
      invoice_id?: number;
      invoice_url?: string;
      url?: string;
      hosted_url?: string;
      checkout_api_unavailable?: boolean;
    };

    try {
      payload = await sellauthRequest(shopPath("checkout"), {
        method: "POST",
        body: {
          cart: [
            {
              productId: checkout.productId,
              variantId: checkout.variantId,
              quantity: checkout.quantity
            }
          ],
          ip: safeIp,
          country_code: "US",
          user_agent: request.get("user-agent") || "Mozilla/5.0",
          email: checkout.email,
          coupon: checkout.coupon,
          gateway: checkout.gateway,
          newsletter: false
        }
      });
    } catch (error) {
      if (
        error instanceof SellAuthError &&
        getErrorMessage(error.payload).toLowerCase().includes("checkout api")
      ) {
        const hostedUrl = await getHostedProductUrl(checkout.productId);

        if (hostedUrl) {
          response.json({
            success: true,
            hosted_url: hostedUrl,
            checkout_api_unavailable: true
          });
          return;
        }
      }

      throw error;
    }

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.all("/api/sellauth/*path", async (request, response, next) => {
  if (process.env.SELLAUTH_PROXY_ENABLED !== "true") {
    response.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const rawPath = Array.isArray(request.params.path)
      ? request.params.path.join("/")
      : request.params.path;
    const query = new URLSearchParams();

    Object.entries(request.query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, String(item)));
      } else if (value !== undefined) {
        query.append(key, String(value));
      }
    });

    const payload = await sellauthRequest(rawPath, {
      method: request.method as SellAuthMethod,
      query,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body
    });

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.use(
  express.static(publicDir, {
    index: false,
    maxAge: process.env.NODE_ENV === "production" ? "1y" : 0
  })
);

app.use(async (request, response, next) => {
  try {
    const template = await fs.readFile(path.join(publicDir, "index.html"), "utf-8");
    let initialData = {};

    try {
      initialData = {
        products: getPayloadProducts(await getSsrProducts())
      };
    } catch {
      initialData = {
        products: [],
        productsError: "Loading live stock"
      };
    }

    const { render } = (await import(pathToFileURL(ssrEntryPath).href)) as {
      render: (url: string, data: unknown) => string;
    };
    const html = template
      .replace("<!--app-html-->", render(request.originalUrl, initialData))
      .replace(
        "{\"products\":[]}",
        serializeInitialData(initialData)
      );

    response
      .status(200)
      .set({ "Content-Type": "text/html" })
      .send(html);
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof SellAuthError) {
      response.status(error.status).json({
        error: "SellAuth request failed",
        ...(process.env.DEBUG_SELLAUTH_ERRORS === "true" ? { details: error.payload } : {})
      });
      return;
    }

    if (error instanceof Error && error.name === "ZodError") {
      response.status(500).json({
        error: "SellAuth environment variables are missing or invalid"
      });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Unexpected server error" });
  }
);

app.listen(port, "0.0.0.0", () => {
  console.log(`ILCFRONTEND listening on http://localhost:${port}`);
});
