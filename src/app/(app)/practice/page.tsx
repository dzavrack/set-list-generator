import type { Metadata } from "next";
import { PracticeRoom } from "@/components/practice/PracticeRoom";

export const metadata: Metadata = {
  title: "Practice · Gig Book",
  description: "Work through the songs you're learning with a timer, step-by-step plans and a practice log.",
};

export default function PracticePage() {
  return <PracticeRoom />;
}
