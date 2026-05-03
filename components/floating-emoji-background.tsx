"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const FLOATING_EMOJI_COUNT_EVENT = "quiz-on-tap-floating-emoji-count-change";
const MAX_FLOATERS = 9;
const BASE_FRAME_MS = 16.67;
const OPTIMIZED_FRAME_MS = 33.34;
const OPTIMIZED_COLLISION_INTERVAL = 4;
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

function readOptimizedMotion() {
  return document.documentElement.dataset.optimizedMotion !== "off";
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
  const elementRefs = useRef(new Map<number, HTMLDivElement>());
  const floatersRef = useRef<Floater[]>([]);
  const frameRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const draggedIdRef = useRef<number | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  function syncFloaterElement(item: Floater) {
    const element = elementRefs.current.get(item.id);
    if (!element) {
      return;
    }

    const isDragged = draggedIdRef.current === item.id;
    element.style.width = `${item.size}px`;
    element.style.height = `${item.size}px`;
    element.style.fontSize = `${item.size * 0.52}px`;
    element.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rotate}deg) scale(${isDragged ? 1.08 : 1})`;
    element.style.zIndex = isDragged ? "10" : "";
    element.textContent = item.emoji;
  }

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
    requestAnimationFrame(() => next.forEach(syncFloaterElement));
  }, [count]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      mousePosRef.current = { x: clientX, y: clientY };
    };

    const handleMouseUp = () => {
      draggedIdRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (document.hidden || floatersRef.current.length === 0) {
        lastFrameAtRef.current = timestamp;
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const optimized = readOptimizedMotion();
      const previousTimestamp = lastFrameAtRef.current ?? timestamp;

      if (optimized && lastFrameAtRef.current !== null && timestamp - previousTimestamp < OPTIMIZED_FRAME_MS) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const step = Math.min(2.2, Math.max(0.35, (timestamp - previousTimestamp) / BASE_FRAME_MS || 1));
      lastFrameAtRef.current = timestamp;
      frameCountRef.current += 1;

      const mouseDeltaX = mousePosRef.current.x - lastMousePosRef.current.x;
      const mouseDeltaY = mousePosRef.current.y - lastMousePosRef.current.y;
      lastMousePosRef.current = { ...mousePosRef.current };

      const moved = floatersRef.current.map((item) => {
        if (draggedIdRef.current === item.id) {
          // Dragging mode
          const x = mousePosRef.current.x - item.size / 2;
          const y = mousePosRef.current.y - item.size / 2;
          
          // Calculate throw velocity based on mouse delta
          const vx = mouseDeltaX * 0.8;
          const vy = mouseDeltaY * 0.8;
          const angularVelocity = mouseDeltaX * 0.05;

          return {
            ...item,
            x,
            y,
            vx,
            vy,
            angularVelocity,
            rotate: item.rotate + angularVelocity * step
          };
        }

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

      const collided = optimized && frameCountRef.current % OPTIMIZED_COLLISION_INTERVAL !== 0
        ? moved
        : resolveFloaterCollisions(moved);

      floatersRef.current = collided.map((item) => ({
        ...item,
        x: Math.min(Math.max(0, item.x), Math.max(0, width - item.size)),
        y: Math.min(Math.max(0, item.y), Math.max(0, height - item.size))
      }));

      floatersRef.current.forEach(syncFloaterElement);
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
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {floaters.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute grid cursor-grab place-items-center rounded-[18px] border-2 border-foreground bg-card shadow-[5px_5px_0_0_hsl(var(--foreground))] active:cursor-grabbing"
          )}
          ref={(element) => {
            if (element) {
              elementRefs.current.set(item.id, element);
              syncFloaterElement(item);
            } else {
              elementRefs.current.delete(item.id);
            }
          }}
          style={{
            width: item.size,
            height: item.size,
            transform: `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rotate}deg)`,
            fontSize: item.size * 0.52,
            touchAction: "none"
          }}
          onMouseDown={() => { draggedIdRef.current = item.id; }}
          onTouchStart={() => { draggedIdRef.current = item.id; }}
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
