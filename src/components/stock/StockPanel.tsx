import React, { useState } from "react";
import { Zap, X, ArrowUp, ArrowDown, RefreshCw, Edit2 } from "lucide-react";
import { QuickStockRecord } from "./types";
import { cn } from "../../lib/utils";

interface StockPanelProps {
  quickStocks: QuickStockRecord[];
  activeStockId?: string | null;
  onCreateStock: () => void;
  onClearAllStocks: () => void;
  onRestoreStock: (stock: QuickStockRecord) => void;
  onUpdateStock: (stockId?: string, e?: React.MouseEvent) => void;
  onDeleteStock: (stockId: string, e?: React.MouseEvent) => void;
  onMoveStock: (stockId: string, direction: "up" | "down", e?: React.MouseEvent) => void;
  onRenameStock: (stockId: string, newName: string) => void;
  t: (en: string, ja: string) => string;
}

export const StockPanel: React.FC<StockPanelProps> = ({
  quickStocks,
  activeStockId,
  onCreateStock,
  onClearAllStocks,
  onRestoreStock,
  onUpdateStock,
  onDeleteStock,
  onMoveStock,
  onRenameStock,
  t,
}) => {
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockName, setEditingStockName] = useState("");

  return (
    <div className="flex flex-col gap-2.5 h-full w-full min-w-0 text-[11px]">
      {/* ACTION BAR: CREATE & CLEAR */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCreateStock}
          className="flex-1 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-xs transition-all shadow-xs cursor-pointer"
          title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
        >
          <Zap size={12} className="fill-amber-400 text-amber-400" />
          <span>{t("+ STORE CURRENT POSITION", "+ 現在の位置をストック")}</span>
        </button>
        {quickStocks.length > 0 && (
          <button
            type="button"
            onClick={onClearAllStocks}
            className="px-2 py-1.5 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[9px] font-mono transition-all rounded-xs cursor-pointer"
            title={t("Clear all quick stocks", "全ストックを削除")}
          >
            {t("CLEAR", "全消去")}
          </button>
        )}
      </div>

      {/* STOCKS LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
        {quickStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted font-mono text-[10px] gap-2 border border-dashed border-panel-border/60 rounded p-4">
            <Zap size={20} className="text-amber-500/40" />
            <span>{t("NO STOCKS SAVED", "ストックがありません")}</span>
            <span className="text-[9px] text-text-muted/80 leading-relaxed">
              {t("Save scroll positions at mid or bottom and jump back anytime.", "閲覧中の中段・下段の位置を何件でも記録し、いつでもワンクリックで再現できます。")}
            </span>
          </div>
        ) : (
          quickStocks.map((stk, idx) => {
            const isEditing = editingStockId === stk.id;
            const pct = Math.round(stk.scrollRatio * 100);
            const isActive = activeStockId === stk.id;
            return (
              <div
                key={stk.id}
                className={cn(
                  "group flex flex-col gap-1 p-2 rounded-none transition-all text-[10px] select-none border",
                  isActive
                    ? "bg-accent/15 border-2 border-accent shadow-xs ring-1 ring-accent/40"
                    : "bg-panel-bg/90 hover:bg-panel-bg border-panel-border hover:border-accent"
                )}
              >
                {/* TOP: NAME & POSITION BADGE */}
                <div className="flex items-center justify-between gap-1.5">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingStockName}
                      onChange={(e) => setEditingStockName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameStock(stk.id, editingStockName);
                          setEditingStockId(null);
                        } else if (e.key === "Escape") {
                          setEditingStockId(null);
                        }
                      }}
                      onBlur={() => {
                        onRenameStock(stk.id, editingStockName);
                        setEditingStockId(null);
                      }}
                      className="flex-1 bg-black/40 border border-accent px-1 py-0.5 text-text-primary text-[10px] rounded-none outline-none font-mono"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestoreStock(stk)}
                      className={cn(
                        "flex-1 text-left font-mono font-bold truncate cursor-pointer transition-colors flex items-center gap-1.5",
                        isActive ? "text-accent" : "text-text-primary hover:text-accent"
                      )}
                      title={t("Click to jump to this position", "クリックしてこの位置へジャンプ")}
                    >
                      {isActive && (
                        <span className="w-1.5 h-1.5 bg-accent shrink-0 inline-block" title="ACTIVE" />
                      )}
                      <span className="truncate">{stk.name}</span>
                    </button>
                  )}
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded-none font-bold uppercase",
                      isActive
                        ? "bg-accent text-accent-text border border-accent"
                        : pct <= 5
                        ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                        : pct >= 95
                        ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                        : "bg-panel-border/40 text-text-secondary border border-panel-border"
                    )}
                  >
                    {pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
                  </span>
                </div>

                {/* BOTTOM: META INFO & ACTIONS */}
                <div className="flex items-center justify-between text-text-muted text-[9px] font-mono pt-0.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{stk.datasetName || stk.categoryName || "ALL"}</span>
                    <span className="opacity-40">•</span>
                    <span className="uppercase">{stk.viewMode.replace("grid-", "")}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* MOVE UP */}
                    <button
                      type="button"
                      onClick={(e) => onMoveStock(stk.id, "up", e)}
                      disabled={idx === 0}
                      className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                      title={t("Move up in list", "上へ並び替え")}
                    >
                      <ArrowUp size={10} />
                    </button>
                    {/* MOVE DOWN */}
                    <button
                      type="button"
                      onClick={(e) => onMoveStock(stk.id, "down", e)}
                      disabled={idx === quickStocks.length - 1}
                      className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                      title={t("Move down in list", "下へ並び替え")}
                    >
                      <ArrowDown size={10} />
                    </button>
                    {/* OVERWRITE / UPDATE */}
                    <button
                      type="button"
                      onClick={(e) => onUpdateStock(stk.id, e)}
                      className={cn(
                        "p-1 transition-all cursor-pointer rounded-none",
                        isActive
                          ? "text-accent bg-accent/25 hover:bg-accent hover:text-accent-text border border-accent font-bold"
                          : "text-text-muted hover:text-accent border border-transparent"
                      )}
                      title={t("Overwrite with current scroll position", "現在の位置で上書き更新")}
                    >
                      <RefreshCw size={11} />
                    </button>
                    {/* EDIT NAME */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingStockId(stk.id);
                        setEditingStockName(stk.name);
                      }}
                      className="p-1 hover:text-text-primary transition-colors cursor-pointer"
                      title={t("Rename stock", "名前を変更")}
                    >
                      <Edit2 size={10} />
                    </button>
                    {/* DELETE */}
                    <button
                      type="button"
                      onClick={(e) => onDeleteStock(stk.id, e)}
                      className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                      title={t("Delete stock", "削除")}
                    >
                      <X size={10} />
                    </button>
                    {/* JUMP BUTTON */}
                    <button
                      type="button"
                      onClick={() => onRestoreStock(stk)}
                      className={cn(
                        "px-1.5 py-0.5 rounded-none font-bold text-[9px] transition-colors ml-0.5 cursor-pointer",
                        isActive
                          ? "bg-accent text-accent-text border border-accent shadow-xs"
                          : "bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40"
                      )}
                      title={t("Restore this view and jump to scroll position", "この位置へ復元ジャンプ")}
                    >
                      JUMP
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
