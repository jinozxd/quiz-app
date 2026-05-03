"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Settings } from "lucide-react";
import { FloatingEmojiBackground } from "@/components/floating-emoji-background";
import { ContactCard } from "@/components/contact-card";
import { SettingsDialog, restoreSettings, saveSettings } from "@/components/quiz-app";
import type { AppSettings } from "@/components/quiz-app";

export function ContactPageShell() {
  const [settings, setSettings] = useState<AppSettings>(() => restoreSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.background = settings.background;
    document.documentElement.dataset.motion = settings.motion;
    document.documentElement.dataset.entryMotion = settings.entryAnimation ? "on" : "off";
    document.documentElement.dataset.optimizedMotion = settings.optimizeMotion ? "on" : "off";
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "quiz-on-tap-settings-v1" || event.key === "campus-quiz-settings-v1") {
        setSettings(restoreSettings());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSettingsChange = (update: AppSettings | ((current: AppSettings) => AppSettings)) => {
    setSettings((current) => {
      const next = typeof update === "function" ? update(current) : update;
      saveSettings(next);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <FloatingEmojiBackground />
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={handleSettingsChange}
      />

      <header className="px-4 pt-8">
        <div className="container relative max-w-6xl rounded-[34px] border-2 border-foreground bg-card px-5 py-5 shadow-[10px_10px_0_0_hsl(var(--foreground))] motion-safe-card">
        <div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 rounded-full border-2 border-foreground bg-accent px-6 py-3 text-2xl font-black shadow-[6px_6px_0_0_hsl(var(--foreground))] xl:block">
            HUIT
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-0 xl:pr-28">
            <Link className="flex items-center gap-3 text-left" href="/">
              <span className="grid size-12 place-items-center rounded-xl border-2 border-foreground bg-accent shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <BookOpenCheck className="size-7 stroke-[3]" aria-hidden />
              </span>
              <span>
                <span className="title-shine block text-xl font-black leading-none">Quiz ôn tập</span>
                <span className="block text-sm font-black text-muted-foreground">HUIT study hub</span>
              </span>
            </Link>

            <nav className="flex items-center gap-5 text-sm font-black">
              <Link className="hover:underline hover:decoration-4 hover:underline-offset-4" href="/">
                Trang chủ
              </Link>
              <Link className="underline decoration-4 underline-offset-8 hover:decoration-accent" href="/contact">
                Liên hệ
              </Link>
              <Link className="hover:underline hover:decoration-4 hover:underline-offset-4" href="/recap">
                Tóm tắt
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <button
        type="button"
        className="fixed right-5 top-5 z-50 grid size-12 place-items-center rounded-full border-2 border-foreground bg-secondary shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-colors hover:bg-accent"
        aria-label="Cài đặt"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="size-6 stroke-[3]" aria-hidden />
      </button>

      <div className="container relative z-10 max-w-6xl px-4 py-6">
        <ContactCard />
      </div>
    </main>
  );
}
