export type QuizOption = {
  id: string;
  label: string;
  text: string;
  correct: boolean;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

export type QuizChapter = {
  id: string;
  title: string;
  questions: QuizQuestion[];
};

export type QuizSubject = {
  id: string;
  title: string;
  description: string;
  source: string;
  chapters: QuizChapter[];
};
