import { useEffect, useRef, useState } from "react";
import NeuralBackground from "@/components/ui/flow-field-background";
import SilkShader from "@/components/ui/bloodline";
import { RadarPanel } from "@/components/ui/radar-effect";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createCheckout,
  fetchProduct,
  fetchProductStatus,
  fetchProducts,
  getProductImage
} from "./api";
import type { Product, ProductVariant } from "./types";

type ProductFeature = {
  group: string;
  items: string[];
};

type StoreProduct = Product & {
  category?: string;
  gallery?: string[];
  platform?: string;
  detected?: boolean;
  features?: ProductFeature[];
};

declare global {
  interface Window {
    sellAuthEmbed?: {
      injectCaptcha?: () => void;
      injectStyles?: () => void;
      checkout: (
        element: HTMLElement,
        options: {
          cart: Array<{
            productId: number | string;
            variantId: number | string;
            quantity: number;
          }>;
          shopId: number;
          modal: boolean;
          scrollTop?: boolean;
        }
      ) => void | Promise<void>;
    };
  }
}

const sellAuthShopId = Number(import.meta.env.VITE_SELLAUTH_SHOP_ID || 134680);

const heroModels = [
  {
    id: "ak47-sheen",
    name: "AK47 Sheen",
    path: "/models/AK47Sheen.glb"
  },
  {
    id: "ak47",
    name: "AK47",
    path: "/models/AK47.glb"
  }
];

