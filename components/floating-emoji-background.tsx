"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const FLOATING_EMOJI_COUNT_EVENT = "quiz-on-tap-floating-emoji-count-change";
const MAX_FLOATERS = 9;
const BASE_FRAME_MS = 16.67;
const COLLISION_RESTITUTION = 0.92;
const WALL_RESTITUTION = 0.98;

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
  vx: number;
  vy: number;
  size: number;
  mass: number;
  rotate: number;
  angularVelocity: number;
};

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function clampCount(value: unknown) {
  return Math.min(MAX_FLOATERS, Math.max(0, Number(value) || 0));
}

function readStoredCount() {
  return 3;
}

function randomVelocity(speed: number) {
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed
  };
}

function reflectVelocity(vx: number, vy: number, nx: number, ny: number, restitution = 1) {
  const dot = vx * nx + vy * ny;
  return {
    vx: (vx - 2 * dot * nx) * restitution,
    vy: (vy - 2 * dot * ny) * restitution
  };
}

function createFloater(id: number, width: number, height: number): Floater {
  const size = 42 + Math.random() * 30;
  const speed = 0.65 + Math.random() * 0.85;
  const velocity = randomVelocity(speed);
  return {
    id,
    emoji: randomEmoji(),
    x: Math.random() * Math.max(1, width - size),
    y: Math.random() * Math.max(1, height - size),
    vx: velocity.vx,
    vy: velocity.vy,
    size,
    mass: size * size,
    rotate: -12 + Math.random() * 24,
    angularVelocity: (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.34)
  };
}

function resolveFloaterCollisions(items: Floater[]) {
  const next = items.map((item) => ({ ...item }));

  for (let firstIndex = 0; firstIndex < next.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < next.length; secondIndex += 1) {
      const first = next[firstIndex];
      const second = next[secondIndex];
      const firstRadius = first.size / 2;
      const secondRadius = second.size / 2;
      const firstCenterX = first.x + firstRadius;
      const firstCenterY = first.y + firstRadius;
      const secondCenterX = second.x + secondRadius;
      const secondCenterY = second.y + secondRadius;
      const deltaX = secondCenterX - firstCenterX;
      const deltaY = secondCenterY - firstCenterY;
      const distance = Math.hypot(deltaX, deltaY) || 0.001;
      const minDistance = firstRadius + secondRadius;

      if (distance >= minDistance) {
        continue;
      }

      const normalX = deltaX / distance;
      const normalY = deltaY / distance;
      const overlap = minDistance - distance;
      const totalMass = first.mass + second.mass;
      const firstMove = (overlap * second.mass) / totalMass;
      const secondMove = (overlap * first.mass) / totalMass;

      first.x -= normalX * firstMove;
      first.y -= normalY * firstMove;
      second.x += normalX * secondMove;
      second.y += normalY * secondMove;

      const relativeVelocityX = second.vx - first.vx;
      const relativeVelocityY = second.vy - first.vy;
      const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

      if (velocityAlongNormal > 0) {
        continue;
      }

      const impulse = (-(1 + COLLISION_RESTITUTION) * velocityAlongNormal) / (1 / first.mass + 1 / second.mass);
      const impulseX = impulse * normalX;
      const impulseY = impulse * normalY;

      first.vx -= impulseX / first.mass;
      first.vy -= impulseY / first.mass;
      second.vx += impulseX / second.mass;
      second.vy += impulseY / second.mass;

      const tangentKick = (relativeVelocityX * -normalY + relativeVelocityY * normalX) * 0.02;
      first.angularVelocity = Math.max(-0.9, Math.min(0.9, first.angularVelocity - tangentKick));
      second.angularVelocity = Math.max(-0.9, Math.min(0.9, second.angularVelocity + tangentKick));
      first.emoji = randomEmoji();
      second.emoji = randomEmoji();
    }
  }

  return next;
}

export function FloatingEmojiBackground() {
  const [count, setCount] = useState(3);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);

  useEffect(() => {
    setCount(readStoredCount());

    const onCountChange = (event: Event) => {
      const nextCount = event instanceof CustomEvent ? event.detail : undefined;
      setCount(clampCount(nextCount ?? readStoredCount()));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "quiz-on-tap-floating-emoji-count") {
        setCount(readStoredCount());
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
    const tick = (timestamp: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const previousTimestamp = lastFrameAtRef.current ?? timestamp;
      const step = Math.min(2.2, Math.max(0.35, (timestamp - previousTimestamp) / BASE_FRAME_MS || 1));
      lastFrameAtRef.current = timestamp;

      const moved = floatersRef.current.map((item) => {
        let x = item.x + item.vx * step;
        let y = item.y + item.vy * step;
        let vx = item.vx;
        let vy = item.vy;
        let emoji = item.emoji;
        let angularVelocity = item.angularVelocity;

        if (x <= 0 || x + item.size >= width) {
          const normalX = x <= 0 ? 1 : -1;
          const reflected = reflectVelocity(vx, vy, normalX, 0, WALL_RESTITUTION);
          vx = reflected.vx;
          vy = reflected.vy;
          x = Math.min(Math.max(0, x), Math.max(0, width - item.size));
          angularVelocity += normalX * vy * 0.08;
          emoji = randomEmoji();
        }

        if (y <= 0 || y + item.size >= height) {
          const normalY = y <= 0 ? 1 : -1;
          const reflected = reflectVelocity(vx, vy, 0, normalY, WALL_RESTITUTION);
          vx = reflected.vx;
          vy = reflected.vy;
          y = Math.min(Math.max(0, y), Math.max(0, height - item.size));
          angularVelocity -= normalY * vx * 0.08;
          emoji = randomEmoji();
        }

        return {
          ...item,
          x,
          y,
          vx,
          vy,
          emoji,
          rotate: item.rotate + angularVelocity * step,
          angularVelocity: Math.max(-1.1, Math.min(1.1, angularVelocity))
        };
      });

      floatersRef.current = resolveFloaterCollisions(moved).map((item) => ({
        ...item,
        x: Math.min(Math.max(0, item.x), Math.max(0, width - item.size)),
        y: Math.min(Math.max(0, item.y), Math.max(0, height - item.size))
      }));

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
    window.localStorage.removeItem("quiz-on-tap-floating-emoji-count");
    window.localStorage.removeItem("campus-quiz-floating-emoji-count");
    window.dispatchEvent(new CustomEvent(FLOATING_EMOJI_COUNT_EVENT, { detail: normalizedCount }));
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
