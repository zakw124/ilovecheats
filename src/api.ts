import type { DiscordMessagesResponse, Product, ProductsResponse } from "./types";

export async function fetchProducts() {
  const response = await fetch("/api/storefront/products");

  if (!response.ok) {
    throw new Error("Unable to load SellAuth products");
  }

  const payload = (await response.json()) as ProductsResponse;

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.data || payload.products || [];
}

export async function fetchProduct(productId: string | number) {
  const response = await fetch(`/api/storefront/products/${productId}`);

  if (!response.ok) {
    throw new Error("Unable to load SellAuth product");
  }

  const payload = (await response.json()) as Product | { data?: Product; product?: Product };

  if ("data" in payload && payload.data) {
    return payload.data;
  }

  if ("product" in payload && payload.product) {
    return payload.product;
  }

  return payload as Product;
}

export async function fetchProductStatus(productId: string | number) {
  const response = await fetch(`/api/storefront/products/${productId}/status`);

  if (!response.ok) {
    throw new Error("Unable to load product status");
  }

  return (await response.json()) as {
    statusText: string;
    statusColor: string;
    stock?: number;
  };
}

export async function createCheckout(input: {
  productId: string | number;
  variantId: string | number;
  email?: string;
  quantity?: number;
  coupon?: string;
  gateway?: string;
}) {
  const response = await fetch("/api/storefront/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quantity: 1,
      ...input
    })
  });

  if (!response.ok) {
    throw new Error("Unable to create checkout");
  }

  return (await response.json()) as {
    invoice_url?: string;
    hosted_url?: string;
    url?: string;
  };
}

export async function fetchDiscordMessages(limit = 8) {
  const response = await fetch(`/api/discord/messages?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Unable to load Discord chat");
  }

  return (await response.json()) as DiscordMessagesResponse;
}

export function getProductImage(product: Product, fallbackIndex: number) {
  const images = product.images || [];
  const firstImage = images[0];

  if (typeof firstImage === "string") {
    return firstImage;
  }

  if (firstImage?.url) {
    return firstImage.url;
  }

  if (firstImage?.src) {
    return firstImage.src;
  }

  if (firstImage?.path) {
    return firstImage.path;
  }

  const fallbackImages = [
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1605648916361-9bc12ad6a569?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80"
  ];

  return product.image || fallbackImages[fallbackIndex % fallbackImages.length];
}
