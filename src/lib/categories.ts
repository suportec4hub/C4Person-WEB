export const EXPENSE_CATEGORIES = [
  { label: "Alimentação", color: "#f97316" },
  { label: "Transporte", color: "#3b82f6" },
  { label: "Moradia", color: "#8b5cf6" },
  { label: "Saúde", color: "#ec4899" },
  { label: "Educação", color: "#eab308" },
  { label: "Lazer", color: "#10b981" },
  { label: "Vestuário", color: "#6366f1" },
  { label: "Outros", color: "#94a3b8" },
];

export const INCOME_CATEGORIES = [
  { label: "Salário", color: "#10b981" },
  { label: "Freelance", color: "#3b82f6" },
  { label: "Investimentos", color: "#8b5cf6" },
  { label: "Outros", color: "#94a3b8" },
];

export function getCategoryColor(label: string): string {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return all.find((c) => c.label === label)?.color ?? "#71717a";
}
