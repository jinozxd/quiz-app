"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "campus-quiz-floating-emoji-count";
const FLOATING_EMOJI_COUNT_EVENT = "campus-quiz-floating-emoji-count-change";
const MAX_FLOATERS = 9;

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍",
  "🥰", "😘", "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "🥺", "😢", "😭",
  "😤", "😠", "🤯", "😳", "🥵", "🥶", "😱", "🤗", "🤔", "🤭", "🤫", "🙄", "😴", "🤐", "🥴", "🤧",
  "😷", "🤠", "😈", "👻", "💀", "👽", "🤖", "🎃", "😺", "😸", "😹", "😻", "🙈", "🙉", "🙊", "💌",
  "💘", "💖", "💗", "💓", "💕", "💟", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "💥",
  "💫", "💦", "💨", "💬", "💭", "💤", "👋", "🤚", "✋", "👌", "✌️", "🤞"
] as const;

type Floater = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  rotate: number;
};

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function clampCount(value: unknown) {
  return Math.min(MAX_FLOATERS, Math.max(0, Number(value) || 0));
}

function readStoredCount() {
  if (typeof window === "undefined") {
    return 3;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === null ? 3 : clampCount(saved);
}

function createFloater(id: number, width: number, height: number): Floater {
  const size = 42 + Math.random() * 30;
  const speed = 0.7 + Math.random() * 0.9;
  return {
    id,
    emoji: randomEmoji(),
    x: Math.random() * Math.max(1, width - size),
    y: Math.random() * Math.max(1, height - size),
    dx: (Math.random() > 0.5 ? 1 : -1) * speed,
    dy: (Math.random() > 0.5 ? 1 : -1) * speed,
    size,
    rotate: -12 + Math.random() * 24
  };
}

export function FloatingEmojiBackground() {
  const [count, setCount] = useState(3);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setCount(readStoredCount());

    const onCountChange = () => setCount(readStoredCount());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        onCountChange();
      }
    };

    window.addEventListener(FLOATING_EMOJI_COUNT_EVENT, onCountChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(FLOATING_EMOJI_COUNT_EVENT, onCountChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const next = Array.from({ length: count }, (_, index) => createFloater(index, width, height));
    floatersRef.current = next;
    setFloaters(next);
  }, [count]);

  useEffect(() => {
    const tick = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      floatersRef.current = floatersRef.current.map((item) => {
        let x = item.x + item.dx;
        let y = item.y + item.dy;
        let dx = item.dx;
        let dy = item.dy;
        let emoji = item.emoji;

        if (x <= 0 || x + item.size >= width) {
          dx *= -1;
          x = Math.min(Math.max(0, x), Math.max(0, width - item.size));
          emoji = randomEmoji();
        }

        if (y <= 0 || y + item.size >= height) {
          dy *= -1;
          y = Math.min(Math.max(0, y), Math.max(0, height - item.size));
          emoji = randomEmoji();
        }

        return { ...item, x, y, dx, dy, emoji };
      });

      setFloaters([...floatersRef.current]);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {floaters.map((item) => (
        <div
          key={item.id}
          className="absolute grid place-items-center rounded-[18px] border-2 border-foreground bg-card shadow-[5px_5px_0_0_hsl(var(--foreground))]"
          style={{
            width: item.size,
            height: item.size,
            transform: `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rotate}deg)`,
            fontSize: item.size * 0.52
          }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  );
}

export function EmojiBackgroundSettingsControl() {
  const [count, setCount] = useState(3);
  const marks = useMemo(() => Array.from({ length: MAX_FLOATERS + 1 }, (_, index) => index), []);

  useEffect(() => {
    setCount(readStoredCount());
  }, []);

  function updateCount(nextCount: number) {
    const normalizedCount = clampCount(nextCount);
    setCount(normalizedCount);
    window.localStorage.setItem(STORAGE_KEY, String(normalizedCount));
    window.dispatchEvent(new Event(FLOATING_EMOJI_COUNT_EVENT));
  }

  return (
    <div className="rounded-xl border-2 border-foreground bg-card/85 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-black">Emoji nền</h4>
          <p className="mt-1 text-sm font-black text-muted-foreground">Điều chỉnh số emoji bay trên nền trang.</p>
        </div>
        <span className="rounded-full border-2 border-foreground bg-secondary px-3 py-1 text-sm font-black">
          {count}/{MAX_FLOATERS}
        </span>
      </div>
      <input
        className="mt-5 w-full accent-black"
        type="range"
        min="0"
        max={MAX_FLOATERS}
        value={count}
        onChange={(event) => updateCount(Number(event.target.value))}
      />
      <div className="mt-2 flex justify-between text-[10px] font-black text-muted-foreground">
        {marks.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
    </div>
  );
}
