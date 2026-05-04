import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const visualSettingsScript = `
(() => {
  document.documentElement.dataset.background = "grid";
  document.documentElement.dataset.motion = "normal";
  document.documentElement.dataset.optimizedMotion = "on";
})();
`;

export const metadata: Metadata = {
  title: "Quiz ôn tập",
  description: "Nền tảng quiz cộng đồng cho trường học",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Quiz ôn tập",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.jpg",
    shortcut: "/icons/icon.jpg",
    apple: "/icons/icon.jpg"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: visualSettingsScript }} />
        {children}
        <PwaRegister />
        <div className="fixed bottom-2 left-3 z-50 rounded-full border border-foreground/20 bg-card/70 px-2 py-1 text-[10px] font-black text-foreground/55 shadow-sm backdrop-blur">
          By 2001250X34
        </div>
      </body>
    </html>
  );
}