const fallbackProducts: StoreProduct[] = [
  {
    id: "windows-11-pro",
    name: "Windows 11 Pro Key",
    description:
      "Retail activation for fresh builds, gaming rigs, and workstations with instant delivery.",
    price: 19.99,
    currency: "USD",
    stock: 128,
    badge_text: "Instant delivery",
    category: "Operating System",
    platform: "Windows 10 & 11",
    detected: true,
    images: [
      "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=1200&q=85"
    ],
    gallery: [
      "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "1-day", name: "1 Day", price: 12.99, stock: 2 },
      { id: "3-days", name: "3 Days", price: 17.99, stock: 0 },
      { id: "1-week", name: "1 Week", price: 29.99, stock: 2 },
      { id: "1-month", name: "1 Month", price: 64.99, stock: 1 }
    ],
    features: [
      {
        group: "Activation",
        items: [
          "Retail activation key",
          "Fresh install support",
          "Digital delivery after checkout",
          "Works on custom PC builds",
          "Activation guide included"
        ]
      },
      {
        group: "Security",
        items: [
          "Private order delivery",
          "SellAuth fulfilment",
          "Receipt sent by email",
          "Support-ready order lookup"
        ]
      },
      {
        group: "Config",
        items: [
          "Instant stock sync",
          "Single-use product key",
          "Regional notes in checkout",
          "Refund rules shown before payment"
        ]
      }
    ]
  },
  {
    id: "office-2024",
    name: "Office 2024 Professional",
    description: "Lifetime productivity suite access for documents, sheets, mail, and decks.",
    price: 34.99,
    currency: "USD",
    stock: 72,
    badge_text: "Best seller",
    category: "Productivity",
    platform: "Windows 10 & 11",
    detected: true,
    images: [
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "home", name: "Home", price: 24.99, stock: 18 },
      { id: "pro", name: "Professional", price: 34.99, stock: 72 }
    ]
  },
  {
    id: "game-pass",
    name: "Game Pass Ultimate",
    description: "Stackable membership codes for cloud, console, and PC play.",
    price: 12.49,
    currency: "USD",
    stock: 45,
    badge_text: "Trending",
    category: "Gaming",
    platform: "Xbox & PC",
    detected: true,
    images: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "trial", name: "Trial", price: 4.99, stock: 20 },
      { id: "month", name: "1 Month", price: 12.49, stock: 45 }
    ]
  },
  {
    id: "security-suite",
    name: "Security Suite Premium",
    description: "Multi-device protection with fast account delivery.",
    price: 16.99,
    currency: "USD",
    stock: 91,
    badge_text: "Fresh stock",
    category: "Security",
    platform: "Windows, macOS, Android",
    detected: true,
    images: [
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "1-device", name: "1 Device", price: 16.99, stock: 91 },
      { id: "5-device", name: "5 Devices", price: 29.99, stock: 34 }
    ]
  },
  {
    id: "developer-vpn",
    name: "Developer VPN Pro",
    description: "Fast private browsing plan for testers, traders, and remote work.",
    price: 9.99,
    currency: "USD",
    stock: 60,
    badge_text: "Hot",
    category: "Privacy",
    platform: "All devices",
    images: [
      "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "month", name: "1 Month", price: 9.99, stock: 60 },
      { id: "year", name: "1 Year", price: 54.99, stock: 12 }
    ]
  },
  {
    id: "creative-cloud",
    name: "Creator Toolkit Access",
    description: "Design, video, and asset tooling access for creators shipping daily.",
    price: 27.99,
    currency: "USD",
    stock: 23,
    badge_text: "Limited",
    category: "Creative",
    platform: "Windows & macOS",
    images: [
      "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "standard", name: "Standard", price: 27.99, stock: 23 },
      { id: "studio", name: "Studio", price: 49.99, stock: 8 }
    ]
  },
  {
    id: "steam-wallet",
    name: "Steam Wallet Code",
    description: "Top up your account for new releases, DLC, and in-game items.",
    price: 20,
    currency: "USD",
    stock: 140,
    badge_text: "Instant",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Gaming",
    platform: "Steam",
    images: [
      "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "20", name: "$20", price: 20, stock: 140 },
      { id: "50", name: "$50", price: 50, stock: 66 }
    ]
  },
  {
    id: "playstation-plus",
    name: "PlayStation Plus Essential",
    description: "Membership access for multiplayer, monthly games, and cloud saves.",
    price: 10.99,
    currency: "USD",
    stock: 34,
    badge_text: "Console",
    status_text: "Low Stock",
    status_color: "#f4b740",
    category: "Gaming",
    platform: "PlayStation",
    images: [
      "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [
      { id: "1-month", name: "1 Month", price: 10.99, stock: 34 },
      { id: "12-month", name: "12 Months", price: 69.99, stock: 5 }
    ]
  },
  {
    id: "xbox-live",
    name: "Xbox Core Pass",
    description: "Online multiplayer and selected catalogue access for Xbox players.",
    price: 8.99,
    currency: "USD",
    stock: 48,
    badge_text: "Fast",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Gaming",
    platform: "Xbox",
    images: [
      "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "1-month", name: "1 Month", price: 8.99, stock: 48 }]
  },
  {
    id: "windows-server",
    name: "Windows Server Key",
    description: "Server activation for labs, small business boxes, and admin stacks.",
    price: 44.99,
    currency: "USD",
    stock: 19,
    badge_text: "Admin",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Operating System",
    platform: "Windows Server",
    images: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "standard", name: "Standard", price: 44.99, stock: 19 }]
  },
  {
    id: "mac-utility",
    name: "Mac Utility Bundle",
    description: "Cleanup, password, backup, and workflow utilities for macOS setups.",
    price: 18.49,
    currency: "USD",
    stock: 25,
    badge_text: "Bundle",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Productivity",
    platform: "macOS",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "bundle", name: "Bundle", price: 18.49, stock: 25 }]
  },
  {
    id: "password-manager",
    name: "Password Manager Family",
    description: "Encrypted vault access for teams, families, and solo operators.",
    price: 14.99,
    currency: "USD",
    stock: 87,
    badge_text: "Secure",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Security",
    platform: "All devices",
    images: [
      "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "family", name: "Family", price: 14.99, stock: 87 }]
  },
  {
    id: "cloud-storage",
    name: "Cloud Storage Pro",
    description: "Expanded storage access for backups, media, and shared projects.",
    price: 11.99,
    currency: "USD",
    stock: 58,
    badge_text: "Cloud",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Productivity",
    platform: "Web, desktop, mobile",
    images: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "1tb", name: "1 TB", price: 11.99, stock: 58 }]
  },
  {
    id: "ai-assistant",
    name: "AI Assistant Pro",
    description: "Premium assistant access for writing, coding, research, and planning.",
    price: 22.99,
    currency: "USD",
    stock: 16,
    badge_text: "AI",
    status_text: "Limited",
    status_color: "#f4b740",
    category: "Creative",
    platform: "Web",
    images: [
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "pro", name: "Pro", price: 22.99, stock: 16 }]
  },
  {
    id: "music-producer",
    name: "Producer Studio Suite",
    description: "Audio tools for beatmaking, mixing, recording, and plugin workflows.",
    price: 39.99,
    currency: "USD",
    stock: 12,
    badge_text: "Studio",
    status_text: "Live",
    status_color: "#21d66b",
    category: "Creative",
    platform: "Windows & macOS",
    images: [
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=85"
    ],
    variants: [{ id: "suite", name: "Suite", price: 39.99, stock: 12 }]
  }
];

const defaultFeatures: ProductFeature[] = [
  {
    group: "Includes",
    items: [
      "Instant digital delivery",
      "Email receipt and order lookup",
      "Activation notes included",
      "SellAuth-powered fulfilment"
    ]
  },
  {
    group: "Support",
    items: [
      "Staff support after purchase",
      "Fresh stock monitoring",
      "Replacement review workflow",
      "Private order handling"
    ]
  }
];

