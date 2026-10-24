import { CarTaxiFront, Coffee, Scissors, Wrench, Tag } from 'lucide-react';

const ICONS: Record<string, typeof Tag> = {
  'auto-cab': CarTaxiFront,
  'home-services': Wrench,
  haircuts: Scissors,
  'street-food': Coffee,
};

export function CategoryIcon({ categoryId, size = 18, className = '' }: { categoryId?: string; size?: number; className?: string }) {
  const Icon = (categoryId && ICONS[categoryId]) || Tag;
  return <Icon size={size} className={className} aria-hidden strokeWidth={2} />;
}
