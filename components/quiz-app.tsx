"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, FormEvent, ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  Lightbulb,
  LogIn,
  LogOut,
  MoreVertical,
  Pin,
  RotateCcw,
  Settings,
  Shuffle,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  User,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmojiBackgroundSettingsControl, FloatingEmojiBackground } from "@/components/floating-emoji-background";
import type { QuizChapter, QuizSubject } from "@/lib/quiz-types";
import { cn } from "@/lib/utils";
import memoryTipsRaw from "@/data/ktct-memory-tips.json";

type AuthUser = {
  id?: string;
  email: string;
  name: string;
  password?: string;
  role: "admin" | "member";
  createdAt: number;
  passwordChangedAt?: number;
};

type AuthSession = {
  id?: string;
  name: string;
  role: AuthUser["role"];
};

type AuthState = {
  users: AuthUser[];
  session?: AuthSession;
  sessionToken?: string;
  rememberedName?: string;
  rememberPassword?: boolean;
};

type QuestionStat = {
  id: string;
  prompt: string;
  subjectTitle: string;
  chapterTitle: string;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
};

type ProfileMediaItem = {
  avatar?: string;
  cover?: string;
};

type ProfileMedia = Record<string, ProfileMediaItem>;

const STORAGE_KEY = "quiz-on-tap-progress-v2";
const SETTINGS_KEY = "quiz-on-tap-settings-v1";
const AUTH_STORAGE_KEY = "quiz-on-tap-auth-v1";
const PROFILE_MEDIA_KEY = "quiz-on-tap-profile-media-v1";
const PROFILE_PROGRESS_KEY = "quiz-on-tap-profile-progress-v1";
const LEGACY_STORAGE_KEY = "campus-quiz-progress-v2";
const LEGACY_SETTINGS_KEY = "campus-quiz-settings-v1";
const LEGACY_AUTH_STORAGE_KEY = "campus-quiz-auth-v1";
const LEGACY_PROFILE_MEDIA_KEY = "campus-quiz-profile-media-v1";
const LEGACY_PROFILE_PROGRESS_KEY = "campus-quiz-profile-progress-v1";
const PASSWORD_CHANGE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
const MAX_PINNED = 1;
const PART_SIZE = 15;
const MIN_STANDALONE_REMAINDER = 7;
const EXAM_QUESTION_COUNT = 40;
const ADMIN_USER: AuthUser = {
  email: "adminvn@campus.local",
  name: "adminvn",
  role: "admin",
  createdAt: 0
};
void "JinozXD";
void ADMIN_USER;
const EMOJI_SWEEP_POOL = [
  "❓",
  "💸",
  "🥬",
  "🤡",
  "🤪",
  "👾",
  "👽",
  "☣️",
  "🍼",
  "🌿",
  "📚",
  "💅",
  "🗿",
  "👻",
  "✨",
  "⚡",
  "🔥",
  "💥",
  "🌪️",
  "🌀",
  "🎯",
  "🎲",
  "🎮",
  "🧠",
  "📌",
  "📎",
  "📖",
  "📝",
  "✅",
  "❌",
  "💯",
  "🚀",
  "🛸",
  "🌈",
  "🌟",
  "⭐",
  "💫",
  "🧃",
  "🍵",
  "🍀",
  "🌵",
  "🍄",
  "🍋",
  "🍉",
  "🍿",
  "🧂",
  "🎀",
  "🪩",
  "🎧",
  "🎤",
  "🥁",
  "📣",
  "🧨",
  "🔮",
  "🧿",
  "🪄",
  "🏆",
  "🥇",
  "📚",
  "🧪",
  "🧬",
  "🪐"
];

const WELCOME_QUOTE_PERCENT_BUCKETS = [12, 36, 50, 68, 88, 100];

type ProgressItem = {
  id: string;
  subjectId: string;
  chapterId: string;
  userName?: string;
  questionOrder?: string[];
  optionOrders?: Record<string, string[]>;
  answers: Record<string, string>;
  submitted: boolean;
  updatedAt: number;
  pinnedAt?: number;
};

type ResultItem = {
  id: string;
  subjectId: string;
  chapterId?: string;
  chapterTitle: string;
  userName?: string;
  score: number;
  total: number;
  submittedAt: number;
  pinnedAt?: number;
};

type SavedProgress = {
  activeSubjectId?: string;
  activeChapterId?: string;
  items: Record<string, ProgressItem>;
  order: string[];
  starredQuestionIds?: string[];
  results?: ResultItem[];
};

type ProfileProgress = {
  level: number;
  xp: number;
  awardedResultIds: string[];
  unlockedAchievementIds: string[];
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

type QuizState = {
  subject?: QuizSubject;
  chapter?: QuizChapter;
  answers: Record<string, string>;
  submitted: boolean;
  survival?: SurvivalState;
};

type SurvivalState = {
  livesTotal: 1 | 3;
  livesLeft: number;
  shieldEnabled: boolean;
  shieldAvailable: boolean;
  gameOver: boolean;
};

type SurvivalConfig = {
  lives: 1 | 3;
  shieldEnabled: boolean;
  count: 25 | 40 | "full";
  scope: "all" | "chapter";
  chapterId: string;
};

type MatchingCount = 25 | 40 | "full";

type MotionLevel = "low" | "normal" | "high" | "off";
type ThemeMode = "light" | "dark";
type BackgroundMode = "grid" | "blast" | "stickers" | "checker" | "poster" | "tape" | "notebook" | "neon" | "waves";
type BackgroundRandomMinutes = 2 | 3 | 5;

export type AppSettings = {
  background: BackgroundMode;
  backgroundRandom: boolean;
  backgroundRandomMinutes: BackgroundRandomMinutes;
  nextBackgroundAt: number;
  pomodoroBreakEnabled: boolean;
  pomodoroBreakMinutes: number;
  pomodoroEnabled: boolean;
  pomodoroFocusMinutes: number;
  motion: MotionLevel;
  theme: ThemeMode;
};

type EmojiSweepItem = {
  id: string;
  delay: number;
  direction: "left" | "right";
  duration: number;
  emoji: string;
  size: number;
  top: number;
};

type MemoryTip = {
  number: number;
  question: string;
  answer: string;
  keywords: string;
  memory: string;
  logic: string;
};

const memoryTips = memoryTipsRaw as Record<string, MemoryTip>;

function progressId(subjectId: string, chapterId: string) {
  return `${subjectId}:${chapterId}`;
}

function shouldPersistOrder(chapterId: string) {
  return (
    chapterId.endsWith("-shuffle") ||
    chapterId.startsWith("mode-exam-40") ||
    chapterId.startsWith("mode-all-random") ||
    chapterId.startsWith("mode-practice-starred") ||
    chapterId.startsWith("mode-survival") ||
    chapterId.startsWith("mode-match")
  );
}

function emptySaved(): SavedProgress {
  return { items: {}, order: [], starredQuestionIds: [], results: [] };
}

function readLocalStorageWithFallback(key: string, legacyKey: string) {
  const raw = window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey);
  if (raw && !window.localStorage.getItem(key)) {
    window.localStorage.setItem(key, raw);
  }
  return raw;
}

function restoreSaved(): SavedProgress {
  if (typeof window === "undefined") {
    return emptySaved();
  }

  try {
    const raw = readLocalStorageWithFallback(STORAGE_KEY, LEGACY_STORAGE_KEY);
    if (!raw) {
      return emptySaved();
    }
    const parsed = JSON.parse(raw) as SavedProgress;
    return {
      items: parsed.items ?? {},
      order: parsed.order ?? Object.keys(parsed.items ?? {}),
      activeSubjectId: parsed.activeSubjectId,
      activeChapterId: parsed.activeChapterId,
      starredQuestionIds: parsed.starredQuestionIds ?? [],
      results: parsed.results ?? []
    };
  } catch {
    return emptySaved();
  }
}

function normalizeAuthState(parsed?: Partial<AuthState>): AuthState {
  const users = (parsed?.users ?? []).map((user) => ({ ...user, password: undefined }));

  return {
    users,
    session: parsed?.session,
    sessionToken: parsed?.sessionToken,
    rememberedName: parsed?.rememberedName,
    rememberPassword: Boolean(parsed?.rememberPassword)
  };
}

function restoreAuth(): AuthState {
  if (typeof window === "undefined") {
    return normalizeAuthState();
  }

  try {
    const raw = readLocalStorageWithFallback(AUTH_STORAGE_KEY, LEGACY_AUTH_STORAGE_KEY);
    if (!raw) {
      return normalizeAuthState();
    }

    return normalizeAuthState(JSON.parse(raw) as Partial<AuthState>);
  } catch {
    return normalizeAuthState();
  }
}

function restoreProfileMedia(): ProfileMedia {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = readLocalStorageWithFallback(PROFILE_MEDIA_KEY, LEGACY_PROFILE_MEDIA_KEY);
    return raw ? (JSON.parse(raw) as ProfileMedia) : {};
  } catch {
    return {};
  }
}

function normalizeProfileProgress(parsed?: Partial<ProfileProgress>): ProfileProgress {
  const level = typeof parsed?.level === "number" ? Math.min(100, Math.max(1, Math.floor(parsed.level))) : 1;
  const xp = typeof parsed?.xp === "number" && level < 100 ? Math.min(99, Math.max(0, Math.floor(parsed.xp))) : 0;

  return {
    level,
    xp,
    awardedResultIds: Array.isArray(parsed?.awardedResultIds) ? parsed.awardedResultIds : [],
    unlockedAchievementIds: Array.isArray(parsed?.unlockedAchievementIds) ? parsed.unlockedAchievementIds : []
  };
}

function restoreProfileProgress(): ProfileProgress {
  if (typeof window === "undefined") {
    return normalizeProfileProgress();
  }

  try {
    const raw = readLocalStorageWithFallback(PROFILE_PROGRESS_KEY, LEGACY_PROFILE_PROGRESS_KEY);
    return raw ? normalizeProfileProgress(JSON.parse(raw) as Partial<ProfileProgress>) : normalizeProfileProgress();
  } catch {
    return normalizeProfileProgress();
  }
}

function defaultSettings(): AppSettings {
  return {
    background: "grid",
    backgroundRandom: false,
    backgroundRandomMinutes: 5,
    nextBackgroundAt: Date.now() + 5 * 60_000,
    pomodoroBreakEnabled: true,
    pomodoroBreakMinutes: 5,
    pomodoroEnabled: false,
    pomodoroFocusMinutes: 20,
    motion: "normal",
    theme: "light"
  };
}

function isBackgroundMode(value: unknown): value is BackgroundMode {
  return (
    value === "grid" ||
    value === "blast" ||
    value === "stickers" ||
    value === "checker" ||
    value === "poster" ||
    value === "tape" ||
    value === "notebook" ||
    value === "neon" ||
    value === "waves"
  );
}

function isRandomMinutes(value: unknown): value is BackgroundRandomMinutes {
  return value === 2 || value === 3 || value === 5;
}

export function restoreSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultSettings();
  }

  try {
    const raw = readLocalStorageWithFallback(SETTINGS_KEY, LEGACY_SETTINGS_KEY);
    if (!raw) {
      return defaultSettings();
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const randomMinutes = isRandomMinutes(parsed.backgroundRandomMinutes) ? parsed.backgroundRandomMinutes : 5;
    const focusMinutes = typeof parsed.pomodoroFocusMinutes === "number" ? Math.max(10, Math.round(parsed.pomodoroFocusMinutes / 5) * 5) : 20;
    const breakMinutes = typeof parsed.pomodoroBreakMinutes === "number" ? Math.max(5, Math.round(parsed.pomodoroBreakMinutes / 5) * 5) : 5;
    return {
      background: isBackgroundMode(parsed.background) ? parsed.background : "grid",
      backgroundRandom: Boolean(parsed.backgroundRandom),
      backgroundRandomMinutes: randomMinutes,
      nextBackgroundAt: typeof parsed.nextBackgroundAt === "number" ? parsed.nextBackgroundAt : Date.now() + randomMinutes * 60_000,
      pomodoroBreakEnabled: parsed.pomodoroBreakEnabled !== false,
      pomodoroBreakMinutes: breakMinutes,
      pomodoroEnabled: Boolean(parsed.pomodoroEnabled) && focusMinutes >= 10,
      pomodoroFocusMinutes: focusMinutes,
      motion: parsed.motion === "low" || parsed.motion === "normal" || parsed.motion === "high" || parsed.motion === "off" ? parsed.motion : "normal",
      theme: parsed.theme === "dark" ? "dark" : "light"
    };
  } catch {
    return defaultSettings();
  }
}

type AppAuthResponse = {
  user?: {
    id?: string;
    name: string;
    role: AuthUser["role"];
  };
  token?: string;
  error?: string;
};

