import { BriefcaseBusiness, Dumbbell, Flower2, GraduationCap, HeartHandshake, Palette, CookingPot, type LucideProps } from "lucide-react";
import type { QuadrantId } from "@/lib/quadrants";

const ICONS = {
  cuerpo: Dumbbell,
  interior: Flower2,
  mente: GraduationCap,
  alma: Palette,
  vinculos: HeartHandshake,
  trabajo: BriefcaseBusiness,
  libre: CookingPot,
} satisfies Record<QuadrantId, unknown>;

export function QuadrantIcon({ id, ...props }: { id: QuadrantId } & LucideProps) {
  const Icon = ICONS[id];
  return <Icon aria-hidden strokeWidth={1.75} {...props} />;
}
