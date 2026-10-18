import type { SeedCurriculum } from "./types";

import { moduleZero } from "./module-0-orientation";
import { moduleOne } from "./module-1-it-basics";
import { moduleTwo } from "./module-2-windows";
import { moduleThree } from "./module-3-internet-email";
import { moduleFour } from "./module-4-word";
import { moduleFive } from "./module-5-excel";
import { moduleSix } from "./module-6-powerpoint";
import { moduleSeven } from "./module-7-access";
import { moduleEight } from "./module-8-extra-skills";

/**
 * The ICDL curriculum, in the exact published order.
 *
 * Module 0 is the optional orientation module; modules 1–8 follow the
 * standard ICDL syllabus. The order of this array is authoritative — it drives
 * module numbering and navigation.
 */
export const curriculum: SeedCurriculum = [
  moduleZero,
  moduleOne,
  moduleTwo,
  moduleThree,
  moduleFour,
  moduleFive,
  moduleSix,
  moduleSeven,
  moduleEight,
];

export const curriculumStats = (() => {
  let chapters = 0;
  let lessons = 0;
  let blocks = 0;
  let quizzes = 0;
  let questions = 0;
  let estimatedMinutes = 0;

  for (const courseModule of curriculum) {
    for (const chapter of courseModule.chapters) {
      chapters += 1;
      for (const lesson of chapter.lessons) {
        lessons += 1;
        blocks += lesson.blocks.length;
        estimatedMinutes += lesson.estimatedMinutes ?? 10;
        if (lesson.quiz) {
          quizzes += 1;
          questions += lesson.quiz.questions.length;
        }
      }
    }
  }

  return { modules: curriculum.length, chapters, lessons, blocks, quizzes, questions, estimatedMinutes };
})();

export * from "./types";
