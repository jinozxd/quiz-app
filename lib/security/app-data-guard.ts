import { z } from "zod";
import subjectsRaw from "@/data/subjects.json";
import type { QuizChapter, QuizSubject } from "@/lib/quiz-types";

const MAX_ITEMS = 200;
const MAX_RESULTS = 30;
const MAX_STARRED = 1000;
const MAX_PROFILE_MEDIA_USERS = 25;
const MAX_DATA_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 3;
const FUTURE_DRIFT_MS = 1000 * 60 * 5;

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

export type SanitizedAppData = {
  saved: SavedProgress;
  profileMedia: Record<string, { avatar?: string; cover?: string }>;
  profileProgress: ProfileProgress;
};

const subjects = subjectsRaw as QuizSubject[];
const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

const progressItemSchema = z.object({
  id: z.string().min(1).max(160),
  subjectId: z.string().min(1).max(80),
  chapterId: z.string().min(1).max(120),
  userName: z.string().max(80).optional(),
  questionOrder: z.array(z.string().max(120)).max(1000).optional(),
  optionOrders: z.record(z.string(), z.array(z.string().max(40)).max(12)).optional(),
  answers: z.record(z.string(), z.string()).default({}),
  submitted: z.boolean().default(false),
  updatedAt: z.number().finite(),
  pinnedAt: z.number().finite().optional()
});

const resultItemSchema = z.object({
  id: z.string().min(1).max(180),
  subjectId: z.string().min(1).max(80),
  chapterId: z.string().max(120).optional(),
  chapterTitle: z.string().min(1).max(180),
  userName: z.string().max(80).optional(),
  score: z.number().finite(),
  total: z.number().finite(),
  submittedAt: z.number().finite(),
  pinnedAt: z.number().finite().optional()
});

const savedSchema = z.object({
  activeSubjectId: z.string().max(80).optional(),
  activeChapterId: z.string().max(120).optional(),
  items: z.record(z.string(), progressItemSchema).default({}),
  order: z.array(z.string().max(160)).default([]),
  starredQuestionIds: z.array(z.string().max(120)).default([]),
  results: z.array(resultItemSchema).default([])
});

const mediaValueSchema = z.object({
  avatar: z.string().max(250_000).optional(),
  cover: z.string().max(250_000).optional()
});

const profileMediaSchema = z.record(z.string().max(80), mediaValueSchema).default({});

const payloadSchema = z.object({
  saved: savedSchema.default({ items: {}, order: [], starredQuestionIds: [], results: [] }),
  profileMedia: profileMediaSchema,
  profileProgress: z.unknown().optional()
});

function clampTime(value: number, fallback = Date.now()) {
  const now = Date.now();
  if (!Number.isFinite(value) || value > now + FUTURE_DRIFT_MS || value < now - MAX_DATA_AGE_MS) {
    return fallback;
  }
  return Math.floor(value);
}

function getAllQuestions(subject: QuizSubject) {
  return subject.chapters.flatMap((chapter) => chapter.questions);
}

function splitChapter(chapter: QuizChapter) {
  if (chapter.questions.length <= 40) {
    return [chapter];
  }

  const parts: QuizChapter[] = [];
  for (let index = 0; index < chapter.questions.length; index += 15) {
    parts.push({
      id: `${chapter.id}-part-${parts.length + 1}`,
      title: `${chapter.title} - Phần ${parts.length + 1}`,
      questions: chapter.questions.slice(index, index + 15)
    });
  }
  return parts;
}

function getChapterQuestions(subject: QuizSubject, chapterId: string) {
  const original = subject.chapters.find((chapter) => chapter.id === chapterId);
  if (original) {
    return original.questions;
  }

  const part = subject.chapters.flatMap(splitChapter).find((chapter) => chapter.id === chapterId);
  if (part) {
    return part.questions;
  }

  if (
    chapterId.endsWith("-shuffle") ||
    chapterId.startsWith("mode-exam-40") ||
    chapterId.startsWith("mode-all-random") ||
    chapterId.startsWith("mode-practice-starred") ||
    chapterId.startsWith("mode-survival") ||
    chapterId.startsWith("mode-match")
  ) {
    return getAllQuestions(subject);
  }

  return [];
}

function getChapterTitle(subject: QuizSubject, chapterId: string, fallback: string) {
  const chapter = subject.chapters.flatMap(splitChapter).find((item) => item.id === chapterId);
  if (chapter) {
    return chapter.title;
  }
  if (chapterId.startsWith("mode-exam-40")) return "Thi thử 40 câu";
  if (chapterId.startsWith("mode-all-random")) return "Trộn tất cả câu";
  if (chapterId.startsWith("mode-practice-starred")) return "Luyện tập câu đã đánh dấu";
  if (chapterId.startsWith("mode-survival")) return "Sinh tồn";
  if (chapterId.startsWith("mode-match")) return "Nối câu hỏi";
  return fallback.slice(0, 180);
}

function isStandaloneResultChapter(chapterId: string) {
  return (
    chapterId.startsWith("mode-exam-40") ||
    chapterId.startsWith("mode-all-random") ||
    chapterId.startsWith("mode-practice-starred") ||
    chapterId.startsWith("mode-survival") ||
    chapterId.startsWith("mode-match")
  );
}

function calculateScore(subject: QuizSubject, item: ProgressItem) {
  const questions = getChapterQuestions(subject, item.chapterId);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  let score = 0;
  let answered = 0;
  const answers: Record<string, string> = {};

  for (const [questionId, optionId] of Object.entries(item.answers)) {
    const question = questionById.get(questionId);
    const selected = question?.options.find((option) => option.id === optionId);
    if (!question || !selected) {
      continue;
    }

    answers[questionId] = optionId;
    answered += 1;
    if (selected.correct) {
      score += 1;
    }
  }

  return {
    answers,
    answered,
    score,
    total: questions.length
  };
}

