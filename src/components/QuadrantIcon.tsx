import { Brain, BriefcaseBusiness, Dumbbell, HeartHandshake, Sofa, Sparkles, type LucideProps } from "lucide-react";
import type { QuadrantId } from "@/lib/quadrants";

const ICONS = {
  cuerpo: Dumbbell,
  mente: Brain,
  alma: Sparkles,
  vinculos: HeartHandshake,
  trabajo: BriefcaseBusiness,
  libre: Sofa,
} satisfies Record<QuadrantId, unknown>;

export function QuadrantIcon({ id, ...props }: { id: QuadrantId } & LucideProps) {
  const Icon = ICONS[id];
  return <Icon aria-hidden strokeWidth={1.75} {...props} />;
}