function currency(value?: number | string, code = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2
  }).format(amount);
}

function getAvailableVariants(product: StoreProduct) {
  const variants =
    product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: "default", name: "Standard", price: product.price, stock: product.stock }];

  return variants.filter((variant) => Number(variant.stock ?? 1) > 0);
}

function getStartingPrice(product: StoreProduct) {
  const variants = getAvailableVariants(product);
  const priceOptions = (variants.length > 0 ? variants : product.variants || [])
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));

  if (priceOptions.length === 0) {
    return product.price;
  }

  return Math.min(...priceOptions);
}

function getProductStatus(product: StoreProduct) {
  const inStock = getAvailableVariants(product).length > 0 || Number(product.stock ?? 0) > 0;

  return {
    text: product.status_text || (inStock ? "Live" : "Out of stock"),
    color: product.status_color || (inStock ? "#21d66b" : "#ff6b86")
  };
}

function loadSellAuthEmbed() {
  function prepareEmbed() {
    window.sellAuthEmbed?.injectCaptcha?.();
    window.sellAuthEmbed?.injectStyles?.();
  }

  if (window.sellAuthEmbed) {
    prepareEmbed();
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://sellauth.com/assets/js/sellauth-embed-2.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        prepareEmbed();
        resolve();
      }, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("SellAuth embed failed")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sellauth.com/assets/js/sellauth-embed-2.js";
    script.async = true;
    script.addEventListener("load", () => {
      prepareEmbed();
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("SellAuth embed failed")), {
      once: true
    });
    document.body.appendChild(script);
  });
}

async function openSellAuthCheckout(
  element: HTMLElement,
  product: StoreProduct,
  variantId: string | number
) {
  await loadSellAuthEmbed();

  if (!window.sellAuthEmbed || !Number.isFinite(sellAuthShopId)) {
    throw new Error("SellAuth embed is unavailable");
  }

  await window.sellAuthEmbed.checkout(element, {
    cart: [
      {
        productId: product.id,
        variantId,
        quantity: 1
      }
    ],
    shopId: sellAuthShopId,
    modal: true,
    scrollTop: true
  });
}

function stripHtml(value?: string) {
  return value ? value.replace(/<[^>]+>/g, "").trim() : "";
}

function truncateText(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function decodeHtml(value: string) {
  if (typeof document === "undefined") {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function htmlToLines(value?: string) {
  if (!value) {
    return [];
  }

  const text = decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );

  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDescriptionTabs(
  product: StoreProduct,
  selected?: ProductVariant
) {
  const description = htmlToLines(product.description || product.meta_description);
  const instructions = htmlToLines(
    product.instructions || selected?.instructions || selected?.description
  );
  const apiTabs = [...(product.product_tabs || [])]
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))
    .map((tab) => ({
      group: tab.title || "Details",
      items: htmlToLines(tab.content)
    }))
    .filter((tab) => tab.items.length > 0);

  if (description.length > 0 || instructions.length > 0 || apiTabs.length > 0) {
    return [
      {
        group: "Includes",
        items: description.length > 0 ? description : defaultFeatures[0].items
      },
      ...apiTabs,
      {
        group: "Support",
        items: instructions.length > 0 ? instructions : defaultFeatures[1].items
      }
    ];
  }

  return product.features || defaultFeatures;
}

function normalizeProducts(items: Product[]) {
  return items.map((item, index) => ({
    ...fallbackProducts[index % fallbackProducts.length],
    ...item
  })) as StoreProduct[];
}

function getProductImages(product: StoreProduct) {
  const images = product.images || [];
  const normalized = images
    .map((image) => {
      if (typeof image === "string") {
        return image;
      }

      return image.url || image.src || image.path || "";
    })
    .filter(Boolean);

  const gallery = product.gallery || [];
  const merged = [...normalized, ...gallery, product.image].filter(Boolean) as string[];

  return Array.from(new Set(merged));
}

function getPathProductId() {
  const [, route, id] = window.location.pathname.split("/");

  if (!["product", "checkout"].includes(route)) {
    return "";
  }

  return decodeURIComponent(id || "");
}

function Header({ cartCount }: { cartCount: number }) {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <img className="brand-mark" src="/images/brand-icon.png" alt="" />
        <span>ilovecheats.com</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/">Home</a>
        <a href="/store">Store</a>
        <a href="/status">Status</a>
        <a href="/#discord">Discord</a>
      </nav>
      <a className="store-pill" href="/store">
        <span className="cart-count">{cartCount}</span>
        Store
      </a>
    </header>
  );
}

