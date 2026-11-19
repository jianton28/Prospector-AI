import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.avprospeccion.app",
  appName: "Prospector AI",
  webDir: "public",
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL || "http://192.168.100.39:3000",
    cleartext: true,
  },
};

export default config;
