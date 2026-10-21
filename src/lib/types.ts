export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_visible: boolean;
  show_in_nav: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

export interface ProductListing {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  brand: string;
  published_at: string | null;
  created_at: string;
  rating_avg: number | null;
  review_count: number;
  image_url: string | null;
  image_alt: string | null;
  variant_count: number;
  min_price_paise: number | null;
  max_price_paise: number | null;
  in_stock: boolean;
  pack_labels: string[] | null;
  default_variant_id: string | null;
  default_variant_label: string | null;
  default_price_paise: number | null;
  default_compare_at_paise: number | null;
  default_available: number | null;
  default_max_per_order: number | null;
  category_slugs: string[];
}

export interface Variant {
  id: string;
  sku: string;
  label: string;
  weight_grams: number | null;
  price_paise: number;
  compare_at_paise: number | null;
  is_active: boolean;
  sort_order: number;
  max_per_order: number;
  available: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
  storage_path: string | null;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  brand: string;
  short_description: string | null;
  description: string | null;
  ingredients: string | null;
  storage_instructions: string | null;
  allergen_info: string | null;
  shelf_life: string | null;
  country_of_origin: string | null;
  manufacturer_info: string | null;
  fssai_license: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  rating_avg: number | null;
  review_count: number;
  images: ProductImage[];
  variants: Variant[];
  categories: Pick<Category, "id" | "name" | "slug">[];
}

export interface Banner {
  id: string;
  placement: "hero" | "category_tile" | "promo";
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  link_url: string;
  image_url: string;
  mobile_image_url: string | null;
  alt: string;
  theme: "walnut" | "saffron" | "olive" | "cream";
  sort_order: number;
}

export interface HomepageSection {
  key: "category_tiles" | "bestsellers" | "most_viewed" | "latest" | "promo_banners" | "featured" | "brand_showcase";
  title: string;
  is_visible: boolean;
  sort_order: number;
  item_limit: number;
}

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export type OrderStatus =
  | "pending_payment" | "confirmed" | "processing" | "packed" | "shipped" | "out_for_delivery"
  | "delivered" | "cancelled" | "payment_failed" | "on_hold" | "refunded" | "partially_refunded";

export type PaymentStatus =
  | "pending" | "authorized" | "paid" | "failed" | "refunded" | "partially_refunded" | "cod_pending" | "cod_collected";

export interface OrderSummary {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: "razorpay" | "cod";
  payment_status: PaymentStatus;
  total_paise: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string;
  sku: string;
  image_url: string | null;
  unit_price_paise: number;
  quantity: number;
  line_total_paise: number;
}

export interface Shipment {
  id: string;
  carrier: string;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  shipment_events?: { id: number; status: string; description: string | null; location: string | null; occurred_at: string }[];
}

export interface OrderDetail extends OrderSummary {
  user_id: string;
  subtotal_paise: number;
  discount_paise: number;
  shipping_paise: number;
  cod_fee_paise: number;
  refunded_paise: number;
  coupon_code: string | null;
  shipping_address: Omit<Address, "id" | "is_default">;
  contact_email: string | null;
  contact_phone: string;
  customer_note: string | null;
  reservation_expires_at: string | null;
  cancel_reason: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  order_items: OrderItem[];
  order_status_history: { id: number; from_status: OrderStatus | null; to_status: OrderStatus; note: string | null; created_at: string }[];
  shipments: Shipment[];
}