function ProductCard({
  product,
  index
}: {
  product: StoreProduct;
  index: number;
}) {
  const status = getProductStatus(product);
  const startingPrice = getStartingPrice(product);
  const description =
    truncateText(stripHtml(product.description)) || "Instant delivery after checkout.";

  return (
    <article className="product-card">
      <a href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
        <img src={getProductImage(product, index)} alt="" />
      </a>
      <div className="product-body">
        <div className="product-meta">
          <span>{product.badge_text || product.category || "Digital key"}</span>
          <span style={{ color: status.color }}>{status.text}</span>
        </div>
        <h3>
          <a href={`/product/${product.id}`}>{product.name}</a>
        </h3>
        <p>{description}</p>
        <div className="product-footer">
          <strong>
            <span>Starting from</span>
            {currency(startingPrice, product.currency)}
          </strong>
          <a href={`/product/${product.id}`}>View</a>
        </div>
      </div>
    </article>
  );
}

function HeroModelViewer({
  modelPath,
  modelName
}: {
  modelPath: string;
  modelName: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const spinRef = useRef(-0.22);
  const scrollBoostRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const viewerMount = mount;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    const loader = new GLTFLoader();
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x1a080d, 2.2);
    const keyLight = new THREE.DirectionalLight(0xffdce6, 4);
    const rimLight = new THREE.DirectionalLight(0xff5277, 3);
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    sceneRef.current = scene;
    loaderRef.current = loader;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewerMount.appendChild(renderer.domElement);

    camera.position.set(0, 0.02, 5.25);
    scene.add(ambientLight);
    keyLight.position.set(3, 4, 5);
    rimLight.position.set(-3, 1.2, -2);
    scene.add(keyLight, rimLight);

    function resize() {
      const width = Math.max(1, viewerMount.clientWidth);
      const height = Math.max(1, viewerMount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function handleScroll() {
      scrollBoostRef.current = Math.min(scrollBoostRef.current + 0.008, 0.026);
    }

    function animate() {
      const model = modelRef.current;

      if (model) {
        const speed = 0.0025 + scrollBoostRef.current;
        spinRef.current += speed;
        scrollBoostRef.current *= 0.9;
        model.rotation.y = spinRef.current;
      }

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    }

    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewerMount);
    window.addEventListener("wheel", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("wheel", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      loaderRef.current = null;
      modelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const loader = loaderRef.current;

    if (!scene || !loader) {
      return;
    }

    let cancelled = false;

    function disposeObject(object: THREE.Object3D) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }

    function fitModel(object: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.45 / maxAxis;

      object.position.sub(center);
      object.scale.setScalar(scale);
      object.rotation.set(0.0, -0.88, -Math.PI / 9);
    }

    loader.load(
      modelPath,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        if (modelRef.current) {
          scene.remove(modelRef.current);
          disposeObject(modelRef.current);
        }

        const model = gltf.scene;
        const pivot = new THREE.Group();

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });

        fitModel(model);
        pivot.position.y = -0.8;
        pivot.rotation.y = spinRef.current;
        pivot.add(model);
        modelRef.current = pivot;
        scene.add(pivot);
      },
      undefined,
      () => {
        // The empty scene still keeps the hero layout stable if a model fails.
      }
    );

    return () => {
      cancelled = true;
    };
  }, [modelPath]);

  return (
    <div className="hero-model-stage" aria-label={`${modelName} preview`}>
      <div className="hero-model-glow" />
      <div className="hero-model-mount" ref={mountRef} />
    </div>
  );
}

