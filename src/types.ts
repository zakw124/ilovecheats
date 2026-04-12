export type ProductVariant = {
  id?: number | string;
  name?: string;
  description?: string;
  instructions?: string;
  price?: number | string;
  stock?: number;
};

export type Product = {
  id: number | string;
  name: string;
  description?: string;
  meta_description?: string;
  instructions?: string;
  price?: number | string;
  currency?: string;
  stock?: number;
  path?: string;
  badge_text?: string;
  status_text?: string;
  status_color?: string;
  image?: string;
  images?: Array<{ url?: string; path?: string; src?: string } | string>;
  variants?: ProductVariant[];
  product_tabs?: Array<{
    id?: number | string;
    title?: string;
    content?: string;
    order?: number;
  }>;
};

export type ProductsResponse =
  | Product[]
  | {
      data?: Product[];
      products?: Product[];
      meta?: Record<string, unknown>;
    };
