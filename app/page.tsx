import { QuizApp } from "@/components/quiz-app";
import subjects from "@/data/subjects.json";
import type { QuizSubject } from "@/lib/quiz-types";

export default function Home() {
  return <QuizApp subjects={subjects as QuizSubject[]} />;
}
