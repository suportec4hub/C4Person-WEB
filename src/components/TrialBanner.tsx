import { Clock, Zap } from "lucide-react";
import { CheckoutButton } from "./CheckoutButton";

export function TrialBanner({ trialEnd }: { trialEnd: Date }) {
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2 text-amber-400 text-sm">
        <Clock size={14} />
        <span>
          Período de teste: <strong>{daysLeft} dia{daysLeft !== 1 ? "s" : ""}</strong> restante{daysLeft !== 1 ? "s" : ""}
        </span>
      </div>
      <CheckoutButton className="bg-primary hover:bg-primary/90 text-white text-xs px-4 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5">
        <Zap size={12} />
        Assinar R$15,90/mês
      </CheckoutButton>
    </div>
  );
}