function HomePage({
  products,
  isLive,
  error
}: {
  products: StoreProduct[];
  isLive: boolean;
  error: string;
}) {
  const featuredProduct = products[0] || fallbackProducts[0];
  const [selectedModelId, setSelectedModelId] = useState("ak47-sheen");
  const selectedModel =
    heroModels.find((model) => model.id === selectedModelId) || heroModels[0];

  return (
    <>
      <section className="hero">
        <SilkShader className="hero-bloodline" />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="eyebrow">Instant delivery. 24/7 support</p>
          <h1>A cheaters wet-dream</h1>
          <p className="hero-copy">
            undetected products made simple.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="/store">
              Shop live stock
            </a>
            <a className="secondary-button" href="#discord">
              Join Discord
            </a>
            <button
              className="model-toggle"
              type="button"
              onClick={() =>
                setSelectedModelId((current) =>
                  current === "ak47-sheen" ? "ak47" : "ak47-sheen"
                )
              }
              aria-label="Toggle chams model"
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="hero-model-panel">
          <HeroModelViewer
            modelPath={selectedModel.path}
            modelName={selectedModel.name}
          />
        </div>
      </section>

      <section className="ticker" aria-label="Store highlights">
        <span>{isLive ? "Live SellAuth stock" : "Demo stock active"}</span>
        <span>Instant product key delivery</span>
        <span>Card and crypto ready</span>
        <span>Railway deployable</span>
      </section>

      <section className="featured" aria-labelledby="featured-title">
        <div>
          <p className="eyebrow">Drop of the day</p>
          <h2 id="featured-title">Always under the radar.</h2>
          <p>{stripHtml(featuredProduct.description)}</p>
        </div>
        <RadarPanel />
      </section>

      <section className="stock-section" id="stock" aria-labelledby="stock-title">
        <div className="section-heading">
          <p className="eyebrow">Current Stock</p>
          <h2 id="stock-title">Keys people are grabbing right now</h2>
          <p>
            {error ||
              "Products load from SellAuth once your API key and shop ID are set."}
          </p>
        </div>

        <div className="product-grid">
          {products.slice(0, 4).map((product, index) => (
            <ProductCard product={product} index={index} key={product.id} />
          ))}
        </div>
      </section>

      <DiscordSection />

      <section className="trust-band" id="trust" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Delivery Flow</p>
          <h2 id="trust-title">Paid, fulfilled, and ready to activate.</h2>
        </div>
        <div className="trust-grid">
          <div>
            <span>01</span>
            <h3>Pick a key</h3>
            <p>Stock, price, and variants can be pulled directly from SellAuth.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Checkout</h3>
            <p>Use SellAuth invoices, coupons, and payment methods from the server.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Deliver</h3>
            <p>Serials and service fulfilment stay inside the SellAuth workflow.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function DiscordSection() {
  const widgetUrl = import.meta.env.VITE_DISCORD_WIDGET_URL as string | undefined;

  return (
    <section className="discord-section" id="discord" aria-labelledby="discord-title">
      <div className="discord-panel">
        <div className="discord-copy">
          <span className="community-pill">Active Community</span>
          <h2 id="discord-title">
            Join Our <span>Discord</span>
          </h2>
          <p>
            Connect with <strong>3,000+ members</strong> in our active community.
            Get support, share configs, and stay updated.
          </p>
          <ul>
            <li>24/7 instant support from staff and community</li>
            <li>First to know about updates and new features</li>
            <li>Share configs, tips, and strategies</li>
            <li>Exclusive giveaways and promotions</li>
          </ul>
          <a className="discord-button" href="https://discord.com" target="_blank" rel="noreferrer">
            <span className="discord-icon" aria-hidden="true" />
            Join Discord
          </a>
        </div>

        <div className="discord-widget" aria-label="Discord community preview">
          {widgetUrl ? (
            <iframe src={widgetUrl} title="Discord server widget" />
          ) : (
            <>
              <div className="discord-widget-top">
                <strong>Discord</strong>
                <span>958 Members Online</span>
              </div>
              <div className="discord-server-name">ILC Community</div>
              <div className="discord-list-label">MEMBERS ONLINE</div>
              {[
                "I DEX AiM MA.COM",
                "CN 97 Studio",
                "costa",
                "Boazoz",
                "2.0",
                "abuelo",
                "ania",
                "arma",
                "Aybars",
                "Barkle",
                "Beshik",
                "bladeflurry"
              ].map((member, index) => (
                <div className="discord-member" key={member}>
                  <span style={{ backgroundColor: index % 2 ? "#ff5277" : "#48e0a4" }} />
                  {member}
                </div>
              ))}
              <div className="discord-bottom">
                <span>Hangout with people who get it</span>
                <button type="button">Join Discord</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StorePage({
  products,
  error
}: {
  products: StoreProduct[];
  error: string;
}) {
  const categories = Array.from(new Set(products.map((item) => item.category || "Keys")));
  const productsByCategory = categories.map((category) => ({
    category,
    products: products.filter((product) => (product.category || "Keys") === category)
  }));

  return (
    <section className="store-page">
      <NeuralBackground
        className="store-flow-field"
        color="#ff5277"
        trailOpacity={0.08}
        particleCount={520}
        speed={0.45}
      />
      <div className="store-heading">
        <p className="eyebrow">Full Store</p>
        <h1>Choose your next key.</h1>
        <p>{error || "Browse software, gaming, security, privacy, and creator tools."}</p>
      </div>

      <div className="store-layout">
        <aside className="store-filter">
          <span>Categories</span>
          {categories.map((category) => (
            <a href={`#${category.toLowerCase().replaceAll(" ", "-")}`} key={category}>
              {category}
            </a>
          ))}
        </aside>

        <div className="store-category-stack">
          {productsByCategory.map((group) => (
            <section
              className="store-category"
              id={group.category.toLowerCase().replaceAll(" ", "-")}
              key={group.category}
            >
              <div className="category-heading">
                <h2>{group.category}</h2>
                <span>{group.products.length} products</span>
              </div>
              <div className="store-products">
                {group.products.map((product, index) => (
                  <ProductCard product={product} index={index} key={product.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPage({
  products,
  isLive,
  checkoutId
}: {
  products: StoreProduct[];
  isLive: boolean;
  checkoutId: string | number | null;
}) {
  const productId = getPathProductId();
  const baseProduct = products.find((item) => String(item.id) === productId) || products[0];
  const [liveProduct, setLiveProduct] = useState<{
    id: string;
    product: StoreProduct;
  } | null>(null);
  const [activeImage, setActiveImage] = useState<number | null>(null);
  const product =
    liveProduct?.id === String(productId) ? liveProduct.product : baseProduct;
  const productImages = getProductImages(product);
  const gallery = productImages.length > 0 ? productImages : [
    getProductImage(product, 0),
    getProductImage(product, 1),
    getProductImage(product, 2)
  ];
  const variants =
    product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: "default", name: "Standard", price: product.price, stock: product.stock }];
  const firstAvailable = variants.find((variant) => Number(variant.stock ?? 1) > 0) || variants[0];
  const [selectedVariant, setSelectedVariant] = useState(firstAvailable.id || "default");
  const [activeFeatureTab, setActiveFeatureTab] = useState("Includes");
  const selected =
    variants.find((variant) => String(variant.id) === String(selectedVariant)) || firstAvailable;
  const descriptionTabs = getDescriptionTabs(product, selected);
  const activeDescriptionTab =
    descriptionTabs.find((tab) => tab.group === activeFeatureTab) || descriptionTabs[0];
  const productStatus = getProductStatus(product);
  const total = selected.price || product.price;

  useEffect(() => {
    if (!isLive || !productId) {
      return;
    }

    let cancelled = false;

    fetchProduct(productId)
      .then((nextProduct) => {
        if (!cancelled) {
          setLiveProduct({
            id: String(productId),
            product: {
              ...baseProduct,
              ...nextProduct
            }
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveProduct(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseProduct, isLive, productId]);

  function showPreviousImage() {
    setActiveImage((current) =>
      current === null ? gallery.length - 1 : (current - 1 + gallery.length) % gallery.length
    );
  }

  function showNextImage() {
    setActiveImage((current) =>
      current === null ? 0 : (current + 1) % gallery.length
    );
  }

  return (
    <section className="product-page">
      <NeuralBackground
        className="product-flow-field"
        color="#ff5277"
        trailOpacity={0.1}
        particleCount={360}
        speed={0.35}
      />
      <div className="product-layout">
        <div className="product-media">
          <button
            className="main-shot-button"
            type="button"
            onClick={() => setActiveImage(0)}
          >
            <img className="main-shot" src={gallery[0]} alt="" />
          </button>
          <div className="thumbnail-row">
            {gallery.slice(0, 3).map((image, index) => (
              <button
                type="button"
                onClick={() => setActiveImage(index)}
                key={image}
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>

          <div className="feature-box">
            <div className="feature-tabs">
              {descriptionTabs.map((feature) => (
                <button
                  className={
                    activeDescriptionTab?.group === feature.group ? "active" : ""
                  }
                  type="button"
                  onClick={() => setActiveFeatureTab(feature.group)}
                  key={feature.group}
                >
                  {feature.group}
                </button>
              ))}
            </div>
            <ul>
              {(activeDescriptionTab?.items || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="purchase-panel">
          <div className="purchase-topline">
            <div className="detect-badge" style={{ color: productStatus.color }}>
              <span />
              {productStatus.text}
            </div>
            <div className="windows-mark" aria-label="Windows 11 compatible">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <h1>{product.name}</h1>
          <p>{stripHtml(product.description)}</p>

          <h2>Select duration</h2>
          <div className="duration-list">
            {variants.map((variant) => {
              const stock = Number(variant.stock ?? 1);
              const disabled = stock <= 0;

              return (
                <label
                  className={`duration-option ${
                    String(selectedVariant) === String(variant.id) ? "selected" : ""
                  } ${disabled ? "disabled" : ""}`}
                  key={variant.id || variant.name}
                >
                  <input
                    type="radio"
                    name="duration"
                    value={String(variant.id)}
                    checked={String(selectedVariant) === String(variant.id)}
                    disabled={disabled}
                    onChange={() => setSelectedVariant(variant.id || "default")}
                  />
                  <span>
                    <strong>{variant.name || "Standard"}</strong>
                    <small>{disabled ? "Out of stock" : `${stock} in stock`}</small>
                  </span>
                  <b>{currency(variant.price, product.currency)}</b>
                </label>
              );
            })}
          </div>

          <small className="stock-note">{selected.stock ?? product.stock ?? 1} in stock</small>
          <div className="total-row">
            <span>Total</span>
            <strong>{currency(total, product.currency)}</strong>
          </div>

          <div className="purchase-actions">
            <button
              type="button"
              className="buy-button full-width"
              onClick={async (event) => {
                try {
                  await openSellAuthCheckout(
                    event.currentTarget,
                    product,
                    selected.id || "default"
                  );
                } catch {
                  window.location.assign(
                    `/checkout/${product.id}?variant=${encodeURIComponent(
                      String(selected.id || "default")
                    )}`
                  );
                }
              }}
              disabled={checkoutId === product.id}
            >
              {checkoutId === product.id ? "Opening" : "Buy now"}
            </button>
          </div>

          <p className="gateway-note">
            When checking out, you will be redirected to our gateway page to
            complete your payment.
          </p>
        </div>
      </div>

      {activeImage !== null ? (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveImage(null)}
        >
          <button
            className="lightbox-close"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActiveImage(null);
            }}
            aria-label="Close image preview"
          >
            x
          </button>
          <button
            className="lightbox-arrow previous"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPreviousImage();
            }}
            aria-label="Previous image"
          />
          <img
            src={gallery[activeImage]}
            alt=""
            onClick={(event) => event.stopPropagation()}
          />
          <button
            className="lightbox-arrow next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNextImage();
            }}
            aria-label="Next image"
          />
        </div>
      ) : null}
    </section>
  );
}

function StatusPage({ products }: { products: StoreProduct[] }) {
  return (
    <section className="status-page">
      <NeuralBackground
        className="store-flow-field"
        color="#ff5277"
        trailOpacity={0.08}
        particleCount={520}
        speed={0.45}
      />
      <div className="store-heading">
        <p className="eyebrow">Live Status</p>
        <h1>Product availability at a glance.</h1>
        <p>Status colours are pulled from SellAuth product data when live credentials are configured.</p>
      </div>

      <div className="status-list">
        {products.map((product) => {
          const status = getProductStatus(product);

          return (
            <a className="status-row" href={`/product/${product.id}`} key={product.id}>
              <span
                className="status-dot"
                style={{ backgroundColor: status.color }}
              />
              <div>
                <strong>{product.name}</strong>
                <small>{product.category || "Digital key"}</small>
              </div>
              <b style={{ color: status.color }}>
                {status.text}
              </b>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function CheckoutPage({
  products,
  isLive,
  checkoutId,
  onCheckout
}: {
  products: StoreProduct[];
  isLive: boolean;
  checkoutId: string | number | null;
  onCheckout: (
    product: StoreProduct,
    variantId: string | number,
    email: string,
    coupon?: string,
    gateway?: string
  ) => void;
}) {
  const productId = getPathProductId();
  const product = products.find((item) => String(item.id) === productId) || products[0];
  const query = new URLSearchParams(window.location.search);
  const variants =
    product.variants && product.variants.length > 0
      ? product.variants
      : [{ id: "default", name: "Standard", price: product.price, stock: product.stock }];
  const selected =
    variants.find((variant) => String(variant.id) === query.get("variant")) || variants[0];
  const [email, setEmail] = useState("zakweidner@icloud.com");
  const [coupon, setCoupon] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [status, setStatus] = useState({
    text: product.status_text || "Live",
    color: product.status_color || "#21d66b"
  });
  const price = selected.price || product.price;

  useEffect(() => {
    if (!isLive) {
      return;
    }

    fetchProductStatus(product.id)
      .then((nextStatus) =>
        setStatus({
          text: nextStatus.statusText,
          color: nextStatus.statusColor
        })
      )
      .catch(() =>
        setStatus({
          text: product.status_text || "Status unavailable",
          color: product.status_color || "#f4b740"
        })
      );
  }, [isLive, product]);

  return (
    <section className="checkout-page">
      <NeuralBackground
        className="store-flow-field"
        color="#ff5277"
        trailOpacity={0.08}
        particleCount={520}
        speed={0.45}
      />
      <div className="checkout-main">
        <div className="checkout-heading">
          <h1>Review Order</h1>
          <p>
            <a href="/">Home</a>
            <span>›</span>
            <a href="/store">Store</a>
            <span>›</span>
            <strong>Review Order</strong>
          </p>
        </div>

        <h2>Payment Method</h2>
        <div className="payment-grid">
          <label className={`payment-card ${paymentMethod === "card" ? "active" : ""}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "card"}
              onChange={() => setPaymentMethod("card")}
            />
            <span className="payment-icon" />
            <span>
              <strong>Credit card <b>Recommended</b></strong>
              <small>Processed securely by Stripe</small>
            </span>
          </label>

          <label className={`payment-card ${paymentMethod === "crypto" ? "active" : ""}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "crypto"}
              onChange={() => setPaymentMethod("crypto")}
            />
            <span className="payment-coin">$</span>
            <span>
              <strong>Cryptocurrency</strong>
              <small>Bitcoin and Litecoin are accepted</small>
            </span>
          </label>
        </div>

        <label className="email-field">
          <span>Email address*</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>

      <aside className="order-card">
        <h2>Your Order</h2>
        <div className="order-product">
          <div>
            <strong>{product.name}</strong>
            <span>{selected.name || "Standard"}</span>
            <b>{currency(price, product.currency)}</b>
          </div>
          <button type="button" aria-label="Remove item">
            x
          </button>
        </div>

        <div className="checkout-status">
          <span className="status-dot" style={{ backgroundColor: status.color }} />
          <span style={{ color: status.color }}>{status.text}</span>
        </div>

        <label className="coupon-row">
          <span>Coupon code</span>
          <div>
            <input
              placeholder="Enter coupon code"
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
            />
            <button type="button">Apply</button>
          </div>
        </label>

        <div className="summary-row">
          <span>Subtotal</span>
          <strong>{currency(price, product.currency)}</strong>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <strong>{currency(price, product.currency)}</strong>
        </div>

        <button
          type="button"
          className="process-button"
          disabled={!email || checkoutId === product.id}
          onClick={async (event) => {
            try {
              await openSellAuthCheckout(
                event.currentTarget,
                product,
                selected.id || "default"
              );
            } catch {
              onCheckout(
                product,
                selected.id || "default",
                email,
                coupon,
                paymentMethod === "crypto" ? "BTC" : "STRIPE"
              );
            }
          }}
        >
          {checkoutId === product.id ? "Opening..." : "Proceed to payment"}
        </button>
      </aside>
    </section>
  );
}

function Footer() {
  return (
    <footer id="support">
      <div>
        <strong>ilovecheats.com</strong>
        <p>{import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com"}</p>
      </div>
      <p>Built for Railway with a private SellAuth API proxy.</p>
    </footer>
  );
}

export default function App() {
  const [products, setProducts] = useState<StoreProduct[]>(fallbackProducts);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState("");
  const [checkoutId, setCheckoutId] = useState<string | number | null>(null);
  const route = window.location.pathname.split("/")[1] || "home";

  useEffect(() => {
    fetchProducts()
      .then((items) => {
        if (items.length > 0) {
          setProducts(normalizeProducts(items));
          setIsLive(true);
        }
      })
      .catch(() => {
        setError("Live stock connects after SellAuth credentials are added.");
      });
  }, []);

  useEffect(() => {
    void loadSellAuthEmbed();
  }, []);

  async function handleCheckout(
    product: StoreProduct,
    variantId: string | number,
    checkoutEmail?: string,
    coupon?: string,
    gateway?: string
  ) {
    if (!isLive) {
      setError("Add SellAuth credentials and live variants before checkout.");
      return;
    }

    const email = checkoutEmail || window.prompt("Email for your order receipt");

    if (!email) {
      return;
    }

    setCheckoutId(product.id);
    setError("");

    try {
      const checkout = await createCheckout({
        productId: product.id,
        variantId,
        email,
        coupon: coupon || undefined,
        gateway
      });
      const checkoutUrl = checkout.url || checkout.invoice_url || checkout.hosted_url;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
      } else {
        setError("Checkout created, but SellAuth did not return a payment URL.");
      }
    } catch {
      setError("Checkout could not be created. Check your SellAuth plan and API key.");
    } finally {
      setCheckoutId(null);
    }
  }

  return (
    <main>
      <Header cartCount={1} />
      {route === "store" ? (
        <StorePage products={products} error={error} />
      ) : route === "status" ? (
        <StatusPage products={products} />
      ) : route === "checkout" ? (
        <CheckoutPage
          products={products}
          isLive={isLive}
          checkoutId={checkoutId}
          onCheckout={(product, variantId, email, coupon, gateway) =>
            void handleCheckout(product, variantId, email, coupon, gateway)
          }
        />
      ) : route === "product" ? (
        <ProductPage
          products={products}
          isLive={isLive}
          checkoutId={checkoutId}
        />
      ) : (
        <HomePage products={products} isLive={isLive} error={error} />
      )}
      <Footer />
    </main>
  );
}
