import type { NextConfig } from "next";
import { validatePublicSettings } from "./src/lib/public-settings";

validatePublicSettings({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
