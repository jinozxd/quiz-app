"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const username = "@jinoz_0";
const telegramUrl = "https://t.me/jinoz_0";

export function ContactCard() {
  const [copied, setCopied] = useState(false);

  async function copyUsername() {
    await navigator.clipboard.writeText(username);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="motion-safe-card mx-auto w-full max-w-3xl rounded-[30px] border-4 border-foreground bg-card p-6 text-center shadow-[14px_14px_0_0_hsl(var(--foreground))] sm:p-9">
      <div className="mx-auto grid size-20 place-items-center rounded-3xl border-4 border-foreground bg-accent shadow-[7px_7px_0_0_hsl(var(--foreground))]">
        <Send className="size-11 fill-primary stroke-[3] text-primary" aria-hidden />
      </div>

      <h1 className="mt-6 text-4xl font-black sm:text-6xl">Telegram</h1>
      <p className="mt-2 text-3xl font-black text-primary sm:text-5xl">Jinoz</p>

      <div className="mx-auto mt-7 w-full max-w-md rounded-[28px] border-4 border-foreground bg-white p-4 shadow-[9px_9px_0_0_hsl(var(--foreground))]">
        <img
          className="aspect-square w-full rounded-[18px]"
          src="/contact/telegram-qr.png"
          alt="QR Telegram Jinoz"
        />
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          className="inline-flex items-center rounded-2xl border-4 border-foreground bg-card px-5 py-3 text-lg font-black shadow-[6px_6px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[9px_9px_0_0_hsl(var(--foreground))]"
          href="/"
        >
          <ArrowLeft className="mr-2 size-5" aria-hidden />
          Trang chính
        </Link>
        <a
          className="inline-flex rounded-2xl border-4 border-foreground bg-secondary px-6 py-3 text-2xl font-black shadow-[6px_6px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[9px_9px_0_0_hsl(var(--foreground))]"
          href={telegramUrl}
        >
          {username}
        </a>
        <Button
          className="h-auto rounded-2xl border-4 px-5 py-3 text-lg font-black shadow-[6px_6px_0_0_hsl(var(--foreground))]"
          type="button"
          onClick={copyUsername}
        >
          {copied ? <Check className="mr-2 size-5" aria-hidden /> : <Copy className="mr-2 size-5" aria-hidden />}
          {copied ? "Đã copy" : "Copy username"}
        </Button>
      </div>
    </section>
  );
}