function getXpForPercent(percent: number) {
  if (percent >= 100) return 35;
  if (percent >= 75) return 20;
  if (percent >= 50) return 15;
  if (percent >= 25) return 10;
  return 5;
}

function recomputeProfileProgress(results: ResultItem[]) {
  let level = 1;
  let xp = 0;
  const awardedResultIds: string[] = [];

  for (const result of [...results].reverse()) {
    if (awardedResultIds.includes(result.id)) {
      continue;
    }

    const percent = result.total ? Math.round((result.score / result.total) * 100) : 0;
    const xpGain = getXpForPercent(percent);
    if (level >= 100) {
      xp = 0;
    } else {
      const totalXp = xp + xpGain;
      level = Math.min(100, level + Math.floor(totalXp / 100));
      xp = level >= 100 ? 0 : totalXp % 100;
    }
    awardedResultIds.unshift(result.id);
  }

  return {
    level,
    xp,
    awardedResultIds: awardedResultIds.slice(0, 300),
    unlockedAchievementIds: []
  };
}

function sanitizeProfileMedia(profileMedia: Record<string, { avatar?: string; cover?: string }>) {
  return Object.fromEntries(
    Object.entries(profileMedia)
      .slice(0, MAX_PROFILE_MEDIA_USERS)
      .map(([name, media]) => [
        name.slice(0, 80),
        {
          ...(media.avatar?.startsWith("data:image/") ? { avatar: media.avatar } : {}),
          ...(media.cover?.startsWith("data:image/") ? { cover: media.cover } : {})
        }
      ])
  );
}

export function sanitizeAppDataPayload(payload: unknown, session: { id: string; name: string }): SanitizedAppData | null {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const validItems = new Map<string, ProgressItem>();
  const itemEntries = Object.entries(parsed.data.saved.items).slice(0, MAX_ITEMS);

  for (const [key, item] of itemEntries) {
    const subject = subjectById.get(item.subjectId);
    if (!subject) {
      continue;
    }

    const score = calculateScore(subject, item);
    if (!score.total || score.answered > score.total) {
      continue;
    }

    const cleanItem: ProgressItem = {
      id: item.id || key,
      subjectId: item.subjectId,
      chapterId: item.chapterId,
      userName: session.name,
      questionOrder: item.questionOrder?.filter((questionId) => score.answers[questionId] !== undefined || getChapterQuestions(subject, item.chapterId).some((question) => question.id === questionId)).slice(0, score.total),
      optionOrders: item.optionOrders,
      answers: score.answers,
      submitted: item.submitted,
      updatedAt: clampTime(item.updatedAt),
      pinnedAt: item.pinnedAt ? clampTime(item.pinnedAt) : undefined
    };
    validItems.set(cleanItem.id, cleanItem);
  }

  const order = parsed.data.saved.order.filter((id) => validItems.has(id)).slice(0, MAX_ITEMS);
  for (const id of validItems.keys()) {
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  const submittedByProgressKey = new Map<string, { item: ProgressItem; score: ReturnType<typeof calculateScore>; subject: QuizSubject }>();
  for (const item of validItems.values()) {
    const subject = subjectById.get(item.subjectId);
    if (!subject || !item.submitted) {
      continue;
    }
    submittedByProgressKey.set(`${item.subjectId}:${item.chapterId}`, {
      item,
      score: calculateScore(subject, item),
      subject
    });
  }

  const results: ResultItem[] = [];
  for (const result of parsed.data.saved.results.slice(0, MAX_RESULTS)) {
    const subject = subjectById.get(result.subjectId);
    if (!subject) {
      continue;
    }

    const backing = result.chapterId ? submittedByProgressKey.get(`${result.subjectId}:${result.chapterId}`) : undefined;
    if (!backing && (!result.chapterId || !isStandaloneResultChapter(result.chapterId))) {
      continue;
    }

    const total = backing ? backing.score.total : Math.min(Math.max(1, Math.floor(result.total)), getAllQuestions(subject).length || 1);
    const score = backing ? backing.score.score : Math.min(total, Math.max(0, Math.floor(result.score)));
    const chapterId = result.chapterId;

    results.push({
      id: result.id,
      subjectId: result.subjectId,
      chapterId,
      chapterTitle: chapterId ? getChapterTitle(subject, chapterId, result.chapterTitle) : result.chapterTitle.slice(0, 180),
      userName: session.name,
      score,
      total,
      submittedAt: clampTime(result.submittedAt),
      pinnedAt: result.pinnedAt ? clampTime(result.pinnedAt) : undefined
    });
  }

  const starredQuestionIds = parsed.data.saved.starredQuestionIds
    .filter((questionId) => subjects.some((subject) => getAllQuestions(subject).some((question) => question.id === questionId)))
    .slice(0, MAX_STARRED);

  return {
    saved: {
      activeSubjectId: subjectById.has(parsed.data.saved.activeSubjectId ?? "") ? parsed.data.saved.activeSubjectId : undefined,
      activeChapterId: parsed.data.saved.activeChapterId,
      items: Object.fromEntries(validItems),
      order,
      starredQuestionIds,
      results
    },
    profileMedia: sanitizeProfileMedia(parsed.data.profileMedia),
    profileProgress: recomputeProfileProgress(results)
  };
}
