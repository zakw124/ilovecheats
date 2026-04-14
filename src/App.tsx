import { useEffect, useRef, useState } from "react";
import NeuralBackground from "@/components/ui/flow-field-background";
import SilkShader from "@/components/ui/bloodline";
import { Footer } from "@/components/ui/footer-section";
import { RadarPanel } from "@/components/ui/radar-effect";
import { RippleEffect } from "@/components/ui/ripple-effect-creator";
import { Lightbulb, MessageCircle, X } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createCheckout,
  fetchDiscordMessages,
  fetchProduct,
  fetchProductStatus,
  fetchProducts,
  getProductImage
} from "./api";
import type { DiscordChatMessage, InitialAppData, Product, ProductVariant } from "./types";

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

function getProductGroup(product: StoreProduct) {
  if (typeof product.group === "string" && product.group.trim()) {
    return product.group.trim();
  }

  if (product.group && typeof product.group === "object") {
    const groupName = product.group.name || product.group.title;

    if (groupName?.trim()) {
      return groupName.trim();
    }
  }

  return product.group_name || product.category || "Keys";
}

function isFeaturedGroup(group: string) {
  return group.trim().toLowerCase() === "featured";
}

function compareStoreGroups(first: string, second: string) {
  if (isFeaturedGroup(first) && !isFeaturedGroup(second)) {
    return -1;
  }

  if (!isFeaturedGroup(first) && isFeaturedGroup(second)) {
    return 1;
  }

  return 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
const discordInviteUrl = "https://discord.gg/ilovecheats";

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

const loadingProduct: StoreProduct = {
  id: "loading",
  name: "Loading",
  description: "Loading product details.",
  price: 0,
  currency: "USD",
  stock: 0,
  variants: [{ id: "loading", name: "Loading", price: 0, stock: 0 }]
};

const defaultFeatures: ProductFeature[] = [
  {
    group: "Details",
    items: ["Loading product details."]
  },
  {
    group: "Support",
    items: ["Loading support details."]
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
  return items as StoreProduct[];
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
  if (typeof window === "undefined") {
    return "";
  }

  const [, route, id] = window.location.pathname.split("/");

  if (!["product", "checkout"].includes(route)) {
    return "";
  }

  return decodeURIComponent(id || "");
}

function Header() {
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
        <a href={discordInviteUrl} target="_blank" rel="noreferrer">
          Discord
        </a>
      </nav>
      <RippleEffect rippleColor="rgba(255, 255, 255, 0.34)">
        <a className="store-pill" href="/store">
          Store
        </a>
      </RippleEffect>
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
    truncateText(stripHtml(product.description), 100) || "Product details update at checkout.";

  return (
    <article className="product-card">
      <span className="product-status-badge" style={{ color: status.color }}>
        {status.text}
      </span>
      <a href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
        {getProductImage(product, index) ? (
          <img src={getProductImage(product, index)} alt="" />
        ) : (
          <div className="product-image-loading">Loading image</div>
        )}
      </a>
      <div className="product-body">
        <h3>
          <a href={`/product/${product.id}`}>{product.name}</a>
        </h3>
        <p>{description}</p>
        <div className="product-footer">
          <strong>
            <span>Starting from</span>
            {currency(startingPrice, product.currency)}
          </strong>
          <RippleEffect rippleColor="rgba(255, 255, 255, 0.34)">
            <a className="rainbow-button" href={`/product/${product.id}`}>View</a>
          </RippleEffect>
        </div>
      </div>
    </article>
  );
}

function LoadingSection({ label = "Loading live stock" }: { label?: string }) {
  return (
    <section className="loading-section" aria-live="polite">
      <div className="loading-pulse" />
      <p>{label}</p>
    </section>
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
      const wideScreen = window.matchMedia("(min-width: 2560px)").matches;
      const scale = (wideScreen ? 3.15 : 2.5) / maxAxis;

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
        pivot.position.y = window.matchMedia("(min-width: 2560px)").matches ? -0.7 : -0.8;
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
  const featuredProduct = products[0];
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
            <RippleEffect rippleColor="rgba(255, 255, 255, 0.34)">
              <a className="primary-button rainbow-button" href="/store">
                View Store
              </a>
            </RippleEffect>
            <RippleEffect rippleColor="rgba(255, 255, 255, 0.3)">
              <a
                className="secondary-button"
                href={discordInviteUrl}
                target="_blank"
                rel="noreferrer"
              >
                Join Discord
              </a>
            </RippleEffect>
            <RippleEffect rippleColor="rgba(255, 82, 119, 0.34)">
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
                <Lightbulb aria-hidden="true" />
              </button>
            </RippleEffect>
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
        <span>{isLive ? "Undetected game cheats" : "Undetected game cheats"}</span>
        <span>Instant product key delivery</span>
        <span>Card and crypto ready</span>
        <span>24/7 Human Support</span>
      </section>

      <section className="featured" aria-labelledby="featured-title">
        <div>
          <p className="eyebrow">Secure & Up to date</p>
          <h2 id="featured-title">Always under the radar.</h2>
          <p>never detected, premium cheats selected.</p>
        </div>
        <RadarPanel />
      </section>

      <section className="stock-section" id="stock" aria-labelledby="stock-title">
        <div className="section-heading">
          <p className="eyebrow">Current Stock</p>
          <h2 id="stock-title">Keys people are grabbing right now</h2>
          <p>
            {error ||
              "See what the competition are using and beat them!"}
          </p>
        </div>

        <div className="product-grid">
          {products.length > 0 ? (
            products.slice(0, 4).map((product, index) => (
              <ProductCard product={product} index={index} key={product.id} />
            ))
          ) : (
            <LoadingSection />
          )}
        </div>
      </section>

      <section className="trust-band" id="trust" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Delivery Flow</p>
          <h2 id="trust-title">Paid, fulfilled, and ready to activate.</h2>
        </div>
        <div className="trust-grid">
          <div>
            <span>01</span>
            <h3>Pick a key</h3>
            <p>Choose from our variety of game cheats from Rust, Apex legends, EFT, and even Roblox executors.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Checkout</h3>
            <p>Our automated checkout system allows you to get your key and into the game instantly!</p>
          </div>
          <div>
            <span>03</span>
            <h3>Deliver</h3>
            <p>Serials are automatically delivered to your email, you'll instantly be in game!</p>
          </div>
        </div>
      </section>

      <DiscordSection />
    </>
  );
}

function useDiscordChat(limit = 8) {
  const [messages, setMessages] = useState<DiscordChatMessage[]>([]);
  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      try {
        const payload = await fetchDiscordMessages(limit);

        if (!isMounted) {
          return;
        }

        setIsConfigured(payload.configured);
        setMessages(payload.messages);
        setChatError(payload.error || "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setChatError(error instanceof Error ? error.message : "Unable to load Discord chat");
      } finally {
        if (isMounted) {
          setIsLoadingChat(false);
        }
      }
    }

    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [limit]);

  return { chatError, isConfigured, isLoadingChat, messages };
}

function DiscordChatPanel({ className = "" }: { className?: string }) {
  const { chatError, isConfigured, isLoadingChat, messages } = useDiscordChat(8);

  return (
    <div
      className={`discord-chat ${className}`.trim()}
      aria-label="Discord chat preview"
    >
      <div className="discord-chat-top">
        <div>
          <strong># live-chat</strong>
          <span>Latest messages</span>
        </div>
        <span className="discord-live-dot" aria-hidden="true" />
      </div>

      <div className="discord-message-list">
        {isLoadingChat ? (
          <p className="discord-empty">Loading the latest chat...</p>
        ) : !isConfigured ? (
          <p className="discord-empty">
            Add a Discord bot token and channel ID to show live chat here.
          </p>
        ) : chatError ? (
          <p className="discord-empty">{chatError}</p>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <article className="discord-message" key={message.id}>
              <img src={message.avatarUrl} alt="" />
              <div>
                <div className="discord-message-meta">
                  <strong>{message.author}</strong>
                  {message.bot ? <span>BOT</span> : null}
                </div>
                <p>{message.content}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="discord-empty">No recent messages yet.</p>
        )}
      </div>

      <div className="discord-bottom">
        <span>Jump into the conversation</span>
        <a href={discordInviteUrl} target="_blank" rel="noreferrer">
          Join
        </a>
      </div>
    </div>
  );
}

function DiscordSection() {
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
          <a className="discord-button" href={discordInviteUrl} target="_blank" rel="noreferrer">
            <span className="discord-icon" aria-hidden="true" />
            Join Discord
          </a>
        </div>

        <DiscordChatPanel />
      </div>
    </section>
  );
}

function FloatingDiscordWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`floating-discord ${isOpen ? "open" : ""}`}>
      {isOpen ? (
        <div className="floating-discord-panel">
          <button
            className="floating-discord-close"
            type="button"
            aria-label="Close Discord chat"
            onClick={() => setIsOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
          <DiscordChatPanel className="floating-discord-chat" />
        </div>
      ) : null}

      <RippleEffect rippleColor="rgba(255, 255, 255, 0.34)">
        <button
          className="floating-discord-button"
          type="button"
          aria-label={isOpen ? "Close Discord chat" : "Open Discord chat"}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        </button>
      </RippleEffect>
    </div>
  );
}

function StorePage({
  products,
  error
}: {
  products: StoreProduct[];
  error: string;
}) {
  if (products.length === 0) {
    return (
      <section className="store-page">
        <SilkShader className="store-bloodline" />
        <div className="store-heading">
          <p className="eyebrow">Full Store</p>
          <h1>Loading live stock.</h1>
          <p>{error || "Fetching products from SellAuth."}</p>
        </div>
        <LoadingSection />
      </section>
    );
  }

  const categories = Array.from(new Set(products.map((item) => getProductGroup(item)))).sort(
    compareStoreGroups
  );
  const productsByCategory = categories.map((category) => ({
    category,
    products: products.filter((product) => getProductGroup(product) === category)
  }));

  return (
    <section className="store-page">
      <SilkShader className="store-bloodline" />
      <div className="store-heading">
        <h1>Select your next cheat!</h1>
        <p>{error || "Browse our selection of the best game cheats on the market."}</p>
      </div>

      <div className="store-layout">
        <aside className="store-filter">
          <span>Categories</span>
          {categories.map((category) => (
            <RippleEffect rippleColor="rgba(255, 82, 119, 0.24)" key={category}>
              <a href={`#${slugify(category)}`}>
                {category}
              </a>
            </RippleEffect>
          ))}
        </aside>

        <div className="store-category-stack">
          {productsByCategory.map((group) => (
            <section
              className="store-category"
              id={slugify(group.category)}
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
  const realProduct = products.find((item) => String(item.id) === productId) || products[0];
  const baseProduct = realProduct || loadingProduct;
  const [liveProduct, setLiveProduct] = useState<{
    id: string;
    product: StoreProduct;
  } | null>(null);
  const [activeImage, setActiveImage] = useState<number | null>(null);
  const product =
    liveProduct?.id === String(productId) ? liveProduct.product : baseProduct;
  const productImages = getProductImages(product);
  const gallery = productImages;
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

  if (!realProduct) {
    return (
      <section className="product-page">
        <SilkShader className="product-bloodline" />
        <LoadingSection label="Loading product details" />
      </section>
    );
  }

  return (
    <section className="product-page">
      <SilkShader className="product-bloodline" />
      <div className="product-breadcrumb-row">
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <a href="/store">Store</a>
          <span aria-hidden="true">/</span>
          <strong>{product.name}</strong>
        </nav>
      </div>
      <div className="product-layout">
        <div className="product-media">
          <button
            className="main-shot-button"
            type="button"
            onClick={() => setActiveImage(0)}
          >
            {gallery[0] ? (
              <img className="main-shot" src={gallery[0]} alt="" />
            ) : (
              <div className="main-shot image-loading-panel">Loading image</div>
            )}
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
            {gallery.length === 0
              ? [0, 1, 2].map((item) => (
                  <div className="thumbnail-loading image-loading-panel" key={item}>
                    Loading
                  </div>
                ))
              : null}
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
            <div className="platform-badge" aria-label="Windows compatible">
              Windows 10/11
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
                <RippleEffect
                  disabled={disabled}
                  key={variant.id || variant.name}
                  rippleColor="rgba(255, 82, 119, 0.28)"
                >
                  <label
                    className={`duration-option ${
                      String(selectedVariant) === String(variant.id) ? "selected" : ""
                    } ${disabled ? "disabled" : ""}`}
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
                </RippleEffect>
              );
            })}
          </div>

          <small className="stock-note">{selected.stock ?? product.stock ?? 1} in stock</small>
          <div className="total-row">
            <span>Total</span>
            <strong>{currency(total, product.currency)}</strong>
          </div>

          <div className="purchase-actions">
            <RippleEffect
              disabled={checkoutId === product.id}
              rippleColor="rgba(255, 255, 255, 0.36)"
            >
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
            </RippleEffect>
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
        <p>Status is updated live as soon as detections occur, You're never in the dark!</p>
      </div>

      <div className="status-list">
        {products.length === 0 ? (
          <LoadingSection />
        ) : products.map((product) => {
          const status = getProductStatus(product);

          return (
            <a className="status-row" href={`/product/${product.id}`} key={product.id}>
              <span
                className="status-dot"
                style={{ backgroundColor: status.color }}
              />
              <div>
                <strong>{product.name}</strong>
                <small>{getProductGroup(product) || "Digital key"}</small>
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
  const realProduct = products.find((item) => String(item.id) === productId) || products[0];
  const product = realProduct || loadingProduct;
  const query = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
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

  if (!realProduct) {
    return (
      <section className="checkout-page">
        <LoadingSection label="Loading checkout" />
      </section>
    );
  }

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

export default function App({
  initialData,
  initialRoute
}: {
  initialData?: InitialAppData;
  initialRoute?: string;
} = {}) {
  const initialProducts = normalizeProducts(initialData?.products || []);
  const [products, setProducts] = useState<StoreProduct[]>(initialProducts);
  const [isLive, setIsLive] = useState(initialProducts.length > 0);
  const [error, setError] = useState(initialData?.productsError || "");
  const [checkoutId, setCheckoutId] = useState<string | number | null>(null);
  const route =
    initialRoute ||
    (typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "") ||
    "home";

  useEffect(() => {
    if (initialProducts.length > 0) {
      return;
    }

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
  }, [initialProducts.length]);

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
      <Header />
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
      <FloatingDiscordWidget />
    </main>
  );
}