async function requestAppAuth(body: Record<string, unknown>, token?: string) {
  const response = await fetch("/api/app-auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as AppAuthResponse;

  if (!response.ok) {
    return { error: data.error ?? "Không kết nối được hệ thống tài khoản." };
  }

  return data;
}

function authStateForSession(user: NonNullable<AppAuthResponse["user"]>, token: string, rememberPassword: boolean): AuthState {
  return {
    users: [],
    session: { id: user.id, name: user.name, role: user.role },
    sessionToken: token,
    rememberedName: rememberPassword ? user.name : undefined,
    rememberPassword
  };
}

function hasSavedContent(saved: SavedProgress | undefined) {
  return Boolean(saved && (saved.order.length > 0 || Object.keys(saved.items).length > 0 || (saved.results?.length ?? 0) > 0 || (saved.starredQuestionIds?.length ?? 0) > 0));
}

function getSubject(subjects: QuizSubject[], subjectId?: string) {
  return subjects.find((subject) => subject.id === subjectId);
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function reorderChapter(chapter: QuizChapter, questionOrder?: string[], optionOrders?: Record<string, string[]>): QuizChapter {
  const questionMap = new Map(chapter.questions.map((question) => [question.id, question]));
  const orderedQuestions = questionOrder
    ? questionOrder.map((id) => questionMap.get(id)).filter((question): question is QuizChapter["questions"][number] => Boolean(question))
    : chapter.questions;

  return {
    ...chapter,
    questions: orderedQuestions.map((question) => {
      const optionOrder = optionOrders?.[question.id];
      if (!optionOrder) {
        return question;
      }

      const optionMap = new Map(question.options.map((option) => [option.id, option]));
      return {
        ...question,
        options: optionOrder.map((id) => optionMap.get(id)).filter((option): option is typeof question.options[number] => Boolean(option))
      };
    })
  };
}

function getBaseChapterId(chapterId: string) {
  return chapterId.endsWith("-shuffle") ? chapterId.replace(/-shuffle$/, "") : chapterId;
}

function makeShuffledChapter(chapter: QuizChapter): QuizChapter {
  return {
    ...chapter,
    id: `${chapter.id}-shuffle`,
    title: `${chapter.title} - Xáo trộn`,
    questions: shuffleArray(chapter.questions).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function getAllQuestions(subject: QuizSubject) {
  return subject.chapters.flatMap((chapter) => chapter.questions);
}

function getStarredQuestions(subject: QuizSubject, starredQuestionIds: string[]) {
  const starredSet = new Set(starredQuestionIds);
  return getAllQuestions(subject).filter((question) => starredSet.has(question.id));
}

function makeAllQuestionsChapter(subject: QuizSubject): QuizChapter {
  return {
    id: `mode-all-random-${Date.now()}`,
    title: "Trộn tất cả câu hỏi",
    questions: shuffleArray(getAllQuestions(subject)).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function makePracticeChapter(subject: QuizSubject, starredQuestionIds: string[]): QuizChapter {
  return {
    id: `mode-practice-starred-${Date.now()}`,
    title: "Luyện tập câu đã đánh dấu",
    questions: shuffleArray(getStarredQuestions(subject, starredQuestionIds)).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function makeExamChapter(subject: QuizSubject): QuizChapter {
  const chapterCount = subject.chapters.length;
  const baseCount = Math.floor(EXAM_QUESTION_COUNT / chapterCount);
  let extra = EXAM_QUESTION_COUNT % chapterCount;

  const questions = subject.chapters.flatMap((chapter) => {
    const take = baseCount + (extra > 0 ? 1 : 0);
    extra -= 1;
    return shuffleArray(chapter.questions).slice(0, Math.min(take, chapter.questions.length));
  });

  return {
    id: `mode-exam-40-${Date.now()}`,
    title: "Thi thử - 40 câu",
    questions: shuffleArray(questions).slice(0, EXAM_QUESTION_COUNT).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function makeSurvivalChapter(subject: QuizSubject, config: SurvivalConfig): QuizChapter {
  const survivalChapters = subject.chapters;
  const selectedChapter = subject.chapters.find((chapter) => chapter.id === config.chapterId) ?? subject.chapters[0];
  const sourceQuestions = config.scope === "chapter" && selectedChapter
    ? selectedChapter.questions
    : survivalChapters.flatMap((chapter) => chapter.questions);
  const questionCount = config.scope === "chapter" && selectedChapter?.id === "chuong-01"
    ? sourceQuestions.length
    : config.count === "full"
      ? sourceQuestions.length
      : Math.min(config.count, sourceQuestions.length);
  const scopeLabel = config.scope === "chapter" && selectedChapter ? selectedChapter.title : "Tất cả chương";
  const countLabel = questionCount === sourceQuestions.length ? "full" : `${questionCount} câu`;
  const shieldLabel = config.shieldEnabled ? "có khiêng" : "không khiêng";

  return {
    id: `mode-survival-${config.lives}-lives-${config.shieldEnabled ? "shield" : "no-shield"}-${config.scope}-${config.count}-${Date.now()}`,
    title: `Sinh tồn ${config.lives} mạng - ${shieldLabel} - ${scopeLabel} - ${countLabel}`,
    questions: shuffleArray(sourceQuestions).slice(0, questionCount).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function makeMatchingChapter(subject: QuizSubject, count: MatchingCount): QuizChapter {
  const sourceQuestions = getAllQuestions(subject).filter((question) => question.options.some((option) => option.correct));
  const questionCount = count === "full" ? sourceQuestions.length : Math.min(count, sourceQuestions.length);
  const countLabel = count === "full" ? "toàn phần" : `${questionCount} câu`;

  return {
    id: `mode-match-${count}-${Date.now()}`,
    title: `Nối câu hỏi - ${countLabel}`,
    questions: shuffleArray(sourceQuestions).slice(0, questionCount).map((question) => ({
      ...question,
      options: shuffleArray(question.options)
    }))
  };
}

function splitChapter(chapter: QuizChapter) {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < chapter.questions.length) {
    let end = Math.min(start + PART_SIZE, chapter.questions.length);
    const remaining = chapter.questions.length - end;

    if (remaining > 0 && remaining < MIN_STANDALONE_REMAINDER) {
      end = chapter.questions.length;
    }

    ranges.push({ start, end });
    start = end;
  }

  return ranges.map((range, index) => ({
    ...chapter,
    id: `${chapter.id}-part-${index + 1}`,
    title: `${chapter.title} - Phần ${index + 1}`,
    questions: chapter.questions.slice(range.start, range.end),
    rangeLabel: `Câu ${range.start + 1}-${range.end}`
  }));
}

function getChapter(subject: QuizSubject | undefined, chapterId?: string, questionOrder?: string[], optionOrders?: Record<string, string[]>) {
  if (!subject || !chapterId) {
    return undefined;
  }

  const fullChapter = subject.chapters.find((chapter) => chapter.id === chapterId);
  if (fullChapter) {
    return reorderChapter(fullChapter, questionOrder, optionOrders);
  }

  if (chapterId.endsWith("-shuffle")) {
    const baseChapter = subject.chapters.find((chapter) => chapter.id === getBaseChapterId(chapterId));
    if (baseChapter) {
      return reorderChapter(
        {
          ...baseChapter,
          id: chapterId,
          title: `${baseChapter.title} - Xáo trộn`
        },
        questionOrder,
        optionOrders
      );
    }
  }

  if (chapterId.startsWith("mode-exam-40")) {
    return reorderChapter(
      {
        id: chapterId,
        title: "Thi thử - 40 câu",
        questions: getAllQuestions(subject)
      },
      questionOrder,
      optionOrders
    );
  }

  if (chapterId.startsWith("mode-all-random")) {
    return reorderChapter(
      {
        id: chapterId,
        title: "Trộn tất cả câu hỏi",
        questions: getAllQuestions(subject)
      },
      questionOrder,
      optionOrders
    );
  }

  if (chapterId.startsWith("mode-practice-starred")) {
    return reorderChapter(
      {
        id: chapterId,
        title: "Luyện tập câu đã đánh dấu",
        questions: getAllQuestions(subject)
      },
      questionOrder,
      optionOrders
    );
  }

  if (chapterId.startsWith("mode-survival")) {
    return reorderChapter(
      {
        id: chapterId,
        title: "Sinh tồn",
        questions: getAllQuestions(subject)
      },
      questionOrder,
      optionOrders
    );
  }

  if (chapterId.startsWith("mode-match")) {
    return reorderChapter(
      {
        id: chapterId,
        title: "Nối câu hỏi",
        questions: getAllQuestions(subject)
      },
      questionOrder,
      optionOrders
    );
  }

  const part = subject.chapters.flatMap((chapter) => splitChapter(chapter)).find((chapter) => chapter.id === chapterId);
  return part ? reorderChapter(part, questionOrder, optionOrders) : undefined;
}

function getInitialState(subjects: QuizSubject[], saved: SavedProgress): QuizState {
  void subjects;
  void saved;
  return { answers: {}, submitted: false };
}

function getResultPercentValue(result: ResultItem) {
  return result.total ? Math.round((result.score / result.total) * 100) : 0;
}

function getXpForPercent(percent: number) {
  if (percent >= 100) {
    return 35;
  }

  if (percent >= 75) {
    return 20;
  }

  if (percent >= 50) {
    return 15;
  }

  if (percent >= 25) {
    return 10;
  }

  return 5;
}

function getSubjectEmoji(subjectId: string) {
  if (subjectId.includes("ktct")) {
    return "🏛️";
  }

  if (subjectId.includes("logic")) {
    return "🧠";
  }

  return "✨";
}

function modeResultMatches(result: ResultItem, mode: "exam" | "all" | "practice" | "survival" | "match") {
  const chapterId = result.chapterId ?? "";
  const title = result.chapterTitle.toLowerCase();

  switch (mode) {
    case "exam":
      return chapterId.startsWith("mode-exam-40") || title.includes("thi thử");
    case "all":
      return chapterId.startsWith("mode-all-random") || title.includes("trộn tất cả");
    case "practice":
      return chapterId.startsWith("mode-practice-starred") || title.includes("luyện tập");
    case "survival":
      return chapterId.startsWith("mode-survival") || title.includes("sinh tồn");
    case "match":
      return chapterId.startsWith("mode-match") || title.includes("nối câu hỏi");
  }
}

function isPerfectResult(result: ResultItem) {
  return result.total > 0 && result.score === result.total;
}

function getAchievements(subject: QuizSubject | undefined, results: ResultItem[], profile: ProfileProgress): Achievement[] {
  const allQuestionsCount = subject ? getAllQuestions(subject).length : 0;
  const chapters = subject?.chapters ?? [];
  const unlockedAchievementIds = new Set(profile.unlockedAchievementIds);
  const perfectResults = results.filter(isPerfectResult);
  const hasPerfectMode = (mode: "exam" | "all" | "practice" | "survival" | "match", requiresFull = false) =>
    perfectResults.some((result) => modeResultMatches(result, mode) && (!requiresFull || result.total >= allQuestionsCount));
  const perfectChapterIds = new Set(
    perfectResults
      .map((result) => {
        if (result.chapterId && chapters.some((chapter) => chapter.id === result.chapterId)) {
          return result.chapterId;
        }

        return chapters.find((chapter) => chapter.title === result.chapterTitle)?.id;
      })
      .filter((chapterId): chapterId is string => Boolean(chapterId))
  );
  const survivalKing = perfectResults.some((result) => {
    const chapterId = result.chapterId ?? "";
    const title = result.chapterTitle.toLowerCase();
    return (
      modeResultMatches(result, "survival") &&
      (chapterId.includes("no-shield") || title.includes("không khiêng")) &&
      (chapterId.includes("-all-full-") || (title.includes("tất cả") && title.includes("full"))) &&
      (!allQuestionsCount || result.total >= allQuestionsCount)
    );
  });

  return [
    {
      id: "perfect-exam",
      title: "Thi thử tuyệt đối",
      description: "Hoàn thành Thi thử với kết quả 100%.",
      unlocked: unlockedAchievementIds.has("perfect-exam") || hasPerfectMode("exam")
    },
    {
      id: "perfect-all",
      title: "Trộn full tuyệt đối",
      description: "Hoàn thành Trộn tất cả full câu với kết quả 100%.",
      unlocked: unlockedAchievementIds.has("perfect-all") || hasPerfectMode("all", true)
    },
    {
      id: "perfect-study",
      title: "Chủ lực chế độ học",
      description: "Hoàn thành 100% tất cả chương trong Chế độ học.",
      unlocked: unlockedAchievementIds.has("perfect-study") || (chapters.length > 0 && chapters.every((chapter) => perfectChapterIds.has(chapter.id)))
    },
    {
      id: "perfect-practice",
      title: "Luyện tập tuyệt đối",
      description: "Hoàn thành Luyện tập với kết quả 100%.",
      unlocked: unlockedAchievementIds.has("perfect-practice") || hasPerfectMode("practice")
    },
    {
      id: "perfect-survival",
      title: "Sinh tồn tuyệt đối",
      description: "Hoàn thành Sinh tồn với kết quả 100%.",
      unlocked: unlockedAchievementIds.has("perfect-survival") || hasPerfectMode("survival")
    },
    {
      id: "perfect-match",
      title: "Bậc thầy nối câu",
      description: "Hoàn thành Nối câu hỏi với kết quả 100%.",
      unlocked: unlockedAchievementIds.has("perfect-match") || hasPerfectMode("match")
    },
    {
      id: "survival-king",
      title: "Vua sinh tồn",
      description: "Hoàn thành Sinh tồn không khiêng, xáo trộn tất cả câu ở mức full.",
      unlocked: unlockedAchievementIds.has("survival-king") || survivalKing
    },
    {
      id: "rau-ma-king",
      title: "Vua rau má",
      description: "Đạt đúng 36% ở bất kỳ mode nào.",
      unlocked: unlockedAchievementIds.has("rau-ma-king") || results.some((result) => getResultPercentValue(result) === 36)
    },
    {
      id: "level-100",
      title: "Lên cấp LV 100",
      description: "Chạm cấp tối đa LV 100.",
      unlocked: unlockedAchievementIds.has("level-100") || profile.level >= 100
    },
    {
      id: "level-36",
      title: "Mốc LV 36",
      description: "Đạt đến LV 36.",
      unlocked: unlockedAchievementIds.has("level-36") || profile.level >= 36
    }
  ];
}

function getMotionConfig(motion: MotionLevel) {
  switch (motion) {
    case "low":
      return { count: 28, durationBase: 980, durationRange: 420, delayRange: 180, sizeBase: 1.3, sizeRange: 1.8 };
    case "high":
      return { count: 72, durationBase: 680, durationRange: 420, delayRange: 260, sizeBase: 1.8, sizeRange: 2.9 };
    case "normal":
      return { count: 56, durationBase: 780, durationRange: 520, delayRange: 240, sizeBase: 1.65, sizeRange: 2.35 };
    case "off":
      return { count: 0, durationBase: 0, durationRange: 0, delayRange: 0, sizeBase: 0, sizeRange: 0 };
  }
}

function useAnimatedNumber(value: number, duration = 900) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let startedAt = 0;

    function tick(timestamp: number) {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    setDisplayValue(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function makeEmojiSweepItems(motion: MotionLevel) {
  const config = getMotionConfig(motion);
  return Array.from({ length: config.count }, (_, index): EmojiSweepItem => ({
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    delay: Math.random() * config.delayRange,
    direction: Math.random() > 0.5 ? "right" : "left",
    duration: config.durationBase + Math.random() * config.durationRange,
    emoji: EMOJI_SWEEP_POOL[Math.floor(Math.random() * EMOJI_SWEEP_POOL.length)],
    size: config.sizeBase + Math.random() * config.sizeRange,
    top: 4 + Math.random() * 88
  }));
}

function getNextBackground(current: BackgroundMode) {
  const backgrounds: BackgroundMode[] = ["grid", "blast", "stickers", "checker", "poster", "tape", "notebook", "neon", "waves"];
  const candidates = backgrounds.filter((background) => background !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getResultMood(percent: number) {
  if (percent === 36) {
    return { emoji: "🥬", label: "Rau má" };
  }

  if (percent <= 24) {
    return { emoji: "❓", label: "Toxic" };
  }

  if (percent <= 49) {
    return { emoji: "💸", label: "18 tuổi ăn được chưa?" };
  }

  if (percent === 50) {
    return { emoji: "🤡", label: "Vừa qua môn" };
  }

  if (percent <= 74) {
    return { emoji: "🤪", label: "Cực kỳ Yassss!" };
  }

  if (percent <= 99) {
    return { emoji: "👾", label: "Chưa tày đâu" };
  }

  return { emoji: "👽", label: "Hù ai vậy" };
}

function getResultQuotes(percent: number) {
  if (percent === 36) {
    return [
      "Mát mát tẻn tẻn",
      "Vuýp",
      "Cốt",
      "Gwenchana",
      "Rau má thiệt chứ",
      "Tới đây là xanh mặt rồi",
      "Nhẹ nhàng nhưng hơi lú",
      "Cũng có miếng kiến thức đó",
      "Biết vậy là cũng dữ rồi",
      "Ê nha",
      "Ủa alo?",
      "Ủa gì kỳ vậy?",
      "Rồi luôn",
      "Chịu rồi đó"
    ];
  }

  if (percent <= 24) {
    return [
      "Thua thực dân Pháp mỗi quốc tịch",
      "Cho qua Cam chích điện",
      "To6",
      "Thân chưa mà giỡn kiểu đó?",
      "Xin lỗi bà nha, cái miệng tui hơi giãn",
      "Trí thông minh giản zị",
      "Ai hoải",
      "Im lặng đi Gopi",
      "Phải gì, phải gì... phải chịu",
      "Làm quá nó ô dề",
      "Khê lắm",
      "Tới đây là hết cứu",
      "Hơn cả khu tự trị",
      "Thua Càn Long mỗi cái ngai vàng",
      "iPhone nhưng hệ điều hành Android"
    ];
  }

  if (percent <= 49) {
    return [
      "Cơm nước gì chưa người đẹp?",
      "Thuyệt hông bà?",
      "Khum",
      "U là trời",
      "J z tr?",
      "Trmúa hmề",
      "Pềct / rếpct",
      "Kiwi kiwi",
      "Cũng cũng",
      "Đại đại đi",
      "Đoán vội",
      "Các con vợ",
      "Oi thoi chet",
      "Đang ăn gừng"
    ];
  }

  if (percent === 50) {
    return [
      "Ét o ét",
      "Vừa đủ sống sót",
      "Qua môn trong nước mắt",
      "Không giỏi nhưng có cố gắng",
      "Nửa đường rồi các chiến thần",
      "Tạm ổn áp, chưa nổ máy",
      "Kiếp nạn thứ 82",
      "Thắng đời 1-0",
      "Thua đời 1-0",
      "Học đến khi tan đá",
      "Hình phạt dành cho người thức khuya",
      "Miệng không hồi chiêu",
      "Bình tĩnh nào các chiến thần",
      "Anh nhắc em"
    ];
  }

  if (percent <= 74) {
    return [
      "Đủ wow rồi đó",
      "Tuyệt đối điện ảnh",
      "Mãi mận mãi keo",
      "Đỉnh nóc kịch trần bay phấp phới",
      "Cá thể vượt trội",
      "Vua chúa cũng chỉ đến thế",
      "Ra đường tôi nể mỗi bạn",
      "Mình xin phép ăn miếng to nhé",
      "Điều mà chẳng ai làm được",
      "Ngôn tình cũng không dám viết nam chính/nữ chính như này",
      "Tui tưởng ai cũng có chứ tar",
      "Kết ấn cầu tài",
      "Cực kỳ Yassss!",
      "Hệ điều hành Gen Z bản full"
    ];
  }

  if (percent <= 99) {
    return [
      "Chưa đủ wow",
      "Ê khó nha bro, khó nha",
      "Vượt mức pickleball",
      "Tới công chuyện",
      "Tới đây là tới công chuyện rồi",
      "Rồi xong luôn",
      "Dữ chưa dữ chưa",
      "Cũng dữ rồi đó",
      "Không ấy mình...",
      "Không ấy mình đi ngủ đi",
      "Không ấy mình nghỉ chơi đi",
      "Rồi mắc gì cười?",
      "Cười khùng cười điên",
      "Tôi ổn, nhưng là ổn áp 220V"
    ];
  }

  return [
    "Hù ai vậy?",
    "Trùm cuối xuất hiện",
    "Cái gì cũng biết hết trơn",
    "TikTok gọi bằng tổ tiên",
    "Tôi nghe và không phán xét",
    "Trùng sinh chắc luôn",
    "Xin lỗi vì đã hít chung không khí",
    "Nghe bài Trình chưa?",
    "Đờ Mờ Hờ",
    "Tôi là Đờ Mờ Hờ",
    "Flop quá thì ghi tên anh vào",
    "Đã làm gì đâu? Đã chạm vào đâu?",
    "Mọi thứ hóa điên với chồng ngày hôm nay",
    "Tại sao anh Pakistan lại gọi cho Ny bằng số điện thoại?",
    "Bà nói thiệt hả bà Thơ?"
  ];
}

function getResultQuote(percent: number, seed: string) {
  const quotes = getResultQuotes(percent);
  const index = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), percent) % quotes.length;
  return quotes[index];
}

function getResultCelebration(percent: number) {
  if (percent === 100) {
    return "Tuyệt đẹp 100%";
  }

  if (percent >= 75) {
    return "Đỉnh quá, tự hào nha";
  }

  return "";
}

function getResultPercentEffect(percent: number) {
  if (percent >= 100) {
    return "result-percent-perfect";
  }

  if (percent >= 75) {
    return "result-percent-lightning";
  }

  if (percent >= 50) {
    return "result-percent-moss";
  }

  if (percent >= 25) {
    return "result-percent-break";
  }

  return "result-percent-fall";
}

function getQuestionStats(subjects: QuizSubject[], saved: SavedProgress): QuestionStat[] {
  const stats = new Map<string, QuestionStat>();

  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      for (const question of chapter.questions) {
        stats.set(question.id, {
          id: question.id,
          prompt: question.prompt,
          subjectTitle: subject.title,
          chapterTitle: chapter.title,
          correct: 0,
          wrong: 0,
          skipped: 0,
          total: 0
        });
      }
    }
  }

  Object.values(saved.items).forEach((item) => {
    if (!item.submitted) {
      return;
    }

    const subject = getSubject(subjects, item.subjectId);
    const chapter = getChapter(subject, item.chapterId, item.questionOrder, item.optionOrders);
    if (!chapter) {
      return;
    }

    chapter.questions.forEach((question) => {
      const stat = stats.get(question.id);
      if (!stat) {
        return;
      }

      const selectedId = item.answers[question.id];
      const selected = question.options.find((option) => option.id === selectedId);
      stat.total += 1;

      if (!selectedId) {
        stat.skipped += 1;
      } else if (selected?.correct) {
        stat.correct += 1;
      } else {
        stat.wrong += 1;
      }
    });
  });

  return Array.from(stats.values()).sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return b.wrong - a.wrong;
  });
}

export function QuizApp({ subjects }: { subjects: QuizSubject[] }) {
  const savedRef = useRef<SavedProgress>(restoreSaved());
  const settingsRef = useRef<AppSettings>(restoreSettings());
  const authRef = useRef<AuthState>(restoreAuth());
  const profileMediaRef = useRef<ProfileMedia>(restoreProfileMedia());
  const profileProgressRef = useRef<ProfileProgress>(restoreProfileProgress());
  const [saved, setSaved] = useState<SavedProgress>(savedRef.current);
  const [settings, setSettings] = useState<AppSettings>(settingsRef.current);
  const [auth, setAuth] = useState<AuthState>(authRef.current);
  const [profileMedia, setProfileMedia] = useState<ProfileMedia>(profileMediaRef.current);
  const [profileProgress, setProfileProgress] = useState<ProfileProgress>(profileProgressRef.current);
  const [state, setState] = useState<QuizState>(() => getInitialState(subjects, savedRef.current));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [memoryTipId, setMemoryTipId] = useState<string | null>(null);
  const [pendingMemoryTipId, setPendingMemoryTipId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteResultsOpen, setDeleteResultsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(!authRef.current.session);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [adminControlOpen, setAdminControlOpen] = useState(false);
  const [survivalConfigOpen, setSurvivalConfigOpen] = useState(false);
  const [matchingConfigOpen, setMatchingConfigOpen] = useState(false);
  const [modeConfigSubject, setModeConfigSubject] = useState<QuizSubject | null>(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemActionId, setItemActionId] = useState<string | null>(null);
  const [resultActionId, setResultActionId] = useState<string | null>(null);
  const [latestSubmitId, setLatestSubmitId] = useState<string | null>(null);
  const [submitPopupResult, setSubmitPopupResult] = useState<ResultItem | null>(null);
  const [emojiSweepItems, setEmojiSweepItems] = useState<EmojiSweepItem[]>([]);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const [activeAchievementToast, setActiveAchievementToast] = useState<Achievement | null>(null);
  const [pomodoroBreakOpen, setPomodoroBreakOpen] = useState(false);
  const [pomodoroCycleStartedAt, setPomodoroCycleStartedAt] = useState(() => Date.now());
  const transitionKeyRef = useRef<string | null>(null);
  const survivalResultSavedRef = useRef<string | null>(null);
  const achievementToastReadyRef = useRef(false);
  const cloudDataLoadedRef = useRef(false);
  const currentUser = auth.session;
  const isGuest = !currentUser;
  const isPomodoroActive = Boolean(state.subject && state.chapter && !state.submitted);

  function requireLogin() {
    if (currentUser) {
      return false;
    }

    setAuthMode("login");
    setAuthOpen(true);
    return true;
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    authRef.current = auth;
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    profileMediaRef.current = profileMedia;
    window.localStorage.setItem(PROFILE_MEDIA_KEY, JSON.stringify(profileMedia));
  }, [profileMedia]);

  useEffect(() => {
    profileProgressRef.current = profileProgress;
    window.localStorage.setItem(PROFILE_PROGRESS_KEY, JSON.stringify(profileProgress));
  }, [profileProgress]);

  useEffect(() => {
    const token = auth.sessionToken;
    if (!token) {
      cloudDataLoadedRef.current = false;
      return;
    }

    let cancelled = false;
    fetch("/api/app-data", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load cloud data.");
        }
        return response.json() as Promise<{
          saved?: SavedProgress;
          profileMedia?: ProfileMedia;
          profileProgress?: ProfileProgress;
        }>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (data.saved && hasSavedContent(data.saved)) {
          setSaved({
            ...emptySaved(),
            ...data.saved,
            items: data.saved.items ?? {},
            order: data.saved.order ?? Object.keys(data.saved.items ?? {}),
            starredQuestionIds: data.saved.starredQuestionIds ?? [],
            results: data.saved.results ?? []
          });
        }
        if (data.profileMedia) {
          setProfileMedia(data.profileMedia);
        }
        if (data.profileProgress) {
          setProfileProgress(normalizeProfileProgress(data.profileProgress));
        }
        cloudDataLoadedRef.current = true;
      })
      .catch(() => {
        cloudDataLoadedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [auth.sessionToken]);

  useEffect(() => {
    const token = auth.sessionToken;
    if (!token || !cloudDataLoadedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch("/api/app-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ saved, profileMedia, profileProgress })
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [auth.sessionToken, saved, profileMedia, profileProgress]);

  useEffect(() => {
    settingsRef.current = settings;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.background = settings.background;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.documentElement.dataset.motion = settings.motion;
  }, [settings]);

  useEffect(() => {
    setPomodoroCycleStartedAt(Date.now());
    setPomodoroBreakOpen(false);
  }, [settings.pomodoroEnabled, settings.pomodoroFocusMinutes]);

  useEffect(() => {
    const now = Date.now();
    setPomodoroCycleStartedAt(now);
    setPomodoroBreakOpen(false);
  }, [isPomodoroActive]);

  useEffect(() => {
    if (!isPomodoroActive || !settings.pomodoroEnabled || settings.pomodoroFocusMinutes < 10) {
      return;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();

      if (now - pomodoroCycleStartedAt < settings.pomodoroFocusMinutes * 60_000) {
        return;
      }

      if (settings.pomodoroBreakEnabled) {
        setPomodoroBreakOpen(true);
      } else {
        setPomodoroCycleStartedAt(now);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isPomodoroActive,
    pomodoroCycleStartedAt,
    settings.pomodoroBreakEnabled,
    settings.pomodoroEnabled,
    settings.pomodoroFocusMinutes
  ]);

  useEffect(() => {
    const transitionKey = `${state.subject?.id ?? "home"}:${state.chapter?.id ?? "modes"}:${state.submitted ? "submitted" : "active"}`;
    if (transitionKeyRef.current === null) {
      transitionKeyRef.current = transitionKey;
      return;
    }

    if (transitionKeyRef.current === transitionKey) {
      return;
    }

    transitionKeyRef.current = transitionKey;
    const currentSettings = settingsRef.current;
    if (currentSettings.backgroundRandom && Date.now() >= currentSettings.nextBackgroundAt) {
      setSettings((current) => ({
        ...current,
        background: getNextBackground(current.background),
        nextBackgroundAt: Date.now() + current.backgroundRandomMinutes * 60_000
      }));
    }

    if (currentSettings.motion === "off") {
      setEmojiSweepItems([]);
      return;
    }

    setEmojiSweepItems(makeEmojiSweepItems(currentSettings.motion));
    const timer = window.setTimeout(() => setEmojiSweepItems([]), 1800);
    return () => window.clearTimeout(timer);
  }, [state.subject?.id, state.chapter?.id, state.submitted]);

  useEffect(() => {
    setSaved((current) => {
      const next: SavedProgress = {
        ...current,
        activeSubjectId: state.subject?.id,
        activeChapterId: state.chapter?.id
      };

      if (state.subject && state.chapter) {
        if (state.chapter.id.startsWith("mode-match")) {
          return next;
        }

        const id = progressId(state.subject.id, state.chapter.id);
        next.items = {
          ...next.items,
          [id]: {
            id,
            subjectId: state.subject.id,
            chapterId: state.chapter.id,
            userName: currentUser?.name,
            questionOrder: shouldPersistOrder(state.chapter.id) ? state.chapter.questions.map((question) => question.id) : next.items[id]?.questionOrder,
            optionOrders: shouldPersistOrder(state.chapter.id)
              ? Object.fromEntries(state.chapter.questions.map((question) => [question.id, question.options.map((option) => option.id)]))
              : next.items[id]?.optionOrders,
            answers: state.answers,
            submitted: state.submitted,
            updatedAt: Date.now(),
            pinnedAt: next.items[id]?.pinnedAt
          }
        };
        next.order = current.order.includes(id) ? current.order : [id, ...current.order];
      }

      return next;
    });
  }, [state, currentUser?.name]);

  useEffect(() => {
    if (currentUser || (!state.subject && !state.chapter)) {
      return;
    }

    setState({ answers: {}, submitted: false });
  }, [currentUser, state.chapter, state.subject]);

  const currentProgressId = state.subject && state.chapter ? progressId(state.subject.id, state.chapter.id) : undefined;
  const displayUser = currentUser ?? { name: "user", role: "member" as const };
  const displayProfileMedia = profileMedia[displayUser.name];
  const primarySubject = subjects[0];
  const score = useMemo(() => {
    if (!state.chapter) {
      return 0;
    }

    return state.chapter.questions.reduce((total, question) => {
      const selectedId = state.answers[question.id];
      const selected = question.options.find((option) => option.id === selectedId);
      return total + (selected?.correct ? 1 : 0);
    }, 0);
  }, [state.answers, state.chapter]);

  const answeredCount = state.chapter
    ? state.chapter.questions.filter((question) => Boolean(state.answers[question.id])).length
    : 0;
  const allAnswered = Boolean(state.chapter && answeredCount === state.chapter.questions.length);
  const scorePercent = state.chapter ? Math.round((score / state.chapter.questions.length) * 100) : 0;
  const resultMood = getResultMood(scorePercent);
  const resultQuote = getResultQuote(scorePercent, latestSubmitId ?? currentProgressId ?? "current-result");
  const resultCelebration = getResultCelebration(scorePercent);
  const resultPercentEffect = getResultPercentEffect(scorePercent);
  const isExamMode = Boolean(state.chapter?.id.startsWith("mode-exam-40"));
  const isMatchingMode = Boolean(state.chapter?.id.startsWith("mode-match"));
  const activeMemoryTip = memoryTipId ? memoryTips[memoryTipId] : undefined;
  const pendingMemoryTip = pendingMemoryTipId ? memoryTips[pendingMemoryTipId] : undefined;
  const isAdmin = currentUser?.role === "admin";
  const questionStats = useMemo(() => getQuestionStats(subjects, saved), [subjects, saved]);
  const achievements = useMemo(() => getAchievements(primarySubject, saved.results ?? [], profileProgress), [primarySubject, profileProgress, saved.results]);
  const completedAchievementCount = achievements.filter((achievement) => achievement.unlocked).length;

  useEffect(() => {
    const unlockedIds = achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id);
    if (unlockedIds.length === 0) {
      achievementToastReadyRef.current = true;
      return;
    }
    const newAchievements = achievements.filter(
      (achievement) => achievement.unlocked && !profileProgress.unlockedAchievementIds.includes(achievement.id)
    );

    setProfileProgress((current) => {
      const merged = Array.from(new Set([...current.unlockedAchievementIds, ...unlockedIds]));
      if (merged.length === current.unlockedAchievementIds.length) {
        return current;
      }

      return {
        ...current,
        unlockedAchievementIds: merged
      };
    });

    if (achievementToastReadyRef.current && newAchievements.length > 0) {
      setAchievementQueue((queue) => [...queue, ...newAchievements]);
    }

    achievementToastReadyRef.current = true;
  }, [achievements, profileProgress.unlockedAchievementIds]);

  useEffect(() => {
    if (activeAchievementToast || achievementQueue.length === 0) {
      return;
    }

    const [nextAchievement, ...rest] = achievementQueue;
    setActiveAchievementToast(nextAchievement);
    setAchievementQueue(rest);
  }, [activeAchievementToast, achievementQueue]);

  useEffect(() => {
    if (!activeAchievementToast) {
      return;
    }

    const timer = window.setTimeout(() => setActiveAchievementToast(null), 3900);
    return () => window.clearTimeout(timer);
  }, [activeAchievementToast]);

  useEffect(() => {
    if (!state.subject || !state.chapter || !state.submitted || !state.survival?.gameOver || !currentProgressId) {
      return;
    }

    if (survivalResultSavedRef.current === currentProgressId) {
      return;
    }

    const finalScore = state.chapter.questions.reduce((total, question) => {
      const selectedId = state.answers[question.id];
      const selected = question.options.find((option) => option.id === selectedId);
      return total + (selected?.correct ? 1 : 0);
    }, 0);
    const result: ResultItem = {
      id: `${state.subject.id}:${state.chapter.id}:${Date.now()}`,
      subjectId: state.subject.id,
      chapterId: state.chapter.id,
      chapterTitle: `${state.chapter.title} - hết mạng`,
      userName: currentUser?.name,
      score: finalScore,
      total: state.chapter.questions.length,
      submittedAt: Date.now()
    };

    survivalResultSavedRef.current = currentProgressId;
    setSaved((current) => ({
      ...current,
      results: [result, ...(current.results ?? [])].slice(0, 30)
    }));
    setLatestSubmitId(result.id);
    setSubmitPopupResult(result);
    awardProfileProgress(result);
  }, [currentProgressId, currentUser?.name, state.answers, state.chapter, state.subject, state.submitted, state.survival?.gameOver]);

  const progressItems = saved.order
    .map((id) => saved.items[id])
    .filter((item): item is ProgressItem => Boolean(item))
    .filter((item) => !item.submitted)
    .sort((a, b) => {
      if (a.pinnedAt && b.pinnedAt) {
        return b.pinnedAt - a.pinnedAt;
      }
      if (a.pinnedAt) {
        return -1;
      }
      if (b.pinnedAt) {
        return 1;
      }
      return saved.order.indexOf(a.id) - saved.order.indexOf(b.id);
    });
  function openProgress(item: ProgressItem) {
    if (requireLogin()) {
      return;
    }

    const subject = getSubject(subjects, item.subjectId);
    const chapter = getChapter(subject, item.chapterId, item.questionOrder, item.optionOrders);
    if (!subject || !chapter) {
      return;
    }
    setItemActionId(null);
    setState({
      subject,
      chapter,
      answers: item.answers,
      submitted: item.submitted
    });
  }

  function startShuffledChapter(subject: QuizSubject, chapter: QuizChapter) {
    if (requireLogin()) {
      return;
    }

    const shuffled = makeShuffledChapter(chapter);
    const id = progressId(subject.id, shuffled.id);
    const item = saved.items[id];

    setState({
      subject,
      chapter: item ? reorderChapter(shuffled, item.questionOrder, item.optionOrders) : shuffled,
      answers: item?.answers ?? {},
      submitted: item?.submitted ?? false
    });
  }

  function startExamMode(subject: QuizSubject) {
    if (requireLogin()) {
      return;
    }

    setState({
      subject,
      chapter: makeExamChapter(subject),
      answers: {},
      submitted: false
    });
  }

  function startAllRandomMode(subject: QuizSubject) {
    if (requireLogin()) {
      return;
    }

    setState({
      subject,
      chapter: makeAllQuestionsChapter(subject),
      answers: {},
      submitted: false
    });
  }

  function startPracticeMode(subject: QuizSubject) {
    if (requireLogin()) {
      return;
    }

    setState({
      subject,
      chapter: makePracticeChapter(subject, saved.starredQuestionIds ?? []),
      answers: {},
      submitted: false
    });
  }

  function startSurvivalMode(subject: QuizSubject, config: SurvivalConfig) {
    if (requireLogin()) {
      return;
    }

    setSurvivalConfigOpen(false);
    setState({
      subject,
      chapter: makeSurvivalChapter(subject, config),
      answers: {},
      submitted: false,
      survival: {
        livesTotal: config.lives,
        livesLeft: config.lives,
        shieldEnabled: config.shieldEnabled,
        shieldAvailable: config.shieldEnabled,
        gameOver: false
      }
    });
  }

  function startMatchingMode(subject: QuizSubject, count: MatchingCount) {
    if (requireLogin()) {
      return;
    }

    setMatchingConfigOpen(false);
    setState({
      subject,
      chapter: makeMatchingChapter(subject, count),
      answers: {},
      submitted: false
    });
  }

  function awardProfileProgress(result: ResultItem) {
    const percent = getResultPercentValue(result);
    const xpGain = getXpForPercent(percent);

    setProfileProgress((current) => {
      if (current.awardedResultIds.includes(result.id)) {
        return current;
      }

      if (current.level >= 100) {
        return {
          ...current,
          xp: 0,
          awardedResultIds: [result.id, ...current.awardedResultIds].slice(0, 300)
        };
      }

      const totalXp = current.xp + xpGain;
      const nextLevel = Math.min(100, current.level + Math.floor(totalXp / 100));

      return {
        level: nextLevel,
        xp: nextLevel >= 100 ? 0 : totalXp % 100,
        awardedResultIds: [result.id, ...current.awardedResultIds].slice(0, 300),
        unlockedAchievementIds: current.unlockedAchievementIds
      };
    });
  }

  function finishMatchingMode(scoreValue: number, totalValue: number) {
    if (requireLogin()) {
      return;
    }

    if (!state.subject || !state.chapter) {
      return;
    }

    const result: ResultItem = {
      id: `${state.subject.id}:${state.chapter.id}:${Date.now()}`,
      subjectId: state.subject.id,
      chapterId: state.chapter.id,
      chapterTitle: state.chapter.title,
      userName: currentUser?.name,
      score: scoreValue,
      total: totalValue,
      submittedAt: Date.now()
    };

    setSaved((current) => ({
      ...current,
      results: [result, ...(current.results ?? [])].slice(0, 30)
    }));
    setLatestSubmitId(result.id);
    setSubmitPopupResult(result);
    awardProfileProgress(result);
    setState((current) => ({ ...current, submitted: true }));
  }

  function answerQuestion(question: QuizChapter["questions"][number], optionId: string) {
    if (requireLogin()) {
      return;
    }

    if (state.submitted || (state.survival && state.answers[question.id])) {
      return;
    }

    const selected = question.options.find((option) => option.id === optionId);
    const isWrong = Boolean(selected && !selected.correct);

    setState((current) => {
      const nextAnswers = {
        ...current.answers,
        [question.id]: optionId
      };

      if (!current.survival || !isWrong) {
        return {
          ...current,
          answers: nextAnswers
        };
      }

      const shieldSaves = current.survival.shieldEnabled && current.survival.shieldAvailable;
      const nextLives = shieldSaves ? current.survival.livesLeft : Math.max(0, current.survival.livesLeft - 1);
      const gameOver = nextLives <= 0;

      return {
        ...current,
        answers: nextAnswers,
        submitted: gameOver,
        survival: {
          ...current.survival,
          livesLeft: nextLives,
          shieldAvailable: shieldSaves ? false : current.survival.shieldAvailable,
          gameOver
        }
      };
    });
  }

  function toggleStar(questionId: string) {
    if (requireLogin()) {
      return;
    }

    setSaved((current) => {
      const starred = new Set(current.starredQuestionIds ?? []);
      if (starred.has(questionId)) {
        starred.delete(questionId);
      } else {
        starred.add(questionId);
      }

      return {
        ...current,
        starredQuestionIds: Array.from(starred)
      };
    });
  }

  function submitCurrentQuiz() {
    if (requireLogin()) {
      return;
    }

    if (!state.subject || !state.chapter) {
      return;
    }

    const result: ResultItem = {
      id: `${state.subject.id}:${state.chapter.id}:${Date.now()}`,
      subjectId: state.subject.id,
      chapterId: state.chapter.id,
      chapterTitle: state.chapter.title,
      userName: currentUser?.name,
      score,
      total: state.chapter.questions.length,
      submittedAt: Date.now()
    };

    setSaved((current) => ({
      ...current,
      results: [result, ...(current.results ?? [])].slice(0, 30)
    }));
    setLatestSubmitId(result.id);
    setSubmitPopupResult(result);
    awardProfileProgress(result);
    setState((current) => ({ ...current, submitted: true }));
  }

  function openMemoryTip(questionId: string) {
    if (!memoryTips[questionId]) {
      return;
    }

    if (state.submitted) {
      setMemoryTipId(questionId);
      return;
    }

    if (!isExamMode) {
      setPendingMemoryTipId(questionId);
    }
  }

  function moveProgress(id: string, direction: -1 | 1) {
    setSaved((current) => {
      const order = [...current.order];
      const index = order.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return current;
      }
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, order };
    });
  }

  function deleteProgress(id: string) {
    setSaved((current) => {
      const { [id]: _removed, ...items } = current.items;
      return { ...current, items, order: current.order.filter((itemId) => itemId !== id) };
    });
    if (currentProgressId === id) {
      setState((current) => ({ subject: current.subject, answers: {}, submitted: false }));
    }
    setItemActionId(null);
  }

  function pinProgress(id: string) {
    setSaved((current) => {
      const pinned = Object.values(current.items).filter((item) => item.pinnedAt && item.id !== id);
      if (!current.items[id] || (!current.items[id].pinnedAt && pinned.length >= MAX_PINNED)) {
        return current;
      }
      return {
        ...current,
        items: {
          ...current.items,
          [id]: { ...current.items[id], pinnedAt: Date.now() }
        },
        order: [id, ...current.order.filter((itemId) => itemId !== id)]
      };
    });
    setItemActionId(null);
  }

  function unpinProgress(id: string) {
    setSaved((current) => {
      if (!current.items[id]) {
        return current;
      }

      return {
        ...current,
        items: {
          ...current.items,
          [id]: { ...current.items[id], pinnedAt: undefined }
        }
      };
    });
    setItemActionId(null);
  }

  function resetAllProgress() {
    setSaved((current) => ({
      ...current,
      activeSubjectId: undefined,
      activeChapterId: undefined,
      items: {},
      order: []
    }));
    setState({ answers: {}, submitted: false });
    setDeleteAllOpen(false);
    setMenuOpen(false);
  }

  function resetAllResults() {
    setSaved((current) => ({ ...current, results: [] }));
    setDeleteResultsOpen(false);
  }

  function deleteResult(id: string) {
    setSaved((current) => ({
      ...current,
      results: (current.results ?? []).filter((result) => result.id !== id)
    }));
    setResultActionId(null);
  }

  function pinResult(id: string) {
    setSaved((current) => {
      const results = current.results ?? [];
      const pinned = results.filter((result) => result.pinnedAt && result.id !== id);
      if (pinned.length >= MAX_PINNED && !results.find((result) => result.id === id)?.pinnedAt) {
        return current;
      }

      return {
        ...current,
        results: results.map((result) =>
          result.id === id ? { ...result, pinnedAt: Date.now() } : result
        )
      };
    });
    setResultActionId(null);
  }

  function unpinResult(id: string) {
    setSaved((current) => ({
      ...current,
      results: (current.results ?? []).map((result) =>
        result.id === id ? { ...result, pinnedAt: undefined } : result
      )
    }));
    setResultActionId(null);
  }

  async function loginUser(name: string, password: string, rememberPassword: boolean) {
    const cleanedName = name.trim();
    if (!cleanedName || !password) {
      return "Vui lòng nhập tên đăng nhập và mật khẩu.";
    }

    const result = await requestAppAuth({ action: "login", name: cleanedName, password });
    if (result.error || !result.user || !result.token) {
      return result.error ?? "Không đăng nhập được.";
    }

    setAuth(authStateForSession(result.user, result.token, rememberPassword));
    setAuthOpen(false);
    return undefined;
  }

  async function registerUser(email: string, name: string, password: string, confirmPassword: string) {
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedName = name.trim();

    if (!cleanedEmail || !cleanedName || !password || !confirmPassword) {
      return "Vui lòng điền đủ thông tin.";
    }

    if (!cleanedEmail.includes("@")) {
      return "Email chưa hợp lệ.";
    }

    if (password.length < 8) {
      return "Mật khẩu cần ít nhất 8 ký tự.";
    }

    if (password !== confirmPassword) {
      return "Mật khẩu xác nhận không khớp.";
    }

    const result = await requestAppAuth({
      action: "register",
      email: cleanedEmail,
      name: cleanedName,
      password,
      confirmPassword
    });

    if (result.error || !result.user || !result.token) {
      return result.error ?? "Không tạo được tài khoản.";
    }

    setAuth(authStateForSession(result.user, result.token, false));
    setAuthOpen(false);
    return undefined;
  }

  function logoutUser() {
    setAuth((current) => ({ users: [], rememberedName: current.rememberedName, rememberPassword: current.rememberPassword }));
    setAuthMode("login");
    setAuthOpen(true);
  }

  async function changeCurrentPassword(currentPassword: string, nextPassword: string, confirmPassword: string) {
    if (!currentUser || !auth.sessionToken) {
      return "Bạn cần đăng nhập trước khi đổi mật khẩu.";
    }

    const cleanedCurrentPassword = currentPassword.trim();
    const cleanedNextPassword = nextPassword.trim();
    const cleanedConfirmPassword = confirmPassword.trim();

    if (!cleanedCurrentPassword || !cleanedNextPassword || !cleanedConfirmPassword) {
      return "Vui lòng điền đủ mật khẩu hiện tại, mật khẩu mới và xác nhận lại.";
    }

    if (cleanedNextPassword.length < 8) {
      return "Mật khẩu mới cần ít nhất 8 ký tự.";
    }

    if (cleanedNextPassword === cleanedCurrentPassword) {
      return "Mật khẩu mới phải khác mật khẩu hiện tại.";
    }

    if (cleanedNextPassword !== cleanedConfirmPassword) {
      return "Mật khẩu xác nhận không khớp.";
    }

    const result = await requestAppAuth({
      action: "change-password",
      currentPassword: cleanedCurrentPassword,
      nextPassword: cleanedNextPassword,
      confirmPassword: cleanedConfirmPassword
    }, auth.sessionToken);

    if (result.error) {
      return result.error;
    }

    setAuth((current) => ({
      ...current,
      ...(result.user && result.token ? authStateForSession(result.user, result.token, false) : {}),
      rememberPassword: false
    }));
    return undefined;
  }

  if (!state.subject) {
    return (
      <main className="min-h-screen bg-background">
        <FloatingEmojiBackground />
        <EmojiSweepOverlay items={emojiSweepItems} />
        <AchievementToast achievement={activeAchievementToast} />
        <PomodoroStatus active={isPomodoroActive} settings={settings} startedAt={pomodoroCycleStartedAt} />
        <TopNav
          user={currentUser}
          onHome={() => {
            setAdminControlOpen(false);
            setState({ answers: {}, submitted: false });
          }}
          onAdmin={() => {
            if (requireLogin()) {
              return;
            }
            setAdminControlOpen(true);
            setState({ answers: {}, submitted: false });
          }}
          onSettings={() => {
            if (requireLogin()) {
              return;
            }
            setSettingsOpen(true);
          }}
          onAuth={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
          onLogout={logoutUser}
        />
        <AuthDialog
          open={authOpen}
          mode={authMode}
          auth={auth}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onLogin={loginUser}
          onRegister={registerUser}
        />
        <SettingsDialog
          open={settingsOpen}
          settings={settings}
          user={currentUser}
          auth={auth}
          onClose={() => setSettingsOpen(false)}
          onChange={setSettings}
          onChangePassword={changeCurrentPassword}
        />
        <PomodoroBreakDialog
          open={isPomodoroActive && pomodoroBreakOpen}
          breakMinutes={settings.pomodoroBreakMinutes}
          onClose={() => {
            setPomodoroBreakOpen(false);
            setPomodoroCycleStartedAt(Date.now());
          }}
        />
        {modeConfigSubject && (
          <SurvivalConfigDialog
            open={survivalConfigOpen}
            subject={modeConfigSubject}
            onClose={() => setSurvivalConfigOpen(false)}
            onStart={(config) => startSurvivalMode(modeConfigSubject, config)}
          />
        )}
        {modeConfigSubject && (
          <MatchingConfigDialog
            open={matchingConfigOpen}
            subject={modeConfigSubject}
            onClose={() => setMatchingConfigOpen(false)}
            onStart={(count) => startMatchingMode(modeConfigSubject, count)}
          />
        )}
        <AchievementsButton
          completed={completedAchievementCount}
          total={achievements.length}
          onClick={() => setAchievementsOpen(true)}
        />
        <AchievementsDialog
          achievements={achievements}
          open={achievementsOpen}
          onClose={() => setAchievementsOpen(false)}
        />
        <div className="container relative z-10 max-w-6xl px-3 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-6" onClick={() => menuOpen && setMenuOpen(false)}>
          <AccountFrame
            user={displayUser}
            media={displayProfileMedia}
            profile={profileProgress}
            onMediaChange={(media) =>
              setProfileMedia((current) => ({
                ...current,
                [displayUser.name]: {
                  ...current[displayUser.name],
                  ...media
                }
              }))
            }
          />
          {adminControlOpen && isAdmin ? (
            <AdminControlPanel auth={auth} saved={saved} subjects={subjects} questionStats={questionStats} />
          ) : (
            <>
          <WelcomeBanner user={currentUser} hasProgress={progressItems.length > 0} />
          <ProgressPanel
            items={progressItems}
            subjects={subjects}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            onOpen={openProgress}
            onMove={moveProgress}
            onLongPress={setItemActionId}
            onDeleteAll={() => setDeleteAllOpen(true)}
          />
          <RecentResults
            results={saved.results ?? []}
            subjects={subjects}
            onDeleteAll={() => setDeleteResultsOpen(true)}
            onLongPress={setResultActionId}
          />
          {subjects.map((subject) => {
            const subjectStarredCount = getStarredQuestions(subject, saved.starredQuestionIds ?? []).length;
            const subjectQuestionCount = getAllQuestions(subject).length;

            return (
              <Card key={subject.id} className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3">
                    <span>{subject.title}</span>
                    <span className="text-2xl leading-none" aria-hidden>
                      {getSubjectEmoji(subject.id)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{subject.chapters.length} chương</Badge>
                    <Badge variant="outline">{subjectQuestionCount} câu</Badge>
                  </div>
                  <div className="mt-5 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <ModeCard
                      title="Thi thử"
                      badge="40 câu"
                      icon="🧪"
                      onClick={() => startExamMode(subject)}
                    />
                    <ModeCard
                      title="Trộn tất cả"
                      badge={`${subjectQuestionCount} câu`}
                      icon="🔀"
                      onClick={() => startAllRandomMode(subject)}
                    />
                    <ModeCard
                      title="Chế độ học"
                      badge={`${subject.chapters.length} chương`}
                      icon="📚"
                      onClick={() => {
                        if (requireLogin()) {
                          return;
                        }
                        setState({ subject, answers: {}, submitted: false });
                      }}
                    />
                    <ModeCard
                      title="Luyện tập"
                      badge={`${subjectStarredCount} câu`}
                      disabled={subjectStarredCount === 0}
                      icon="⭐"
                      onClick={() => startPracticeMode(subject)}
                    />
                    <ModeCard
                      title="Sinh tồn"
                      badge="1/3 mạng + khiêng"
                      icon="🛡️"
                      onClick={() => {
                        if (requireLogin()) {
                          return;
                        }
                        setModeConfigSubject(subject);
                        setSurvivalConfigOpen(true);
                      }}
                    />
                    <ModeCard
                      title="Nối câu hỏi"
                      badge="8 câu/round"
                      icon="🧩"
                      onClick={() => {
                        if (requireLogin()) {
                          return;
                        }
                        setModeConfigSubject(subject);
                        setMatchingConfigOpen(true);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
            </>
          )}
        </div>
        <ProgressDialogs
          deleteAllOpen={deleteAllOpen}
          setDeleteAllOpen={setDeleteAllOpen}
          onDeleteAll={resetAllProgress}
          actionItem={itemActionId ? saved.items[itemActionId] : undefined}
          subjects={subjects}
          onCloseAction={() => setItemActionId(null)}
          onDeleteItem={deleteProgress}
          onPinItem={pinProgress}
          onUnpinItem={unpinProgress}
          pinnedCount={Object.values(saved.items).filter((item) => item.pinnedAt).length}
        />
        <ResultDialogs
          deleteAllOpen={deleteResultsOpen}
          setDeleteAllOpen={setDeleteResultsOpen}
          onDeleteAll={resetAllResults}
          actionItem={resultActionId ? (saved.results ?? []).find((result) => result.id === resultActionId) : undefined}
          onCloseAction={() => setResultActionId(null)}
          onDeleteItem={deleteResult}
          onPinItem={pinResult}
          onUnpinItem={unpinResult}
          pinnedCount={(saved.results ?? []).filter((result) => result.pinnedAt).length}
        />
      </main>
    );
  }

  if (!state.chapter) {
    return (
      <main className="min-h-screen bg-background">
        <FloatingEmojiBackground />
        <EmojiSweepOverlay items={emojiSweepItems} />
        <AchievementToast achievement={activeAchievementToast} />
        <PomodoroStatus active={isPomodoroActive} settings={settings} startedAt={pomodoroCycleStartedAt} />
        <TopNav
          user={currentUser}
          onHome={() => {
            setAdminControlOpen(false);
            setState({ answers: {}, submitted: false });
          }}
          onAdmin={() => {
            if (requireLogin()) {
              return;
            }
            setAdminControlOpen(true);
            setState({ answers: {}, submitted: false });
          }}
          onSettings={() => {
            if (requireLogin()) {
              return;
            }
            setSettingsOpen(true);
          }}
          onAuth={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
          onLogout={logoutUser}
        />
        <AuthDialog
          open={authOpen}
          mode={authMode}
          auth={auth}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onLogin={loginUser}
          onRegister={registerUser}
        />
        <SettingsDialog
          open={settingsOpen}
          settings={settings}
          user={currentUser}
          auth={auth}
          onClose={() => setSettingsOpen(false)}
          onChange={setSettings}
          onChangePassword={changeCurrentPassword}
        />
        <PomodoroBreakDialog
          open={isPomodoroActive && pomodoroBreakOpen}
          breakMinutes={settings.pomodoroBreakMinutes}
          onClose={() => {
            setPomodoroBreakOpen(false);
            setPomodoroCycleStartedAt(Date.now());
          }}
        />
        <div className="container relative z-10 px-3 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-6">
          <Header
            title={state.subject.title}
            action={
              <Button variant="outline" size="sm" onClick={() => setState({ answers: {}, submitted: false })}>
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Trang chính
              </Button>
            }
          />
          <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
            {state.subject.chapters.map((chapter) => {
              const id = progressId(state.subject!.id, chapter.id);
              const item = saved.items[id];
              const chapterAnswers = item
                ? chapter.questions.filter((question) => Boolean(item.answers[question.id])).length
                : 0;
              const parts = splitChapter(chapter);
              return (
                <Card key={chapter.id} className="motion-safe-card transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">{chapter.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{chapter.questions.length} câu hỏi trắc nghiệm</p>
                    {chapterAnswers > 0 && (
                      <Badge className="mt-3" variant="outline">
                        Đã lưu {chapterAnswers}/{chapter.questions.length}
                      </Badge>
                    )}
                    <Button
                      className="mt-5 w-full"
                      onClick={() => {
                        if (requireLogin()) {
                          return;
                        }
                        setState({
                          subject: state.subject,
                          chapter,
                          answers: item?.answers ?? {},
                          submitted: item?.submitted ?? false
                        });
                      }}
                    >
                      Làm cả chương
                    </Button>
                    <Button className="mt-3 w-full" variant="secondary" onClick={() => startShuffledChapter(state.subject!, chapter)}>
                      <Shuffle className="mr-2 size-4" aria-hidden />
                      Xáo trộn chương
                    </Button>
                    <div className="mt-5 border-t-2 border-foreground pt-4">
                      <p className="text-sm font-medium">Tùy chọn 15 câu</p>
                      <div className="mt-3 grid gap-2">
                        {parts.map((part) => {
                          const partId = progressId(state.subject!.id, part.id);
                          const partItem = saved.items[partId];
                          const partAnswers = partItem
                            ? part.questions.filter((question) => Boolean(partItem.answers[question.id])).length
                            : 0;

                          return (
                            <Button
                              key={part.id}
                              variant="outline"
                              className="h-auto justify-between gap-3 px-3 py-2"
                              onClick={() => {
                                if (requireLogin()) {
                                  return;
                                }
                                setState({
                                  subject: state.subject,
                                  chapter: part,
                                  answers: partItem?.answers ?? {},
                                  submitted: partItem?.submitted ?? false
                                });
                              }}
                            >
                              <span className="text-left">
                                {part.title.replace(`${chapter.title} - `, "")}
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {part.rangeLabel} · {part.questions.length} câu
                                </span>
                              </span>
                              {partAnswers > 0 && (
                                <Badge variant="secondary">
                                  {partAnswers}/{part.questions.length}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <FloatingEmojiBackground />
      <EmojiSweepOverlay items={emojiSweepItems} />
      <AchievementToast achievement={activeAchievementToast} />
      <PomodoroStatus active={isPomodoroActive} settings={settings} startedAt={pomodoroCycleStartedAt} />
      <TopNav
        user={currentUser}
        onHome={() => {
          setAdminControlOpen(false);
          setState({ answers: {}, submitted: false });
        }}
        onAdmin={() => {
          if (requireLogin()) {
            return;
          }
          setAdminControlOpen(true);
          setState({ answers: {}, submitted: false });
        }}
        onSettings={() => {
          if (requireLogin()) {
            return;
          }
          setSettingsOpen(true);
        }}
        onAuth={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
        onLogout={logoutUser}
      />
      <AuthDialog
        open={authOpen}
        mode={authMode}
        auth={auth}
        onModeChange={setAuthMode}
        onClose={() => setAuthOpen(false)}
        onLogin={loginUser}
        onRegister={registerUser}
      />
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        user={currentUser}
        auth={auth}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
        onChangePassword={changeCurrentPassword}
      />
      <PomodoroBreakDialog
        open={isPomodoroActive && pomodoroBreakOpen}
        breakMinutes={settings.pomodoroBreakMinutes}
        onClose={() => {
          setPomodoroBreakOpen(false);
          setPomodoroCycleStartedAt(Date.now());
        }}
      />
      <div className="container relative z-10 max-w-5xl px-3 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-6">
        <Header
          title={state.subject.title}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState((current) => ({ ...current, chapter: undefined, submitted: false }))}
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Chương
              </Button>
              <Button variant="outline" size="sm" onClick={() => setState({ answers: {}, submitted: false })}>
                Trang chính
              </Button>
            </div>
          }
        />

        {isMatchingMode ? (
          <MatchingModeView
            chapter={state.chapter}
            submitted={state.submitted}
            onExit={() => setState({ subject: state.subject, answers: {}, submitted: false })}
            onFinish={finishMatchingMode}
          />
        ) : (
          <>
        <div className="sticky top-0 z-10 mt-4 rounded-lg border-2 border-foreground bg-card p-3 shadow-[5px_5px_0_0_hsl(var(--foreground))] motion-pulse-border sm:mt-6 sm:p-4 sm:shadow-[6px_6px_0_0_hsl(var(--foreground))]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="secondary">{state.chapter.title}</Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Đã làm {answeredCount}/{state.chapter.questions.length} câu
              </p>
              {state.survival && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={state.survival.livesLeft > 0 ? "secondary" : "destructive"}>
                    {state.survival.livesLeft}/{state.survival.livesTotal} mạng
                  </Badge>
                  <Badge variant={state.survival.shieldAvailable ? "outline" : "secondary"}>
                    Khiêng: {state.survival.shieldEnabled ? (state.survival.shieldAvailable ? "còn 1 lần" : "đã dùng") : "tắt"}
                  </Badge>
                </div>
              )}
            </div>
            {state.submitted && (
              <div className="text-right">
                <p className="text-2xl font-semibold">
                  {score}/{state.chapter.questions.length}
                </p>
                <p className="text-sm text-muted-foreground">
                  Độ chính xác {Math.round((score / state.chapter.questions.length) * 100)}%
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${Math.round((answeredCount / state.chapter.questions.length) * 100)}%` }}
            />
          </div>
        </div>

        {state.submitted && (
          <Card className="result-report mt-6 overflow-hidden border-4 border-foreground bg-card shadow-[10px_10px_0_0_hsl(var(--foreground))]">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span>Bảng kết quả</span>
                <Badge variant="secondary" className="result-mood-chip">
                  {resultMood.emoji} {resultMood.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="result-stamp" aria-hidden>
                <span className="result-stamp-emoji">{resultMood.emoji}</span>
                <span className="result-stamp-label">{resultMood.label}</span>
              </div>
              <div className="relative z-10 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border-2 border-foreground bg-secondary p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                  <p className="text-sm font-black text-muted-foreground">Tỷ lệ đúng</p>
                  <p className={cn("result-percent-effect mt-2 text-5xl font-black", resultPercentEffect)}>{scorePercent}%</p>
                </div>
                <div className="rounded-md border-2 border-foreground bg-muted p-4">
                  <p className="text-sm font-black text-muted-foreground">Số câu đúng</p>
                  <p className="mt-2 text-4xl font-black">
                    {score}/{state.chapter.questions.length}
                  </p>
                </div>
                <div className="relative rounded-md border-2 border-foreground bg-accent/90 p-4">
                  <p className="text-sm font-black text-muted-foreground">Xếp loại</p>
                  <p className="mt-2 text-2xl font-black">{resultMood.label}</p>
                </div>
              </div>
              <p className="result-quote relative z-10 mt-4">
                {resultQuote}
              </p>
              {resultCelebration && (
                <p className={cn("result-celebration relative z-10 mt-4", scorePercent === 100 && "result-celebration-perfect")}>
                  {resultCelebration}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 space-y-4">
          {state.chapter.questions.map((question, questionIndex) => {
            const selectedOptionId = state.answers[question.id];
            const hasMemoryTip = Boolean(memoryTips[question.id]);
            const canOpenMemoryTip = hasMemoryTip && (state.submitted || !isExamMode);

            return (
              <Card key={question.id} className="motion-safe-card">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-7 sm:text-lg">
                      Câu {questionIndex + 1}: {question.prompt}
                    </CardTitle>
                    <div className="flex shrink-0 gap-1">
                      {canOpenMemoryTip && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => openMemoryTip(question.id)}
                          aria-label="Xem cách ghi nhớ"
                        >
                          <CircleHelp className="size-5 text-primary" aria-hidden />
                        </Button>
                      )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleStar(question.id)}
                      aria-label="Đánh dấu câu khó nhớ"
                    >
                      <Star
                        className={cn(
                          "size-5",
                          (saved.starredQuestionIds ?? []).includes(question.id) && "fill-secondary text-secondary"
                        )}
                        aria-hidden
                      />
                    </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {question.options.map((option) => {
                      const isSelected = selectedOptionId === option.id;
                      const revealAnsweredQuestion = state.submitted || Boolean(state.survival && selectedOptionId);
                      const revealCorrect = revealAnsweredQuestion && option.correct;
                      const revealWrong = revealAnsweredQuestion && isSelected && !option.correct;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={state.submitted || Boolean(state.survival && selectedOptionId)}
                          onClick={() => answerQuestion(question, option.id)}
                          className={cn(
                            "flex min-h-14 items-start gap-3 rounded-md border-2 border-foreground bg-card p-3 text-left transition-colors duration-200 sm:items-center",
                            "hover:border-primary disabled:cursor-default",
                            isSelected && !state.submitted && "bg-primary shadow-[4px_4px_0_0_hsl(var(--foreground))]",
                            revealCorrect && "bg-secondary",
                            revealWrong && "bg-destructive"
                          )}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted font-semibold">
                            {option.label}
                          </span>
                          <span className="min-w-0 flex-1 text-sm leading-6">{option.text}</span>
                          {revealCorrect && <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />}
                          {revealWrong && <XCircle className="size-5 shrink-0 text-destructive" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6">
          <CardContent className="flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div>
              <p className="font-medium">Hoàn tất bài làm</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {allAnswered
                  ? "Bạn đã trả lời đủ câu, có thể nộp bài."
                  : `Bạn còn ${state.chapter.questions.length - answeredCount} câu chưa trả lời. Các câu trống sẽ tính là sai.`}
              </p>
            </div>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Button variant="outline" onClick={() => setState({ answers: {}, submitted: false })}>
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Quay lại chế độ
              </Button>
              {state.submitted && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      answers: {},
                      submitted: false
                    }))
                  }
                >
                  <RotateCcw className="mr-2 size-4" aria-hidden />
                  Làm lại
                </Button>
              )}
              {!state.submitted && (
                <Button
                  onClick={() => {
                    if (allAnswered) {
                      submitCurrentQuiz();
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  Nộp bài
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {!isMatchingMode && confirmOpen && (
        <ConfirmDialog
          title="Bạn chưa hoàn thành bài"
          body={`Bạn còn ${state.chapter.questions.length - answeredCount} câu chưa trả lời. Nếu nộp bây giờ, các câu trống sẽ được tính là sai.`}
          cancelLabel="Làm tiếp"
          confirmLabel="Vẫn nộp bài"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            submitCurrentQuiz();
          }}
        />
      )}
      {pendingMemoryTip && (
        <ConfirmDialog
          title="Xem cách ghi nhớ?"
          body="Tip có thể gợi ý đáp án đúng. Bạn có chắc muốn xem khi đang làm bài không?"
          cancelLabel="Chưa xem"
          confirmLabel="Xem tip"
          onCancel={() => setPendingMemoryTipId(null)}
          onConfirm={() => {
            setMemoryTipId(pendingMemoryTipId);
            setPendingMemoryTipId(null);
          }}
        />
      )}
      {activeMemoryTip && (
        <MemoryTipDialog tip={activeMemoryTip} onClose={() => setMemoryTipId(null)} />
      )}
      <ResultSubmitPopup result={submitPopupResult} onClose={() => setSubmitPopupResult(null)} />
    </main>
  );
}

function ResultSubmitPopup({ result, onClose }: { result: ResultItem | null; onClose: () => void }) {
  if (!result) {
    return null;
  }

  const percent = getResultPercentValue(result);
  const mood = getResultMood(percent);
  const quote = getResultQuote(percent, result.id);
  const celebration = getResultCelebration(percent);
  const percentEffect = getResultPercentEffect(percent);

  return (
    <div className="result-submit-overlay fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="result-submit-popup relative w-full max-w-xl overflow-hidden rounded-[24px] border-4 border-foreground bg-card p-4 text-card-foreground shadow-[10px_10px_0_0_hsl(var(--foreground))] sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Kết quả vừa nộp"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))]"
          onClick={onClose}
          aria-label="Đóng kết quả"
        >
          <XCircle className="size-5" aria-hidden />
        </button>

        <div className="result-submit-stamp" aria-hidden>
          <span className="result-stamp-emoji">{mood.emoji}</span>
          <span className="result-stamp-label">{mood.label}</span>
        </div>

        <div className="result-submit-heading relative z-10">
          <p className="text-xs font-black uppercase text-muted-foreground">Vừa nộp bài</p>
          <h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight">{result.chapterTitle}</h2>
        </div>

        <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border-2 border-foreground bg-secondary p-3 shadow-[4px_4px_0_0_hsl(var(--foreground))]">
            <p className="text-xs font-black text-muted-foreground">Tỷ lệ đúng</p>
            <p className={cn("result-percent-effect mt-1 text-4xl font-black", percentEffect)}>{percent}%</p>
          </div>
          <div className="rounded-md border-2 border-foreground bg-muted p-3">
            <p className="text-xs font-black text-muted-foreground">Số câu đúng</p>
            <p className="mt-1 text-3xl font-black">{result.score}/{result.total}</p>
          </div>
          <div className="rounded-md border-2 border-foreground bg-accent/90 p-3">
            <p className="text-xs font-black text-muted-foreground">Xếp loại</p>
            <p className="mt-1 text-xl font-black">{mood.label}</p>
          </div>
        </div>

        <p className="result-quote relative z-10 mt-4">{quote}</p>
        {celebration && (
          <p className={cn("result-celebration relative z-10 mt-4", percent === 100 && "result-celebration-perfect")}>
            {celebration}
          </p>
        )}
        <div className="relative z-10 mt-5 flex justify-end">
          <Button type="button" onClick={onClose}>
            Xem bài đã chấm
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProgressPanel({
  items,
  subjects,
  menuOpen,
  setMenuOpen,
  onOpen,
  onMove,
  onLongPress,
  onDeleteAll
}: {
  items: ProgressItem[];
  subjects: QuizSubject[];
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onOpen: (item: ProgressItem) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onLongPress: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress(id: string) {
    timerRef.current = setTimeout(() => onLongPress(id), 550);
  }

  function stopLongPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <Card className="mt-6 motion-safe-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Tiến trình</span>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              aria-label="Mở menu tiến trình"
            >
              <MoreVertical className="size-5" aria-hidden />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-11 z-20 w-44 rounded-md border-2 border-foreground bg-card p-1 shadow-[5px_5px_0_0_hsl(var(--foreground))]" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={onDeleteAll}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tiến trình chưa hoàn thành.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const subject = getSubject(subjects, item.subjectId);
              const chapter = getChapter(subject, item.chapterId, item.questionOrder, item.optionOrders);
              if (!subject || !chapter) {
                return null;
              }
              const answered = chapter.questions.filter((question) => Boolean(item.answers[question.id])).length;

              return (
                <div
                  key={item.id}
                  className="motion-safe-card flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-foreground bg-card p-3 transition-colors duration-200 hover:bg-muted"
                  onPointerDown={() => startLongPress(item.id)}
                  onPointerUp={stopLongPress}
                  onPointerLeave={stopLongPress}
                  onPointerCancel={stopLongPress}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{subject.title}</p>
                      {item.pinnedAt && <Badge variant="secondary">Ghim</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {chapter.title} · đã làm {answered}/{chapter.questions.length}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={index === 0} onClick={() => onMove(item.id, -1)}>
                      Lên
                    </Button>
                    <Button size="sm" variant="outline" disabled={index === items.length - 1} onClick={() => onMove(item.id, 1)}>
                      Xuống
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmojiSweepOverlay({ items }: { items: EmojiSweepItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="emoji-sweep-overlay" aria-hidden>
      {items.map((item) => (
        <span
          key={item.id}
          className={cn("emoji-sweep-item", item.direction === "right" ? "emoji-sweep-right" : "emoji-sweep-left")}
          style={{
            animationDelay: `${item.delay}ms`,
            animationDuration: `${item.duration}ms`,
            fontSize: `${item.size}rem`,
            top: `${item.top}%`
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

function getTimeGreeting(hour: number) {
  if (hour >= 5 && hour < 11) {
    return "Chào buổi sáng";
  }

  if (hour >= 11 && hour < 14) {
    return "Chào buổi trưa";
  }

  if (hour >= 14 && hour < 18) {
    return "Chào buổi chiều";
  }

  return "Chào buổi tối";
}

function WelcomeBanner({ hasProgress, user }: { hasProgress: boolean; user?: AuthSession }) {
  const [hour, setHour] = useState<number | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const welcomeQuotes = useMemo(
    () => Array.from(new Set(WELCOME_QUOTE_PERCENT_BUCKETS.flatMap((percent) => getResultQuotes(percent)))),
    []
  );

  useEffect(() => {
    setHour(new Date().getHours());
    setQuoteIndex(Math.floor(Math.random() * welcomeQuotes.length));
  }, [user?.name, welcomeQuotes.length]);

  const greeting = getTimeGreeting(hour ?? 8);
  const name = user?.name ?? "bạn";
  const prompt = hasProgress
    ? "Bạn đã sẵn sàng hoàn thành tiếp phần đang dở chưa?"
    : "Bạn đã sẵn sàng bắt đầu một phần ôn mới chưa?";

  return (
    <section className="welcome-banner motion-rise mb-6 overflow-hidden rounded-[24px] border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_0_hsl(var(--foreground))]">
      <div className="relative z-10 grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-muted-foreground">Quiz ôn tập</p>
          <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
            {greeting}, {name}!
          </h2>
          <p className="mt-3 text-base font-black text-muted-foreground">{prompt}</p>
        </div>
        <blockquote className="rounded-2xl border-2 border-foreground bg-secondary/90 p-4 text-sm font-black leading-6 shadow-[5px_5px_0_0_hsl(var(--foreground))]">
          “{welcomeQuotes[quoteIndex]}”
        </blockquote>
      </div>
    </section>
  );
}

function AchievementsButton({
  completed,
  onClick,
  total
}: {
  completed: number;
  onClick: () => void;
  total: number;
}) {
  return (
    <button
      type="button"
      className="fixed bottom-4 left-4 z-50 flex h-11 items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 text-sm font-black shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-colors hover:bg-secondary sm:bottom-auto sm:left-auto sm:right-20 sm:top-5 sm:h-12 sm:px-4"
      onClick={onClick}
      aria-label="Mở thành tựu"
    >
      <Trophy className="size-5 stroke-[3] text-primary" aria-hidden />
      <span className="hidden sm:inline">Thành tựu</span>
      <Badge variant="secondary">{completed}/{total}</Badge>
    </button>
  );
}

function AchievementToast({ achievement }: { achievement: Achievement | null }) {
  if (!achievement) {
    return null;
  }

  return (
    <div className="achievement-toast-wrap" aria-live="polite" aria-atomic="true">
      <div className="achievement-party" aria-hidden>
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} style={{ "--piece": index } as CSSProperties} />
        ))}
      </div>
      <div className="achievement-toast">
        <div className="achievement-toast-icon">
          <Trophy className="size-8 stroke-[3]" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-muted-foreground">Thành tựu mới</p>
          <h3 className="mt-1 truncate text-xl font-black leading-tight">{achievement.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-muted-foreground">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

function AchievementsDialog({
  achievements,
  onClose,
  open
}: {
  achievements: Achievement[];
  onClose: () => void;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  const completed = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[22px] border-2 border-foreground bg-card p-4 shadow-[8px_8px_0_0_hsl(var(--foreground))] sm:rounded-[28px] sm:p-5 sm:shadow-[12px_12px_0_0_hsl(var(--foreground))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-muted-foreground">Quiz ôn tập</p>
            <h2 className="mt-1 text-3xl font-black">Thành tựu</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">{completed}/{achievements.length} hoàn thành</Badge>
            <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Đóng thành tựu">
              <XCircle className="size-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid max-h-[62vh] gap-3 overflow-y-auto pr-1 sm:mt-5 sm:max-h-[68vh] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {achievements.map((achievement, index) => (
            <div
              key={achievement.id}
              className={cn(
                "min-h-40 rounded-2xl border-2 border-foreground p-4 shadow-[4px_4px_0_0_hsl(var(--foreground))]",
                achievement.unlocked ? "bg-secondary" : "bg-muted opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-card", achievement.unlocked && "bg-accent")}>
                  {achievement.unlocked ? <Trophy className="size-6 stroke-[3]" aria-hidden /> : <Star className="size-6 stroke-[3]" aria-hidden />}
                </span>
                <Badge variant={achievement.unlocked ? "secondary" : "outline"}>#{index + 1}</Badge>
              </div>
              <h3 className="mt-4 text-base font-black leading-6">{achievement.title}</h3>
              <p className="mt-2 text-sm font-bold leading-5 text-muted-foreground">{achievement.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentResults({
  results,
  subjects,
  onDeleteAll,
  onLongPress
}: {
  results: ResultItem[];
  subjects: QuizSubject[];
  onDeleteAll: () => void;
  onLongPress: (id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortedResults = [...results].sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) {
      return b.pinnedAt - a.pinnedAt;
    }
    if (a.pinnedAt) {
      return -1;
    }
    if (b.pinnedAt) {
      return 1;
    }
    return b.submittedAt - a.submittedAt;
  });
  const [animationRun, setAnimationRun] = useState(() => Date.now());

  useEffect(() => {
    setAnimationRun(Date.now());
  }, [results.length, sortedResults[0]?.id]);

  function startLongPress(id: string) {
    timerRef.current = setTimeout(() => onLongPress(id), 550);
  }

  function stopLongPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <Card className="mt-6 max-w-full overflow-hidden motion-safe-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 pr-2">
          <span>Kết quả gần đây</span>
          <Button size="sm" variant="destructive" disabled={results.length === 0} onClick={onDeleteAll}>
            <Trash2 className="mr-2 size-4" aria-hidden />
            Xóa tất cả
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <div className="rounded-[18px] border-2 border-dashed border-foreground bg-muted p-8 text-center">
            <p className="font-black">Chưa có kết quả nào.</p>
            <p className="mt-2 text-sm text-muted-foreground">Sau khi nộp bài, kết quả sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto pb-8">
            <div className="flex w-max items-center gap-4 px-1">
              {sortedResults.map((result, index) => {
                const subject = getSubject(subjects, result.subjectId);
                const percent = Math.round((result.score / result.total) * 100);
                const mood = getResultMood(percent);
                const quote = getResultQuote(percent, result.id);
                const celebration = getResultCelebration(percent);
                const percentEffect = getResultPercentEffect(percent);
                const isLatest = index === 0;

                return (
                  <div
                    key={`${result.id}-${animationRun}`}
                    className={cn(
                      "result-card motion-safe-card shrink-0 rounded-[22px] border-2 border-foreground bg-secondary shadow-[6px_6px_0_0_hsl(var(--foreground))] transition-colors duration-200 hover:bg-secondary/90",
                      isLatest && "result-card-latest"
                    )}
                    onPointerDown={() => startLongPress(result.id)}
                    onPointerUp={stopLongPress}
                    onPointerLeave={stopLongPress}
                    onPointerCancel={stopLongPress}
                  >
                    <div className="result-card-pattern" aria-hidden>
                      {Array.from({ length: isLatest ? 24 : 18 }).map((_, emojiIndex) => (
                        <span key={emojiIndex}>{mood.emoji}</span>
                      ))}
                    </div>
                    <div className={cn("result-mini-stamp", isLatest && "result-mini-stamp-latest")} aria-hidden>
                      {mood.emoji}
                    </div>
                    <div className="result-card-header relative z-10 flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-muted-foreground">{subject?.title ?? "Quiz"}</p>
                      {result.pinnedAt && <Badge variant="outline">Ghim</Badge>}
                    </div>
                    <h3 className={cn("result-card-title relative z-10 line-clamp-2 font-black", isLatest ? "text-xl" : "text-lg")}>{result.chapterTitle}</h3>
                    <p className={cn("result-percent-effect result-card-percent relative z-10 font-black", percentEffect, isLatest ? "text-6xl" : "text-5xl")}>{percent}%</p>
                    <div className="result-card-badges relative z-10 flex flex-wrap gap-2">
                      <p className="rounded-full border-2 border-foreground bg-card px-3 py-1 text-sm font-black">
                        {result.score}/{result.total} câu đúng
                      </p>
                      <p className="result-mood-chip">
                        {mood.emoji} {mood.label}
                      </p>
                    </div>
                    <p className="result-quote result-quote-card relative z-10 line-clamp-2">
                      {quote}
                    </p>
                    {celebration && (
                      <p className={cn("result-celebration result-celebration-card relative z-10", percent === 100 && "result-celebration-perfect")}>
                        {celebration}
                      </p>
                    )}
                    <p className="result-card-time relative z-10 text-xs font-black text-muted-foreground">
                      {new Date(result.submittedAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModeCard({
  title,
  badge,
  icon,
  onClick,
  disabled = false
}: {
  title: string;
  badge: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className={cn("motion-safe-card flex h-full min-h-36 flex-col transition-colors hover:border-primary sm:min-h-44", disabled && "opacity-60")}>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-start justify-between gap-3 text-lg sm:text-xl">
          <span>{title}</span>
          <span className="text-2xl leading-none" aria-hidden>
            {icon}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4 sm:gap-5">
        <Badge className="w-fit" variant="outline">
          {badge}
        </Badge>
        <Button className="w-full" onClick={onClick} disabled={disabled}>
          {disabled ? "Chưa có câu" : "Bắt đầu"}
          <ChevronRight className="ml-2 size-4" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

function SurvivalConfigDialog({
  onClose,
  onStart,
  open,
  subject
}: {
  onClose: () => void;
  onStart: (config: SurvivalConfig) => void;
  open: boolean;
  subject: QuizSubject;
}) {
  const playableChapters = subject.chapters;
  const [config, setConfig] = useState<SurvivalConfig>({
    lives: 3,
    shieldEnabled: true,
    count: 40,
    scope: "all",
    chapterId: playableChapters[0]?.id ?? subject.chapters[0]?.id ?? ""
  });

  useEffect(() => {
    setConfig({
      lives: 3,
      shieldEnabled: true,
      count: 40,
      scope: "all",
      chapterId: subject.chapters[0]?.id ?? ""
    });
  }, [subject.id, subject.chapters]);

  const selectedChapter = subject.chapters.find((chapter) => chapter.id === config.chapterId);
  const selectedPool = config.scope === "chapter" && selectedChapter ? selectedChapter.questions.length : playableChapters.flatMap((chapter) => chapter.questions).length;
  const finalCount = config.scope === "chapter" && config.chapterId === "chuong-01"
    ? selectedPool
    : config.count === "full"
      ? selectedPool
      : Math.min(config.count, selectedPool);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border-2 border-foreground bg-card p-4 shadow-[8px_8px_0_0_hsl(var(--foreground))] sm:rounded-[28px] sm:p-5 sm:shadow-[12px_12px_0_0_hsl(var(--foreground))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-muted-foreground">{subject.title}</p>
            <h2 className="mt-1 text-2xl font-black">Mode sinh tồn</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Đóng sinh tồn">
            <XCircle className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-xl border-2 border-foreground bg-background/70 p-4">
            <p className="text-sm font-black text-muted-foreground">Số mạng</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[1, 3].map((lives) => (
                <button
                  key={lives}
                  type="button"
                  className={cn("settings-choice min-h-0", config.lives === lives && "settings-choice-active")}
                  onClick={() => setConfig((current) => ({ ...current, lives: lives as 1 | 3 }))}
                >
                  <span className="text-3xl">{lives === 1 ? "1" : "3"}</span>
                  <span>
                    <span className="block text-lg font-black">{lives} mạng</span>
                    <span className="block text-sm text-muted-foreground">{lives === 1 ? "Sai là hết bài." : "Sai tối đa 3 lần."}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-foreground bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black text-muted-foreground">Phạm vi câu hỏi</p>
              <Badge variant="outline">{finalCount} câu</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={cn("settings-choice min-h-0", config.scope === "all" && "settings-choice-active")}
                onClick={() => setConfig((current) => ({ ...current, scope: "all" }))}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-card text-xl">ALL</span>
                <span>
                  <span className="block text-lg font-black">Xáo trộn tất cả</span>
                  <span className="block text-sm text-muted-foreground">Lấy từ toàn bộ chương của môn này.</span>
                </span>
              </button>
              <button
                type="button"
                className={cn("settings-choice min-h-0", config.scope === "chapter" && "settings-choice-active")}
                onClick={() => setConfig((current) => ({ ...current, scope: "chapter" }))}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-card text-xl">CH</span>
                <span>
                  <span className="block text-lg font-black">Chọn chương</span>
                  <span className="block text-sm text-muted-foreground">Chương 1 tự lấy full.</span>
                </span>
              </button>
            </div>

            {config.scope === "chapter" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {playableChapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    className={cn("settings-time-pill", config.chapterId === chapter.id && "settings-time-pill-active")}
                    onClick={() => setConfig((current) => ({ ...current, chapterId: chapter.id }))}
                  >
                    {chapter.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-foreground bg-background/70 p-4">
            <p className="text-sm font-black text-muted-foreground">Số câu</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: 25 as const, label: "25 câu" },
                { value: 40 as const, label: "40 câu" },
                { value: "full" as const, label: "Full" }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={cn("settings-time-pill", config.count === item.value && "settings-time-pill-active")}
                  onClick={() => setConfig((current) => ({ ...current, count: item.value }))}
                  disabled={config.scope === "chapter" && config.chapterId === "chuong-01"}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {config.scope === "chapter" && config.chapterId === "chuong-01" && (
              <p className="mt-3 text-sm font-black text-muted-foreground">Chương 1 đang bật full theo yêu cầu.</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-foreground bg-background/70 p-4">
            <span>
              <span className="block text-lg font-black">Bật khiêng</span>
              <span className="block text-sm font-black text-muted-foreground">Khiêng bình thường bảo vệ 1 lần khi trả lời sai.</span>
            </span>
            <input
              className="size-6 accent-black"
              type="checkbox"
              checked={config.shieldEnabled}
              onChange={(event) => setConfig((current) => ({ ...current, shieldEnabled: event.target.checked }))}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => onStart(config)}>
            Bắt đầu sinh tồn
            <ChevronRight className="ml-2 size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchingConfigDialog({
  onClose,
  onStart,
  open,
  subject
}: {
  onClose: () => void;
  onStart: (count: MatchingCount) => void;
  open: boolean;
  subject: QuizSubject;
}) {
  const [count, setCount] = useState<MatchingCount>(40);
  const totalQuestions = getAllQuestions(subject).filter((question) => question.options.some((option) => option.correct)).length;
  const finalCount = count === "full" ? totalQuestions : Math.min(count, totalQuestions);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-[22px] border-2 border-foreground bg-card p-4 shadow-[8px_8px_0_0_hsl(var(--foreground))] sm:rounded-[28px] sm:p-5 sm:shadow-[12px_12px_0_0_hsl(var(--foreground))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-muted-foreground">{subject.title}</p>
            <h2 className="mt-1 text-2xl font-black">Mode nối câu hỏi</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Đóng nối câu hỏi">
            <XCircle className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-5 rounded-xl border-2 border-foreground bg-background/70 p-4">
          <p className="text-sm font-black text-muted-foreground">Số câu</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { value: 25 as const, label: "25 câu" },
              { value: 40 as const, label: "40 câu" },
              { value: "full" as const, label: "Làm hết" }
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn("settings-time-pill", count === item.value && "settings-time-pill-active")}
                onClick={() => setCount(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-black text-muted-foreground">
            Mỗi round có 8 câu. Câu hỏi và đáp án đúng đều được xáo trộn.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => onStart(count)}>
            Bắt đầu {finalCount} câu
            <ChevronRight className="ml-2 size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchingModeView({
  chapter,
  onExit,
  onFinish,
  submitted
}: {
  chapter: QuizChapter;
  onExit: () => void;
  onFinish: (score: number, total: number) => void;
  submitted: boolean;
}) {
  const pairs = useMemo(
    () =>
      chapter.questions
        .map((question) => {
          const tip = memoryTips[question.id];
          const correctAnswer = question.options.find((option) => option.correct)?.text ?? "";
          return {
            id: question.id,
            prompt: tip?.question ?? question.prompt,
            answer: tip?.answer ? tip.answer.replace(/^[A-D]\.\s*/i, "") : correctAnswer
          };
        })
        .filter((pair) => pair.answer),
    [chapter.questions]
  );
  const rounds = useMemo(() => {
    const chunks: Array<typeof pairs> = [];
    for (let index = 0; index < pairs.length; index += 8) {
      chunks.push(pairs.slice(index, index + 8));
    }
    return chunks;
  }, [pairs]);
  const answerRounds = useMemo(
    () => rounds.map((round) => shuffleArray(round.map((pair) => ({ id: pair.id, text: pair.answer })))),
    [rounds]
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [draggingAnswerId, setDraggingAnswerId] = useState<string | null>(null);
  const [confirmedOnce, setConfirmedOnce] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);
  const round = rounds[roundIndex] ?? [];
  const answers = answerRounds[roundIndex] ?? [];
  const correctCount = round.filter((pair) => matches[pair.id] === pair.id).length;
  const wrongCount = confirmedOnce ? round.length - correctCount : 0;
  const matchedCount = round.filter((pair) => Boolean(matches[pair.id])).length;
  const percent = pairs.length ? Math.round((score / pairs.length) * 100) : 0;

  useEffect(() => {
    setMatches({});
    setSelectedQuestionId(null);
    setSelectedAnswerId(null);
    setDraggingAnswerId(null);
    setConfirmedOnce(false);
  }, [roundIndex]);

  function connectPair(questionId: string, answerId: string) {
    setMatches((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id, value]) => id !== questionId && value !== answerId));
      return { ...next, [questionId]: answerId };
    });
    setSelectedQuestionId(null);
    setSelectedAnswerId(null);
    setDraggingAnswerId(null);
  }

  function clearPair(questionId: string) {
    setMatches((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setSelectedQuestionId(null);
    setSelectedAnswerId(null);
    setDraggingAnswerId(null);
    setConfirmedOnce(false);
  }

  function resetRoundMatches() {
    setMatches({});
    setSelectedQuestionId(null);
    setSelectedAnswerId(null);
    setDraggingAnswerId(null);
    setConfirmedOnce(false);
  }

  function finish(nextScore: number) {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    setScore(nextScore);
    setDone(true);
    onFinish(nextScore, pairs.length);
  }

  function advance(nextScore: number) {
    if (roundIndex >= rounds.length - 1) {
      finish(nextScore);
      return;
    }

    setScore(nextScore);
    setRoundIndex((current) => current + 1);
  }

  function confirmRound() {
    setConfirmedOnce(true);
    if (correctCount !== round.length) {
      return;
    }

    advance(score + round.length);
  }

  function skipRound() {
    advance(score + correctCount);
  }

  if (done || submitted) {
    const finalPercent = pairs.length ? Math.round((score / pairs.length) * 100) : percent;
    const mood = getResultMood(finalPercent);
    const celebration = getResultCelebration(finalPercent);

    return (
      <Card className="result-report mt-6 overflow-hidden border-4 border-foreground bg-card shadow-[10px_10px_0_0_hsl(var(--foreground))]">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Kết quả nối câu hỏi</span>
            <Badge variant="secondary" className="result-mood-chip">{mood.emoji} {mood.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border-2 border-foreground bg-secondary p-4">
              <p className="text-sm font-black text-muted-foreground">Tỷ lệ đúng</p>
              <p className={cn("result-percent-effect mt-2 text-5xl font-black", getResultPercentEffect(finalPercent))}>{finalPercent}%</p>
            </div>
            <div className="rounded-md border-2 border-foreground bg-muted p-4">
              <p className="text-sm font-black text-muted-foreground">Số cặp đúng</p>
              <p className="mt-2 text-4xl font-black">{score}/{pairs.length}</p>
            </div>
            <div className="rounded-md border-2 border-foreground bg-accent/90 p-4">
              <p className="text-sm font-black text-muted-foreground">Round</p>
              <p className="mt-2 text-4xl font-black">{rounds.length}</p>
            </div>
          </div>
          {celebration && <p className={cn("result-celebration mt-4", finalPercent === 100 && "result-celebration-perfect")}>{celebration}</p>}
          <Button className="mt-5" variant="outline" onClick={onExit}>Về chế độ</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="mt-6 space-y-5">
      <Card className="motion-safe-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>{chapter.title}</span>
            <Badge variant="secondary">Round {roundIndex + 1}/{rounds.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-5">
            <Badge variant="outline">Mỗi round 8 câu</Badge>
            <Badge variant="outline">{pairs.length} câu</Badge>
            <Badge variant="secondary">{correctCount} đúng</Badge>
            <Badge variant="outline">{matchedCount}/{round.length} đã nối</Badge>
            <Badge variant={wrongCount > 0 ? "destructive" : "outline"}>{wrongCount} sai</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelp className="size-5" aria-hidden />
            <span>Hướng dẫn chơi</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm font-bold leading-6 text-muted-foreground md:grid-cols-3">
          <p>Kéo đáp án từ cột phải sang ô trống, hoặc bấm câu hỏi rồi bấm đáp án để nối.</p>
          <p>Bấm vào ô đáp án đã nối ở giữa để gỡ nối và đưa đáp án về trạng thái chưa nối.</p>
          <p>Dùng Reset nối để làm lại round hiện tại, rồi bấm Xác nhận để kiểm tra kết quả.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Cột câu hỏi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {round.map((pair, index) => {
              const answerId = matches[pair.id];
              const matchedAnswer = answers.find((answer) => answer.id === answerId);
              const isSelected = selectedQuestionId === pair.id;
              const isCorrect = confirmedOnce && answerId === pair.id;
              const isWrong = confirmedOnce && Boolean(answerId) && answerId !== pair.id;
              const isEmptyWrong = confirmedOnce && !answerId;

              return (
                <div
                  key={pair.id}
                  className="grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_4rem_minmax(12rem,0.74fr)]"
                >
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-20 items-start gap-3 rounded-xl border-2 border-foreground bg-background p-3 text-left text-sm font-black leading-6 transition-colors",
                      isSelected && "bg-primary shadow-[4px_4px_0_0_hsl(var(--foreground))]",
                      isCorrect && "bg-secondary",
                      (isWrong || isEmptyWrong) && "bg-destructive/80"
                    )}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const droppedAnswerId = event.dataTransfer.getData("text/plain") || draggingAnswerId;
                      if (droppedAnswerId) {
                        connectPair(pair.id, droppedAnswerId);
                      }
                    }}
                    onClick={() => {
                      if (matchedAnswer) {
                        clearPair(pair.id);
                      } else if (selectedAnswerId) {
                        connectPair(pair.id, selectedAnswerId);
                      } else {
                        setSelectedQuestionId((current) => current === pair.id ? null : pair.id);
                      }
                    }}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-card text-lg font-black shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                      {index + 1}
                    </span>
                    <span className="block flex-1">{pair.prompt}</span>
                  </button>

                  <div className="hidden items-center justify-center md:flex">
                    <span
                      className={cn(
                        "h-1 w-full rounded-full border border-foreground/60 bg-muted transition-colors",
                        answerId && "bg-primary",
                        isCorrect && "bg-secondary",
                        (isWrong || isEmptyWrong) && "bg-destructive"
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    className={cn(
                      "min-h-20 rounded-xl border-2 border-dashed border-foreground bg-muted p-3 text-left text-sm font-black leading-6 transition-colors",
                      matchedAnswer && "border-solid bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))]",
                      isCorrect && "bg-secondary",
                      (isWrong || isEmptyWrong) && "bg-destructive/80"
                    )}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const droppedAnswerId = event.dataTransfer.getData("text/plain") || draggingAnswerId;
                      if (droppedAnswerId) {
                        connectPair(pair.id, droppedAnswerId);
                      }
                    }}
                    onClick={() => {
                      if (selectedAnswerId) {
                        connectPair(pair.id, selectedAnswerId);
                      } else {
                        setSelectedQuestionId((current) => current === pair.id ? null : pair.id);
                      }
                    }}
                  >
                    {matchedAnswer ? (
                      <span className="flex items-start gap-2">
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border-2 border-foreground bg-background text-sm font-black">
                          {answers.findIndex((answer) => answer.id === matchedAnswer.id) + 1}
                        </span>
                        <span>{matchedAnswer.text}</span>
                      </span>
                    ) : (
                      <span className="flex h-full min-h-14 items-center text-muted-foreground">Thả đáp án vào đây</span>
                    )}
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cột trả lời - kéo qua</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {answers.map((answer, index) => {
              const matchedQuestion = Object.entries(matches).find(([, answerId]) => answerId === answer.id)?.[0];
              const matchedQuestionIndex = round.findIndex((pair) => pair.id === matchedQuestion);
              const isSelected = selectedAnswerId === answer.id;
              const isCorrect = confirmedOnce && matchedQuestion === answer.id;
              const isWrong = confirmedOnce && Boolean(matchedQuestion) && matchedQuestion !== answer.id;

              return (
                <button
                  key={answer.id}
                  type="button"
                  draggable
                  className={cn(
                    "flex min-h-16 cursor-grab items-start gap-3 rounded-xl border-2 border-foreground bg-card p-3 text-left text-sm font-black leading-6 transition active:cursor-grabbing",
                    isSelected && "bg-primary shadow-[4px_4px_0_0_hsl(var(--foreground))]",
                    draggingAnswerId === answer.id && "scale-[0.98] bg-primary",
                    matchedQuestion && !confirmedOnce && "bg-accent/80",
                    isCorrect && "bg-secondary",
                    isWrong && "bg-destructive/80"
                  )}
                  aria-label={`Kéo đáp án ${index + 1}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", answer.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingAnswerId(answer.id);
                  }}
                  onDragEnd={() => setDraggingAnswerId(null)}
                  onClick={() => {
                    if (selectedQuestionId) {
                      connectPair(selectedQuestionId, answer.id);
                    } else if (matchedQuestion) {
                      if (selectedAnswerId === answer.id) {
                        clearPair(matchedQuestion);
                      } else {
                        setSelectedQuestionId(null);
                        setSelectedAnswerId(answer.id);
                      }
                    } else {
                      setSelectedAnswerId((current) => current === answer.id ? null : answer.id);
                    }
                  }}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-background text-lg font-black shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                    {index + 1}
                  </span>
                  <span className="block flex-1">
                    {answer.text}
                    {matchedQuestion && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Đang nối với câu {matchedQuestionIndex + 1}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardContent className="flex flex-col items-stretch justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <p className="font-black">Xác nhận round</p>
            <p className="mt-1 text-sm text-muted-foreground">Bấm xác nhận để báo cặp sai. Sửa tới khi đúng hoặc bấm bỏ qua.</p>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Button variant="outline" onClick={onExit}>
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Về chế độ
            </Button>
            {confirmedOnce && (
              <Button variant="destructive" onClick={skipRound}>
                Bỏ qua
              </Button>
            )}
            <Button variant="outline" onClick={resetRoundMatches} disabled={matchedCount === 0 && !confirmedOnce}>
              <RotateCcw className="mr-2 size-4" aria-hidden />
              Reset nối
            </Button>
            <Button onClick={confirmRound}>
              Xác nhận
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ProgressDialogs({
  deleteAllOpen,
  setDeleteAllOpen,
  onDeleteAll,
  actionItem,
  subjects,
  onCloseAction,
  onDeleteItem,
  onPinItem,
  onUnpinItem,
  pinnedCount
}: {
  deleteAllOpen: boolean;
  setDeleteAllOpen: (open: boolean) => void;
  onDeleteAll: () => void;
  actionItem?: ProgressItem;
  subjects: QuizSubject[];
  onCloseAction: () => void;
  onDeleteItem: (id: string) => void;
  onPinItem: (id: string) => void;
  onUnpinItem: (id: string) => void;
  pinnedCount: number;
}) {
  const subject = getSubject(subjects, actionItem?.subjectId);
  const chapter = getChapter(subject, actionItem?.chapterId, actionItem?.questionOrder, actionItem?.optionOrders);

  return (
    <>
      {deleteAllOpen && (
        <ConfirmDialog
          title="Xóa tất cả tiến trình?"
          body="Toàn bộ bài làm đang lưu trên trình duyệt này sẽ bị xóa."
          cancelLabel="Giữ lại"
          confirmLabel="Xóa tất cả"
          onCancel={() => setDeleteAllOpen(false)}
          onConfirm={onDeleteAll}
        />
      )}
      {actionItem && subject && chapter && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 motion-pop" onClick={onCloseAction}>
          <div className="w-full max-w-md rounded-lg border-2 border-foreground bg-card p-5 text-card-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] motion-pop" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">{chapter.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{subject.title}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={onCloseAction}>
                Đóng
              </Button>
              <Button variant="outline" onClick={() => onDeleteItem(actionItem.id)}>
                <Trash2 className="mr-2 size-4" aria-hidden />
                Xóa
              </Button>
              {actionItem.pinnedAt ? (
                <Button variant="secondary" onClick={() => onUnpinItem(actionItem.id)}>
                  <Pin className="mr-2 size-4" aria-hidden />
                  Bỏ ghim
                </Button>
              ) : (
                <Button disabled={pinnedCount >= MAX_PINNED} onClick={() => onPinItem(actionItem.id)}>
                  <Pin className="mr-2 size-4" aria-hidden />
                  Ghim lên đầu
                </Button>
              )}
            </div>
            {!actionItem.pinnedAt && pinnedCount >= MAX_PINNED && (
              <p className="mt-3 text-sm text-muted-foreground">Bạn chỉ có thể ghim tối đa 1 tiến trình.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultDialogs({
  deleteAllOpen,
  setDeleteAllOpen,
  onDeleteAll,
  actionItem,
  onCloseAction,
  onDeleteItem,
  onPinItem,
  onUnpinItem,
  pinnedCount
}: {
  deleteAllOpen: boolean;
  setDeleteAllOpen: (open: boolean) => void;
  onDeleteAll: () => void;
  actionItem?: ResultItem;
  onCloseAction: () => void;
  onDeleteItem: (id: string) => void;
  onPinItem: (id: string) => void;
  onUnpinItem: (id: string) => void;
  pinnedCount: number;
}) {
  const percent = actionItem ? Math.round((actionItem.score / actionItem.total) * 100) : 0;
  const mood = getResultMood(percent);
  const quote = actionItem ? getResultQuote(percent, actionItem.id) : "";

  return (
    <>
      {deleteAllOpen && (
        <ConfirmDialog
          title="Xóa tất cả kết quả?"
          body="Toàn bộ lịch sử kết quả gần đây trên trình duyệt này sẽ bị xóa."
          cancelLabel="Giữ lại"
          confirmLabel="Xóa tất cả"
          onCancel={() => setDeleteAllOpen(false)}
          onConfirm={onDeleteAll}
        />
      )}
      {actionItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 motion-pop" onClick={onCloseAction}>
          <div className="w-full max-w-md rounded-lg border-2 border-foreground bg-card p-5 text-card-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] motion-pop" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{actionItem.chapterTitle}</h2>
              <span className="result-dialog-stamp" aria-hidden>
                {mood.emoji}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {actionItem.score}/{actionItem.total} câu đúng · {percent}% · {mood.label}
            </p>
            <p className="result-quote mt-3">
              {quote}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={onCloseAction}>
                Đóng
              </Button>
              <Button variant="outline" onClick={() => onDeleteItem(actionItem.id)}>
                <Trash2 className="mr-2 size-4" aria-hidden />
                Xóa
              </Button>
              {actionItem.pinnedAt ? (
                <Button variant="secondary" onClick={() => onUnpinItem(actionItem.id)}>
                  <Pin className="mr-2 size-4" aria-hidden />
                  Bỏ ghim
                </Button>
              ) : (
                <Button disabled={pinnedCount >= MAX_PINNED} onClick={() => onPinItem(actionItem.id)}>
                  <Pin className="mr-2 size-4" aria-hidden />
                  Ghim lên đầu
                </Button>
              )}
            </div>
            {!actionItem.pinnedAt && pinnedCount >= MAX_PINNED && (
              <p className="mt-3 text-sm text-muted-foreground">Bạn chỉ có thể ghim tối đa 1 kết quả.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MemoryTipDialog({ tip, onClose }: { tip: MemoryTip; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4 motion-pop" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-[24px] border-2 border-foreground bg-card p-5 text-card-foreground shadow-[10px_10px_0_0_hsl(var(--foreground))] motion-pop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-secondary shadow-[4px_4px_0_0_hsl(var(--foreground))]">
            <Lightbulb className="size-6 stroke-[3]" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Câu {tip.number}</p>
            <h2 className="mt-1 text-2xl font-black">Cách ghi nhớ</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-xl border-2 border-foreground bg-muted p-4">
            <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Từ khóa câu hỏi</p>
            <p className="mt-1 text-base font-black leading-7">{tip.keywords}</p>
          </div>
          <div className="rounded-xl border-2 border-foreground bg-secondary/90 p-4">
            <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Đáp án móc nhớ</p>
            <p className="mt-1 text-lg font-black leading-7">{tip.answer}</p>
          </div>
          <div className="rounded-xl border-2 border-foreground bg-background/70 p-4">
            <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Mẹo nhớ</p>
            <p className="mt-1 text-sm font-black leading-7">{tip.memory}</p>
          </div>
          {tip.logic && (
            <div className="rounded-xl border-2 border-foreground bg-card p-4">
              <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Logic nhanh</p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">{tip.logic}</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Đã hiểu</Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 motion-pop" onClick={onCancel}>
      <div className="w-full max-w-md rounded-lg border-2 border-foreground bg-card p-5 text-card-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] motion-pop" onClick={(event) => event.stopPropagation()}>
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PomodoroStatus({
  active,
  settings,
  startedAt
}: {
  active: boolean;
  settings: AppSettings;
  startedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !settings.pomodoroEnabled || settings.pomodoroFocusMinutes < 10) {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, settings.pomodoroEnabled, settings.pomodoroFocusMinutes, startedAt]);

  if (!active || !settings.pomodoroEnabled || settings.pomodoroFocusMinutes < 10) {
    return null;
  }

  const focusMs = settings.pomodoroFocusMinutes * 60_000;
  const remaining = focusMs - (now - startedAt);

  return (
    <div className="fixed left-1/2 top-5 z-[55] -translate-x-1/2 rounded-full border-2 border-foreground bg-card/90 px-4 py-2 text-sm font-black shadow-[4px_4px_0_0_hsl(var(--foreground))] backdrop-blur">
      <span className="mr-2">⏱️</span>
      Nghỉ sau {formatTimer(remaining)}
    </div>
  );
}

function PomodoroBreakDialog({
  breakMinutes,
  onClose,
  open
}: {
  breakMinutes: number;
  onClose: () => void;
  open: boolean;
}) {
  const [breakStartedAt, setBreakStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }

    setBreakStartedAt(Date.now());
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) {
    return null;
  }

  const remaining = breakMinutes * 60_000 - (now - breakStartedAt);

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4 motion-pop" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[24px] border-2 border-foreground bg-card p-6 text-card-foreground shadow-[10px_10px_0_0_hsl(var(--foreground))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-muted-foreground">Pomodoro</p>
            <h2 className="mt-1 text-3xl font-black">Tới giờ nghỉ rồi</h2>
          </div>
          <span className="text-5xl">🍵</span>
        </div>
        <p className="mt-4 rounded-xl border-2 border-foreground bg-secondary p-4 text-center text-5xl font-black">
          {formatTimer(remaining)}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Bỏ qua nghỉ
          </Button>
          <Button onClick={onClose}>Bắt đầu phiên mới</Button>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  autoComplete,
  disabled,
  label,
  onChange,
  show,
  value,
  onToggle
}: {
  autoComplete: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  show: boolean;
  value: string;
  onToggle: () => void;
}) {
  return (
    <label className="grid gap-1 text-sm font-black">
      {label}
      <span className="relative block">
        <input
          className="h-11 w-full rounded-lg border-2 border-foreground bg-background px-3 pr-12 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          type={show ? "text" : "password"}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted disabled:opacity-40"
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          disabled={disabled}
          onClick={onToggle}
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </span>
    </label>
  );
}

export function SettingsDialog({
  auth,
  open,
  settings,
  user,
  onClose,
  onChange,
  onChangePassword
}: {
  auth?: AuthState;
  open: boolean;
  settings: AppSettings;
  user?: AuthSession;
  onClose: () => void;
  onChange: (settings: AppSettings | ((current: AppSettings) => AppSettings)) => void;
  onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => Promise<string | undefined>;
}) {
  const [activeSection, setActiveSection] = useState<
    "account" | "motion" | "emoji" | "theme" | "background" | "pomodoro" | "version"
  >("motion");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  if (!open) {
    return null;
  }

  const passwordLocked = false;
  const passwordLockText = "";

  const motionOrder: MotionLevel[] = ["low", "normal", "high"];
  const motionIndex = settings.motion === "off" ? 1 : motionOrder.indexOf(settings.motion);
  const motionLabel = {
    low: "Nhẹ",
    normal: "Vừa",
    high: "Nhiều",
    off: "Tắt"
  }[settings.motion];

  function changeMotion(direction: -1 | 1) {
    onChange((current) => {
      const currentIndex = current.motion === "off" ? 1 : motionOrder.indexOf(current.motion);
      const nextIndex = Math.min(motionOrder.length - 1, Math.max(0, currentIndex + direction));
      return { ...current, motion: motionOrder[nextIndex] };
    });
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSuccess("");
    setPasswordMessage("Đang xử lý...");
    const error = await (onChangePassword
      ? onChangePassword(currentPassword, nextPassword, confirmPassword)
      : "Bạn cần đăng nhập ở trang chính trước khi đổi mật khẩu.");
    setPasswordMessage(error ?? "");
    if (!error) {
      setPasswordSuccess("Đã đổi mật khẩu. Bạn có thể đổi tiếp sau 15 ngày.");
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="settings-modal fixed inset-0 z-[90] bg-black/50 p-2 motion-pop sm:p-3" onClick={onClose}>
      <div
        className="mx-auto flex h-[min(94vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border-2 border-foreground bg-card text-card-foreground shadow-[7px_7px_0_0_hsl(var(--foreground))] sm:h-[min(92vh,760px)] sm:rounded-[28px] sm:shadow-[12px_12px_0_0_hsl(var(--foreground))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-foreground bg-secondary px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-muted-foreground">Quiz ôn tập</p>
            <h2 className="text-2xl font-black">Cài đặt</h2>
          </div>
          <Button size="icon" variant="outline" onClick={onClose} aria-label="Đóng cài đặt">
            <XCircle className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2.2fr)]">
          <aside className="max-h-40 overflow-y-auto border-b-2 border-foreground bg-muted/60 p-3 sm:max-h-none sm:p-4 lg:border-b-0 lg:border-r-2 lg:p-5">
            <p className="text-sm font-black text-muted-foreground">Khu cài đặt</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 lg:grid-cols-1 lg:gap-3">
              <button
                type="button"
                className={cn("settings-tab", activeSection === "account" && "settings-tab-active")}
                onClick={() => setActiveSection("account")}
              >
                <span>👤</span>
                <span>Tài khoản</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "motion" && "settings-tab-active")}
                onClick={() => setActiveSection("motion")}
              >
                <span>🎞️</span>
                <span>Chuyển động</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "emoji" && "settings-tab-active")}
                onClick={() => setActiveSection("emoji")}
              >
                <span>🙂</span>
                <span>Emoji nền</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "theme" && "settings-tab-active")}
                onClick={() => setActiveSection("theme")}
              >
                <span>🌗</span>
                <span>Giao diện</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "background" && "settings-tab-active")}
                onClick={() => setActiveSection("background")}
              >
                <span>🧱</span>
                <span>Background</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "pomodoro" && "settings-tab-active")}
                onClick={() => setActiveSection("pomodoro")}
              >
                <span>⏱️</span>
                <span>Pomodoro</span>
              </button>
              <button
                type="button"
                className={cn("settings-tab", activeSection === "version" && "settings-tab-active")}
                onClick={() => setActiveSection("version")}
              >
                <span>🏷️</span>
                <span>Phiên bản</span>
              </button>
            </div>
          </aside>

          <div className="overflow-y-auto p-3 sm:p-5 lg:p-7">
            {activeSection === "account" && (
              <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Tài khoản</h3>
                    <p className="mt-1 text-sm font-black text-muted-foreground">
                      Đổi mật khẩu yêu cầu nhập mật khẩu hiện tại và xác nhận lại mật khẩu mới.
                    </p>
                  </div>
                  <Badge variant={passwordLocked ? "outline" : "secondary"}>
                    {passwordLocked ? "Đang khóa đổi pass" : "Có thể đổi pass"}
                  </Badge>
                </div>

                <div className="mt-5 rounded-xl border-2 border-foreground bg-card/85 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-muted-foreground">Đang đăng nhập</p>
                      <p className="mt-1 text-2xl font-black">{user?.name ?? "Chưa đăng nhập"}</p>
                    </div>
                    {user?.role && (
                      <Badge variant={user.role === "admin" ? "secondary" : "outline"}>
                        {user.role === "admin" ? "Admin" : "Thành viên"}
                      </Badge>
                    )}
                  </div>
                </div>

                <form className="mt-5 grid gap-4 rounded-xl border-2 border-foreground bg-card/85 p-4" onSubmit={submitPasswordChange}>
                  {passwordLocked && (
                    <p className="rounded-lg border-2 border-foreground bg-muted p-3 text-sm font-black">
                      Bạn đã đổi mật khẩu gần đây. Có thể đổi tiếp sau {passwordLockText}.
                    </p>
                  )}

                  <PasswordField
                    label="Mật khẩu hiện tại"
                    value={currentPassword}
                    disabled={!user || passwordLocked}
                    show={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((current) => !current)}
                    onChange={setCurrentPassword}
                    autoComplete="current-password"
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <PasswordField
                      label="Mật khẩu mới"
                      value={nextPassword}
                      disabled={!user || passwordLocked}
                      show={showNextPassword}
                      onToggle={() => setShowNextPassword((current) => !current)}
                      onChange={setNextPassword}
                      autoComplete="new-password"
                    />
                    <PasswordField
                      label="Xác nhận mật khẩu mới"
                      value={confirmPassword}
                      disabled={!user || passwordLocked}
                      show={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword((current) => !current)}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                    />
                  </div>

                  {passwordMessage && (
                    <p className="rounded-lg border-2 border-destructive bg-destructive/15 px-3 py-2 text-sm font-black">
                      {passwordMessage}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="rounded-lg border-2 border-foreground bg-secondary/80 px-3 py-2 text-sm font-black">
                      {passwordSuccess}
                    </p>
                  )}

                  <Button className="w-fit" type="submit" disabled={!user || passwordLocked}>
                    Đổi mật khẩu
                  </Button>
                </form>
              </section>
            )}

            {activeSection === "motion" && (
            <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Chuyển động animation</h3>
                  <p className="mt-1 text-sm font-black text-muted-foreground">Mức hiện tại: {motionLabel}</p>
                </div>
                <Badge variant="outline">{getMotionConfig(settings.motion).count} emoji/lần</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="settings-choice"
                  onClick={() => changeMotion(1)}
                  disabled={settings.motion === "high"}
                >
                  <span className="text-3xl">🚀</span>
                  <span>
                    <span className="block text-lg font-black">Tăng</span>
                    <span className="block text-sm text-muted-foreground">Nhiều emoji hơn nhưng vẫn giữ nhịp vừa phải.</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="settings-choice"
                  onClick={() => changeMotion(-1)}
                  disabled={settings.motion === "low"}
                >
                  <span className="text-3xl">🍃</span>
                  <span>
                    <span className="block text-lg font-black">Giảm</span>
                    <span className="block text-sm text-muted-foreground">Ít emoji hơn, chuyển cảnh dịu mắt hơn.</span>
                  </span>
                </button>
              </div>
              <Button
                className="mt-4"
                variant={settings.motion === "off" ? "secondary" : "outline"}
                onClick={() => onChange((current) => ({ ...current, motion: current.motion === "off" ? "normal" : "off" }))}
              >
                {settings.motion === "off" ? "Bật lại chuyển động" : "Loại bỏ chuyển động"}
              </Button>
            </section>
            )}

            {activeSection === "emoji" && (
              <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Emoji nền</h3>
                    <p className="mt-1 text-sm font-black text-muted-foreground">
                      Phần này thay cho popup nổi ngoài màn hình chính để không che nội dung trên điện thoại.
                    </p>
                  </div>
                </div>
                <EmojiBackgroundSettingsControl />
              </section>
            )}

            {activeSection === "theme" && (
            <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
              <h3 className="text-xl font-black">Chế độ màu</h3>
              <p className="mt-1 text-sm font-black text-muted-foreground">Mặc định là sáng. Chế độ tối đổi toàn bộ bảng màu sang tương phản dịu hơn.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn("settings-choice", settings.theme === "light" && "settings-choice-active")}
                  onClick={() => onChange((current) => ({ ...current, theme: "light" }))}
                >
                  <span className="text-3xl">☀️</span>
                  <span>
                    <span className="block text-lg font-black">Sáng</span>
                    <span className="block text-sm text-muted-foreground">Nền giấy sáng như hiện tại.</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={cn("settings-choice", settings.theme === "dark" && "settings-choice-active")}
                  onClick={() => onChange((current) => ({ ...current, theme: "dark" }))}
                >
                  <span className="text-3xl">🌙</span>
                  <span>
                    <span className="block text-lg font-black">Tối</span>
                    <span className="block text-sm text-muted-foreground">Tối hơn, tương phản rõ và đỡ chói.</span>
                  </span>
                </button>
              </div>
            </section>
            )}

            {activeSection === "background" && (
              <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Background Neo Brutalism</h3>
                    <p className="mt-1 text-sm font-black text-muted-foreground">
                      Chọn nền thủ công hoặc để app đổi ngẫu nhiên sau vài phút, nhưng chỉ đổi khi bạn bấm sang trang/chế độ khác.
                    </p>
                  </div>
                  <Badge variant="outline">
                    {{
                      grid: "Grid gốc",
                      blast: "Pop blast",
                      stickers: "Sticker wall",
                      checker: "Checker clash",
                      poster: "Poster blocks",
                      tape: "Tape chaos",
                      notebook: "Notebook",
                      neon: "Neon board",
                      waves: "Wave notes"
                    }[settings.background]}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    { id: "grid" as const, label: "Grid gốc", icon: "#" },
                    { id: "blast" as const, label: "Pop blast", icon: "*" },
                    { id: "stickers" as const, label: "Sticker wall", icon: "[]" },
                    { id: "checker" as const, label: "Checker clash", icon: "/" },
                    { id: "poster" as const, label: "Poster blocks", icon: "▰" },
                    { id: "tape" as const, label: "Tape chaos", icon: "~" },
                    { id: "notebook" as const, label: "Notebook", icon: "==" },
                    { id: "neon" as const, label: "Neon board", icon: "<>" },
                    { id: "waves" as const, label: "Wave notes", icon: "~~~" }
                  ].map((background) => (
                    <button
                      key={background.id}
                      type="button"
                      className={cn("settings-background-card", `settings-background-${background.id}`, settings.background === background.id && "settings-background-active")}
                      onClick={() =>
                        onChange((current) => ({
                          ...current,
                          background: background.id,
                          nextBackgroundAt: Date.now() + current.backgroundRandomMinutes * 60_000
                        }))
                      }
                    >
                      <span className="settings-background-icon">{background.icon}</span>
                      <span>{background.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border-2 border-foreground bg-card/85 p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                      <span className="block text-lg font-black">Ngẫu nhiên sau vài phút</span>
                      <span className="block text-sm font-black text-muted-foreground">Đủ thời gian rồi, lần chuyển trang/chế độ kế tiếp mới đổi nền.</span>
                    </span>
                    <input
                      className="size-6 accent-black"
                      type="checkbox"
                      checked={settings.backgroundRandom}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          backgroundRandom: event.target.checked,
                          nextBackgroundAt: Date.now() + current.backgroundRandomMinutes * 60_000
                        }))
                      }
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {[2, 3, 5].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className={cn("settings-time-pill", settings.backgroundRandomMinutes === minutes && "settings-time-pill-active")}
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            backgroundRandomMinutes: minutes as BackgroundRandomMinutes,
                            nextBackgroundAt: Date.now() + minutes * 60_000
                          }))
                        }
                      >
                        {minutes} phút
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeSection === "pomodoro" && (
              <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Học ngắt quãng Pomodoro</h3>
                    <p className="mt-1 text-sm font-black text-muted-foreground">
                      Nhắc nghỉ sau một phiên học. Mặc định nghỉ sau 20 phút.
                    </p>
                  </div>
                  <Badge variant={settings.pomodoroEnabled ? "secondary" : "outline"}>
                    {settings.pomodoroEnabled ? "Đang bật" : "Đang tắt"}
                  </Badge>
                </div>

                <div className="mt-5 rounded-xl border-2 border-foreground bg-card/85 p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                      <span className="block text-lg font-black">Bật chế độ Pomodoro</span>
                      <span className="block text-sm font-black text-muted-foreground">Chỉ bật được khi thời gian học từ 10 phút trở lên.</span>
                    </span>
                    <input
                      className="size-6 accent-black"
                      type="checkbox"
                      checked={settings.pomodoroEnabled}
                      disabled={settings.pomodoroFocusMinutes < 10}
                      onChange={(event) =>
                        onChange((current) => ({
                          ...current,
                          pomodoroEnabled: event.target.checked && current.pomodoroFocusMinutes >= 10
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border-2 border-foreground bg-card/85 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-black">Thời gian học</h4>
                        <p className="text-sm font-black text-muted-foreground">Tăng/giảm mỗi lần 5 phút.</p>
                      </div>
                      <Badge variant="outline">{settings.pomodoroFocusMinutes} phút</Badge>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            pomodoroEnabled: Math.max(10, current.pomodoroFocusMinutes - 5) >= 10 ? current.pomodoroEnabled : false,
                            pomodoroFocusMinutes: Math.max(10, current.pomodoroFocusMinutes - 5)
                          }))
                        }
                      >
                        Giảm 5 phút
                      </Button>
                      <Button
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            pomodoroFocusMinutes: current.pomodoroFocusMinutes + 5
                          }))
                        }
                      >
                        Tăng 5 phút
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-foreground bg-card/85 p-4">
                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span>
                        <span className="block text-lg font-black">Bật thời gian nghỉ</span>
                        <span className="block text-sm font-black text-muted-foreground">Khi hết phiên học, hiện popup nghỉ.</span>
                      </span>
                      <input
                        className="size-6 accent-black"
                        type="checkbox"
                        checked={settings.pomodoroBreakEnabled}
                        onChange={(event) =>
                          onChange((current) => ({
                            ...current,
                            pomodoroBreakEnabled: event.target.checked
                          }))
                        }
                      />
                    </label>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Badge variant="outline">Nghỉ {settings.pomodoroBreakMinutes} phút</Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              pomodoroBreakMinutes: Math.max(5, current.pomodoroBreakMinutes - 5)
                            }))
                          }
                        >
                          -5
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            onChange((current) => ({
                              ...current,
                              pomodoroBreakMinutes: current.pomodoroBreakMinutes + 5
                            }))
                          }
                        >
                          +5
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "version" && (
              <section className="rounded-xl border-2 border-foreground bg-background/70 p-5 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">Phiên bản</h3>
                    <p className="mt-1 text-sm font-black text-muted-foreground">
                      Thông tin bản phát hành hiện tại của Quiz ôn tập.
                    </p>
                  </div>
                  <Badge variant="secondary">v1.1.3</Badge>
                </div>

                <div className="mt-5 rounded-xl border-2 border-foreground bg-card/85 p-4">
                  <p className="text-sm font-black text-muted-foreground">Bản hiện tại</p>
                  <p className="mt-2 text-4xl font-black">1.1.3</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-3 border-b-2 border-foreground bg-card px-3 py-3 shadow-[0_5px_0_0_hsl(var(--foreground))] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
      <div>
        <p className="text-sm text-muted-foreground">Quiz ôn tập</p>
        <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function AdminControlPanel({
  auth,
  saved,
  subjects,
  questionStats
}: {
  auth: AuthState;
  saved: SavedProgress;
  subjects: QuizSubject[];
  questionStats: QuestionStat[];
}) {
  const submittedItems = Object.values(saved.items).filter((item) => item.submitted);
  const totalQuestions = subjects.reduce((total, subject) => total + getAllQuestions(subject).length, 0);
  const answeredTotal = questionStats.reduce((total, stat) => total + stat.total, 0);
  const correctTotal = questionStats.reduce((total, stat) => total + stat.correct, 0);
  const wrongTotal = questionStats.reduce((total, stat) => total + stat.wrong, 0);
  const skippedTotal = questionStats.reduce((total, stat) => total + stat.skipped, 0);
  const activeStats = questionStats.filter((stat) => stat.total > 0);
  const totalChecks = correctTotal + wrongTotal + skippedTotal;
  const correctRate = totalChecks ? Math.round((correctTotal / totalChecks) * 100) : 0;
  const wrongRate = totalChecks ? Math.round((wrongTotal / totalChecks) * 100) : 0;
  const skippedRate = totalChecks ? Math.round((skippedTotal / totalChecks) * 100) : 0;
  const submittedRate = totalQuestions ? Math.min(100, Math.round((answeredTotal / totalQuestions) * 100)) : 0;
  const animatedCorrectRate = useAnimatedNumber(correctRate);
  const animatedWrongRate = useAnimatedNumber(wrongRate);
  const animatedSkippedRate = useAnimatedNumber(skippedRate);
  const animatedCorrectTotal = useAnimatedNumber(correctTotal);
  const animatedWrongTotal = useAnimatedNumber(wrongTotal);
  const animatedSkippedTotal = useAnimatedNumber(skippedTotal);
  const memberCount = auth.users.filter((user) => user.role === "member").length;
  const adminCount = auth.users.length - memberCount;
  const recentResults = [...(saved.results ?? [])].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5);
  const hardestStats = [...activeStats].sort((a, b) => {
    const aWrongRate = a.total ? (a.wrong + a.skipped) / a.total : 0;
    const bWrongRate = b.total ? (b.wrong + b.skipped) / b.total : 0;
    return bWrongRate - aWrongRate;
  }).slice(0, 8);
  const chartStats = hardestStats.length ? hardestStats : questionStats.slice(0, 8);
  const topUsers = auth.users.slice(0, 6);

  return (
    <section className="admin-dashboard rounded-[2rem] bg-[#eef0ef] p-3 text-[#202226] shadow-[0_24px_70px_rgba(24,31,36,0.16)] sm:p-5">
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="admin-float-card rounded-[1.6rem] bg-[#fffaf3] p-5 shadow-[inset_0_0_0_1px_rgba(32,34,38,0.05)] lg:col-span-4 lg:row-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#72746f]">Bảng điều khiển</p>
              <h2 className="mt-3 text-5xl font-semibold leading-none tracking-normal sm:text-6xl">{animatedCorrectRate}%</h2>
              <p className="mt-3 text-sm font-bold text-[#72746f]">Tỉ lệ đúng toàn hệ thống</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#dfe8e1]">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
          </div>
          <div className="mt-8 grid grid-cols-4 gap-2">
            {["bg-[#202226]", "bg-[#d9e5df]", "bg-[#f07d88]", "bg-[#f6aa8b]", "bg-[#d9e5df]", "bg-[#202226]", "bg-[#d9e5df]", "bg-[#f07d88]"].map((color, index) => (
              <span key={index} className={cn("admin-meter-tile h-11 rounded-lg", color)} style={{ animationDelay: `${index * 70}ms` }} />
            ))}
          </div>
        </div>

        <AdminMetric className="lg:col-span-2" tone="bg-[#dfe8e1]" icon={<Users className="size-5" aria-hidden />} label="Tài khoản" value={auth.users.length} detail={`${adminCount} admin`} />
        <AdminMetric className="lg:col-span-2" tone="bg-[#f1e8f7]" icon={<BookOpenCheck className="size-5" aria-hidden />} label="Câu hỏi" value={totalQuestions} detail={`${subjects.length} môn`} />
        <AdminMetric className="bg-[#202226] text-white lg:col-span-2" tone="bg-white/15" icon={<BarChart3 className="size-5" aria-hidden />} label="Bài nộp" value={submittedItems.length} detail="Đã ghi nhận" dark />
        <AdminMetric className="lg:col-span-2" tone="bg-[#fffaf3]" icon={<CheckCircle2 className="size-5" aria-hidden />} label="Lượt trả lời" value={answeredTotal} detail={`${submittedRate}% phủ câu`} />

        <div className="admin-float-card rounded-[1.6rem] bg-[#fffaf3] p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#72746f]">Đúng</p>
            <span className="grid size-8 place-items-center rounded-full bg-[#dfe8e1]">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-8 text-4xl font-semibold tracking-normal">{animatedCorrectTotal}</p>
          <div className="mt-4 h-2 rounded-full bg-[#e7e1d7]">
            <span className="admin-progress-fill block h-full rounded-full bg-[#f07d88]" style={{ width: `${correctRate}%` }} />
          </div>
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#f4828d] p-5 text-white lg:col-span-2">
          <p className="text-sm font-bold text-white/75">Sai</p>
          <p className="mt-8 text-4xl font-semibold tracking-normal">{animatedWrongTotal}</p>
          <div className="mt-4 h-2 rounded-full bg-white/25">
            <span className="admin-progress-fill block h-full rounded-full bg-[#202226]" style={{ width: `${wrongRate}%` }} />
          </div>
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#dfe8e1] p-5 lg:col-span-2">
          <p className="text-sm font-bold text-[#72746f]">Bỏ trống</p>
          <p className="mt-8 text-4xl font-semibold tracking-normal">{animatedSkippedTotal}</p>
          <div className="mt-4 h-2 rounded-full bg-white/75">
            <span className="admin-progress-fill block h-full rounded-full bg-[#202226]" style={{ width: `${skippedRate}%` }} />
          </div>
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#202226] p-5 text-white lg:col-span-2 lg:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white/65">Phân bố</p>
            <CircleHelp className="size-5 text-white/65" aria-hidden />
          </div>
          <div className="mt-8 grid place-items-center">
            <AdminDonut percent={animatedCorrectRate} />
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs font-bold text-white/70">
            <span>Đúng</span>
            <span>Sai</span>
            <span>Trống</span>
          </div>
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#fffaf3] p-5 lg:col-span-4 lg:row-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#72746f]">Tổng quan từng câu</p>
              <h3 className="mt-1 text-xl font-semibold tracking-normal">Câu cần chú ý</h3>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#dfe8e1]">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </div>
          {chartStats.length === 0 ? (
            <div className="mt-8 rounded-2xl bg-[#eef0ef] p-6 text-center text-sm font-bold text-[#72746f]">Chưa có bài nộp để thống kê.</div>
          ) : (
            <div className="mt-6 flex h-52 items-end gap-2">
              {chartStats.map((stat, index) => {
                const failCount = stat.wrong + stat.skipped;
                const failRate = stat.total ? Math.round((failCount / stat.total) * 100) : 0;
                return (
                  <div key={stat.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end rounded-full bg-[#eef0ef] px-1.5 py-1.5">
                      <span className={cn("admin-chart-bar block w-full rounded-full", index % 2 === 0 ? "bg-[#f07d88]" : "bg-[#202226]")} style={{ height: `${Math.max(10, failRate)}%`, animationDelay: `${index * 80}ms` }} title={`${failRate}% sai/trống`} />
                    </div>
                    <span className="text-[0.65rem] font-bold text-[#8b8c87]">{index + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#dfe8e1] p-5 lg:col-span-3">
          <p className="text-sm font-bold text-[#72746f]">Tài khoản</p>
          <div className="mt-5 space-y-3">
            {topUsers.map((user) => (
              <div key={user.email} className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs font-bold text-[#72746f]">{user.email}</p>
                </div>
                <span className="rounded-full bg-[#202226] px-3 py-1 text-xs font-bold text-white">{user.role === "admin" ? "Admin" : "Member"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-float-card rounded-[1.6rem] bg-[#fffaf3] p-5 lg:col-span-3">
          <p className="text-sm font-bold text-[#72746f]">Nộp gần đây</p>
          {recentResults.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#eef0ef] p-5 text-sm font-bold text-[#72746f]">Chưa có kết quả mới.</div>
          ) : (
            <div className="mt-5 space-y-3">
              {recentResults.map((result) => {
                const resultRate = Math.round((result.score / result.total) * 100);
                return (
                  <div key={result.id} className="rounded-2xl bg-[#eef0ef] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold">{result.userName ?? "Ẩn danh"}</p>
                      <span className="font-semibold">{resultRate}%</span>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-[#72746f]">{result.chapterTitle}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AdminMetric({
  className,
  dark,
  detail,
  icon,
  label,
  tone,
  value
}: {
  className?: string;
  dark?: boolean;
  detail: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: number;
}) {
  const animatedValue = useAnimatedNumber(value);

  return (
    <div className={cn("admin-float-card rounded-[1.6rem] bg-[#fffaf3] p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-bold", dark ? "text-white/65" : "text-[#72746f]")}>{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-full", tone)}>
          {icon}
        </span>
      </div>
      <p className="mt-8 text-4xl font-semibold tracking-normal">{animatedValue}</p>
      <p className={cn("mt-2 text-xs font-bold", dark ? "text-white/55" : "text-[#8b8c87]")}>{detail}</p>
    </div>
  );
}

function AdminDonut({ percent }: { percent: number }) {
  return (
    <div
      className="grid size-32 place-items-center rounded-full"
      style={{ background: `conic-gradient(#f07d88 0 ${percent}%, #dfe8e1 ${percent}% 74%, rgba(255,255,255,0.18) 74% 100%)` }}
    >
      <div className="grid size-20 place-items-center rounded-full bg-[#202226]">
        <span className="text-2xl font-semibold tracking-normal">{percent}%</span>
      </div>
    </div>
  );
}

function AccountFrame({
  media,
  onMediaChange,
  profile,
  user
}: {
  media?: ProfileMediaItem;
  onMediaChange: (media: ProfileMediaItem) => void;
  profile: ProfileProgress;
  user: AuthSession;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  function updateImage(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onMediaChange({ [kind]: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return (
    <section className="mb-4 flex w-full justify-center sm:mb-6 sm:justify-start xl:fixed xl:left-6 xl:top-12 xl:z-30 xl:mb-0 xl:w-auto">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-foreground bg-secondary/95 p-3 text-left shadow-[6px_6px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5 sm:max-w-[15rem] sm:shadow-[7px_7px_0_0_hsl(var(--foreground))] xl:w-[13.5rem]"
        onClick={() => setOpen(true)}
      >
        {media?.avatar ? (
          <img
            className="size-12 shrink-0 rounded-xl border-2 border-foreground object-cover shadow-[3px_3px_0_0_hsl(var(--foreground))] xl:size-11"
            src={media.avatar}
            alt=""
          />
        ) : (
          <div className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))] xl:size-11">
            <User className="size-8 stroke-[3]" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
            <p className="text-xs font-black uppercase text-foreground/65">Tài khoản</p>
          <p className="truncate text-lg font-black leading-tight">{user.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">LV {profile.level}</Badge>
            <span className="text-xs font-black text-foreground/70">{profile.xp}%</span>
          </div>
          {user.role === "admin" && (
            <Badge className="mt-1" variant="outline">
              Admin
            </Badge>
          )}
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border-2 border-foreground bg-card shadow-[12px_12px_0_0_hsl(var(--foreground))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-36 bg-secondary">
              {media?.cover ? (
                <img className="h-full w-full object-cover" src={media.cover} alt="" />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(135deg,hsl(var(--secondary)),hsl(var(--accent))_52%,hsl(var(--primary)))]" />
              )}
              <button
                type="button"
                className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border-2 border-foreground bg-card shadow-[3px_3px_0_0_hsl(var(--foreground))]"
                aria-label="Tùy chọn profile"
                onClick={() => setMenuOpen((current) => !current)}
              >
                <MoreVertical className="size-5" aria-hidden />
              </button>
              {menuOpen && (
                <div className="absolute right-3 top-16 z-10 w-48 overflow-hidden rounded-2xl border-2 border-foreground bg-card p-2 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-muted"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    Đổi avatar
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-black hover:bg-muted"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Đổi ảnh bìa
                  </button>
                </div>
              )}
            </div>

            <div className="relative px-5 pb-5 pt-16">
              <div className="absolute -top-12 left-5 z-10">
                {media?.avatar ? (
                  <img className="size-24 rounded-2xl border-4 border-card bg-card object-cover shadow-[5px_5px_0_0_hsl(var(--foreground))]" src={media.avatar} alt="" />
                ) : (
                  <div className="grid size-24 place-items-center rounded-2xl border-4 border-card bg-card text-foreground shadow-[5px_5px_0_0_hsl(var(--foreground))]">
                    <User className="size-12 stroke-[3]" aria-hidden />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase text-muted-foreground">Tài khoản</p>
                <h2 className="mt-1 truncate text-3xl font-black leading-tight">{user.name}</h2>
                <Badge className="mt-3" variant={user.role === "admin" ? "secondary" : "outline"}>
                  {user.role === "admin" ? "Admin" : "Thành viên"}
                </Badge>
              </div>

              <div className="mt-5 rounded-2xl border-2 border-foreground bg-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black">LV {profile.level}</p>
                  <p className="text-sm font-black text-muted-foreground">{profile.xp}% KN</p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-foreground bg-card">
                  <span className="block h-full bg-primary transition-all duration-500" style={{ width: `${profile.level >= 100 ? 100 : profile.xp}%` }} />
                </div>
              </div>

              <Button className="mt-5 w-full" type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                Đóng
              </Button>
            </div>

            <input ref={avatarInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => updateImage("avatar", event)} />
            <input ref={coverInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => updateImage("cover", event)} />
          </div>
        </div>
      )}
    </section>
  );
}

function AuthDialog({
  open,
  mode,
  auth,
  onModeChange,
  onClose,
  onLogin,
  onRegister
}: {
  open: boolean;
  mode: "login" | "register";
  auth: AuthState;
  onModeChange: (mode: "login" | "register") => void;
  onClose: () => void;
  onLogin: (name: string, password: string, rememberPassword: boolean) => Promise<string | undefined>;
  onRegister: (email: string, name: string, password: string, confirmPassword: string) => Promise<string | undefined>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(auth.rememberedName ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(Boolean(auth.rememberPassword));
  const [message, setMessage] = useState("");

  if (!open) {
    return null;
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đang xử lý...");
    const error = await (mode === "login"
      ? onLogin(name, password, rememberPassword)
      : onRegister(email, name, password, confirmPassword));
    setMessage(error ?? "");
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-md rounded-2xl border-2 border-foreground bg-card p-5 shadow-[10px_10px_0_0_hsl(var(--foreground))]"
        onSubmit={submitAuth}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-muted-foreground">Quiz ôn tập</p>
            <h2 className="text-2xl font-black">{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h2>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Đóng đăng nhập">
            <XCircle className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {mode === "register" && (
            <label className="grid gap-1 text-sm font-black">
              Email
              <input
                className="h-11 rounded-lg border-2 border-foreground bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
          )}
          <label className="grid gap-1 text-sm font-black">
            Tên trong web
            <input
              className="h-11 rounded-lg border-2 border-foreground bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
            />
          </label>
          <PasswordField
            label="Mật khẩu"
            value={password}
            show={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <PasswordField
              label="Xác nhận mật khẩu"
              value={confirmPassword}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((current) => !current)}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          )}
          {mode === "login" && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-black">
              <input
                className="size-5 accent-black"
                type="checkbox"
                checked={rememberPassword}
                onChange={(event) => setRememberPassword(event.target.checked)}
              />
              <span>Ghi nhớ pass</span>
            </label>
          )}
        </div>

        {message && (
          <p className="mt-3 rounded-lg border-2 border-destructive bg-destructive/15 px-3 py-2 text-sm font-black">
            {message}
          </p>
        )}

        <Button className="mt-5 w-full" type="submit">
          {mode === "login" ? (
            <>
              <LogIn className="mr-2 size-4" aria-hidden />
              Đăng nhập
            </>
          ) : (
            <>
              <UserPlus className="mr-2 size-4" aria-hidden />
              Tạo tài khoản
            </>
          )}
        </Button>

        <Button
          className="mt-3 w-full"
          type="button"
          variant="outline"
          onClick={() => {
            setMessage("");
            onModeChange(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </Button>
      </form>
    </div>
  );
}

function TopNav({
  user,
  onHome,
  onAdmin,
  onSettings,
  onAuth,
  onLogout
}: {
  user?: AuthSession;
  onHome: () => void;
  onAdmin: () => void;
  onSettings: () => void;
  onAuth: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="px-3 pt-3 sm:px-4 sm:pt-8">
      <div className="container relative max-w-6xl rounded-[24px] border-2 border-foreground bg-card px-3 py-3 shadow-[7px_7px_0_0_hsl(var(--foreground))] motion-safe-card sm:rounded-[34px] sm:px-5 sm:py-5 sm:shadow-[10px_10px_0_0_hsl(var(--foreground))]">
        <div className="absolute -top-8 left-1/2 hidden size-20 -translate-x-1/2 rotate-[-12deg] rounded-2xl border-2 border-foreground bg-accent shadow-[6px_6px_0_0_hsl(var(--foreground))] lg:grid lg:place-items-center">
          <BookOpenCheck className="size-10 stroke-[3]" aria-hidden />
        </div>
        <div className="absolute -right-5 top-1/2 hidden -translate-y-1/2 rounded-full border-2 border-foreground bg-accent px-6 py-3 text-2xl font-black shadow-[6px_6px_0_0_hsl(var(--foreground))] xl:block">
          HUIT
        </div>

        <div className="flex flex-col items-stretch gap-3 pr-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 xl:pr-28">
          <button type="button" className="flex items-center gap-3 text-left" onClick={onHome}>
            <span className="grid size-12 place-items-center rounded-xl border-2 border-foreground bg-accent shadow-[4px_4px_0_0_hsl(var(--foreground))]">
              <BookOpenCheck className="size-7 stroke-[3]" aria-hidden />
            </span>
            <span>
              <span className="title-shine block text-xl font-black leading-none">Quiz ôn tập</span>
              <span className="block text-sm font-black text-muted-foreground">HUIT study hub</span>
            </span>
          </button>

          <nav className="grid grid-cols-2 items-center gap-2 text-sm font-black sm:flex sm:flex-wrap sm:gap-3">
            <button
              type="button"
              className="rounded-full border-2 border-foreground bg-background px-3 py-2 text-center shadow-[3px_3px_0_0_hsl(var(--foreground))] underline decoration-4 underline-offset-4 hover:decoration-accent sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:underline-offset-8"
              onClick={onHome}
            >
              Trang chủ
            </button>
            <Link
              className="rounded-full border-2 border-foreground bg-background px-3 py-2 text-center shadow-[3px_3px_0_0_hsl(var(--foreground))] hover:underline hover:decoration-4 hover:underline-offset-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none"
              href="/contact"
            >
              Liên hệ
            </Link>
            {user?.role === "admin" && (
              <Button className="w-full sm:w-auto" type="button" size="sm" variant="secondary" onClick={onAdmin}>
                <ShieldCheck className="mr-2 size-4" aria-hidden />
                Kiểm soát
              </Button>
            )}
            {user ? (
              <Button className="w-full sm:w-auto" type="button" size="sm" variant="outline" onClick={onLogout}>
                <LogOut className="mr-2 size-4" aria-hidden />
                Đăng xuất
              </Button>
            ) : (
              <Button className="w-full sm:w-auto" type="button" size="sm" onClick={onAuth}>
                <LogIn className="mr-2 size-4" aria-hidden />
                Đăng nhập
              </Button>
            )}
          </nav>
        </div>
      </div>
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 grid size-11 place-items-center rounded-full border-2 border-foreground bg-secondary shadow-[4px_4px_0_0_hsl(var(--foreground))] transition-colors hover:bg-accent sm:bottom-auto sm:right-5 sm:top-5 sm:size-12"
        aria-label="Cài đặt"
        onClick={onSettings}
      >
        <Settings className="size-6 stroke-[3]" aria-hidden />
      </button>
    </header>
  );
}
