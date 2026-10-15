import React from "react";
import {
  Zap,
  X,
  RefreshCw,
  Plus,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { QuickStockRecord } from "./types";

export interface StockRibbonProps {
  isVisible: boolean;
  onClose: () => void;
  quickStocks: QuickStockRecord[];
  activeStockId: string | null;
  checkStockStatus: (stock: QuickStockRecord) => { exists: boolean; reason?: string };
  onCreateStock: () => void;
  onRestoreStock: (stock: QuickStockRecord) => void;
  onUpdateStock: (id?: string, e?: React.MouseEvent) => void;
  onDeleteStock: (id: string, e?: React.MouseEvent) => void;
  t: (en: string, jp: string) => string;
}

export const StockRibbon: React.FC<StockRibbonProps> = ({
  isVisible,
  onClose,
  quickStocks,
  activeStockId,
  checkStockStatus,
  onCreateStock,
  onRestoreStock,
  onUpdateStock,
  onDeleteStock,
  t,
}) => {
  if (!isVisible || quickStocks.length === 0) return null;

  const isStockRibbonVisible = isVisible;
  const setIsStockRibbonVisible = (v: boolean) => {
    if (!v) onClose();
  };
  const handleCreateQuickStock = onCreateStock;
  const handleRestoreQuickStock = onRestoreStock;
  const handleUpdateQuickStock = onUpdateStock;
  const handleDeleteQuickStock = onDeleteStock;

  return (
                  <div className="w-full bg-root-bg/95 border-b border-panel-border/70 px-4 py-1.5 flex items-center justify-between gap-2 text-xs font-mono shrink-0 select-none z-20 overflow-x-auto scrollbar-dark">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto py-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-text-muted font-bold uppercase tracking-wider shrink-0 mr-1">
                        <Zap size={11} className="text-accent" />
                        <span>{t("STOCKS", "ストック")}:</span>
                      </div>

                      {/* Stock Square Tiles */}
                      {quickStocks.map((stk, idx) => {
                        const status = checkStockStatus(stk);
                        const isActive = activeStockId === stk.id;
                        const pct = Math.round(stk.scrollRatio * 100);
                        const posText = pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`;

                        return (
                          <div
                            key={stk.id}
                            onClick={() => handleRestoreQuickStock(stk)}
                            className={cn(
                              "group relative flex items-center gap-1.5 px-2 py-1 rounded-xs border text-[10px] font-mono shrink-0 cursor-pointer transition-all select-none shadow-2xs",
                              !status.exists
                                ? "opacity-60 bg-red-950/20 border-red-500/40 text-red-300"
                                : isActive
                                ? "bg-accent text-accent-text border-accent font-bold ring-1 ring-accent"
                                : "bg-panel-bg hover:bg-white/5 border-panel-border hover:border-accent text-text-secondary hover:text-text-primary"
                            )}
                            title={status.exists ? `${stk.name} (クリックしてジャンプ)` : `${stk.name} [${status.reason}]`}
                          >
                            <span className={cn(
                              "text-[9px] px-1 py-0 rounded-2xs font-bold",
                              isActive ? "bg-black/30 text-accent-text" : "bg-panel-border/60 text-text-muted"
                            )}>
                              #{idx + 1}
                            </span>
                            <span className="max-w-[120px] truncate">
                              {stk.name}
                            </span>
                            <span className={cn(
                              "text-[8px] px-1 py-0 rounded font-bold uppercase",
                              isActive ? "bg-black/20 text-accent-text" : "bg-panel-border/60 text-text-muted"
                            )}>
                              {!status.exists ? "DEL" : posText}
                            </span>

                            {/* Mini update & delete action buttons on tile */}
                            <div className="flex items-center gap-0.5 ml-0.5 opacity-60 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                className={cn(
                                  "p-0.5 hover:scale-110 transition-transform cursor-pointer",
                                  isActive ? "hover:text-black" : "hover:text-accent"
                                )}
                                title={t("Overwrite this stock with current scroll position", "現在の位置で上書き更新")}
                              >
                                <RefreshCw size={9} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                className={cn(
                                  "p-0.5 hover:scale-110 transition-transform cursor-pointer",
                                  isActive ? "hover:text-black" : "hover:text-red-400"
                                )}
                                title={t("Delete stock", "削除")}
                              >
                                <X size={9} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ribbon Controls: Toggle visibility */}
                    <div className="flex items-center gap-1 shrink-0 text-[10px] pl-1 border-l border-panel-border">
                      <button
                        type="button"
                        onClick={() => setIsStockRibbonVisible(false)}
                        className="px-1.5 py-0.5 text-text-muted hover:text-text-primary text-[9px] transition-colors cursor-pointer"
                        title={t("Hide stock ribbon", "ストックバーを閉じる")}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
  );
};
