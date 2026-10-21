import "server-only";

/** Server-only secrets. Never import this module from client components. */
export const serverEnv = {
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  viewHashSalt: process.env.VIEW_HASH_SALT ?? "",
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  shippingProvider: process.env.SHIPPING_PROVIDER ?? "manual",
  shippingProviderApiKey: process.env.SHIPPING_PROVIDER_API_KEY ?? "",
};

export function isRazorpayConfigured(): boolean {
  return Boolean(serverEnv.razorpayKeyId && serverEnv.razorpayKeySecret);
}

export function isRazorpayLiveMode(): boolean {
  return serverEnv.razorpayKeyId.startsWith("rzp_live_");
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(serverEnv.supabaseServiceKey);
}
