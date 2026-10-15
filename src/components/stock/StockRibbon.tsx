import React from "react";
import { Zap } from "lucide-react";
import { cn } from "../../lib/utils";

interface StockRibbonProps {
  onCreateStock: () => void;
  t: (en: string, ja: string) => string;
  className?: string;
}

export const StockRibbon: React.FC<StockRibbonProps> = ({
  onCreateStock,
  t,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onCreateStock}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/40 hover:border-amber-400 text-amber-400 hover:text-amber-300 hover:bg-amber-500/25 text-[11px] font-bold transition-all rounded-[2px] shadow-xs cursor-pointer",
        className
      )}
      title={t("Stock current view and scroll position", "現在の画面表示とスクロール位置をストック保存")}
    >
      <Zap size={13} className="fill-amber-400 text-amber-400" />
      <span>{t("STOCK POSITION", "位置をストック")}</span>
    </button>
  );
};
