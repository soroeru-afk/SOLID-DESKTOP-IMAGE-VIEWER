import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, X, ArrowUp, ArrowDown, RefreshCw, Edit2 } from "lucide-react";
import { QuickStockRecord } from "./types";
import { cn } from "../../lib/utils";
import { SolidButton } from "../ui";

interface StockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

export const StockDrawer: React.FC<StockDrawerProps> = ({
  isOpen,
  onClose,
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-panel-bg border border-amber-500/40 w-[520px] max-w-[96vw] max-h-[85vh] flex flex-col font-mono shadow-[0_0_35px_rgba(245,158,11,0.15)] rounded-xs overflow-hidden"
          >
            {/* DRAWER HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border/80 bg-root-bg/60 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-xs bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                  <Zap size={13} className="fill-amber-400 text-amber-400" />
                </div>
                <span className="text-sm font-bold tracking-wider text-text-primary uppercase">
                  {t("QUICK STOCK", "クイックストック")}
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-bold">
                  {quickStocks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 rounded-xs transition-colors cursor-pointer"
                title="CLOSE"
              >
                <X size={15} />
              </button>
            </div>

            {/* ACTION BAR */}
            <div className="p-3 border-b border-panel-border/60 bg-panel-bg flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onCreateStock}
                className="flex-1 py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 text-xs font-bold flex items-center justify-center gap-2 rounded-xs transition-all shadow-xs cursor-pointer"
                title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
              >
                <Zap size={14} className="fill-amber-400 text-amber-400" />
                <span>{t("+ STORE CURRENT SCROLL POSITION", "+ 現在の閲覧位置をストック保存")}</span>
              </button>
              {quickStocks.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllStocks}
                  className="px-2.5 py-2 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[10px] transition-all rounded-xs cursor-pointer"
                  title={t("Clear all quick stocks", "全ストックを削除")}
                >
                  {t("CLEAR ALL", "全消去")}
                </button>
              )}
            </div>

            {/* STOCKS LIST CONTAINER */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[160px]">
              {quickStocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted text-xs gap-2.5 border border-dashed border-panel-border/60 rounded p-6 my-auto">
                  <Zap size={28} className="text-amber-500/40" />
                  <span className="font-bold text-text-primary">{t("NO STOCKS SAVED", "ストックが記録されていません")}</span>
                  <span className="text-[11px] text-text-muted/80 max-w-sm leading-relaxed">
                    {t(
                      "Click '+ STORE CURRENT SCROLL POSITION' or use the 'STOCK POSITION' button on the breadcrumbs bar to save your exact scroll state at mid or bottom. Jump back anytime with 1 click.",
                      "一覧表示中に「+ 現在の閲覧位置をストック保存」またはパンくずバーの「位置をストック」を押すと、中段や下段のスクロール位置を何件でも記録できます。いつでもワンクリックでその場所へ復元できます。"
                    )}
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
                        "group flex flex-col gap-1.5 p-2.5 rounded-none transition-all text-[11px] select-none border",
                        isActive
                          ? "bg-accent/15 border-2 border-accent shadow-xs ring-1 ring-accent/40"
                          : "bg-root-bg/50 hover:bg-root-bg/80 border-panel-border hover:border-accent"
                      )}
                    >
                      {/* TOP ROW: NAME & POSITION BADGE */}
                      <div className="flex items-center justify-between gap-2">
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
                            className="flex-1 bg-black/50 border border-accent px-1.5 py-0.5 text-text-primary text-[11px] rounded-none outline-none font-mono"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreStock(stk);
                              onClose();
                            }}
                            className={cn(
                              "flex-1 text-left font-bold truncate cursor-pointer transition-colors flex items-center gap-1.5 font-mono",
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
                            "shrink-0 text-[10px] px-2 py-0.5 rounded-none font-bold uppercase font-mono",
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

                      {/* BOTTOM ROW: META & ACTIONS */}
                      <div className="flex items-center justify-between text-text-muted text-[10px] pt-0.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate text-text-secondary font-bold">
                            {stk.datasetName || stk.categoryName || "ALL"}
                          </span>
                          <span className="opacity-40">•</span>
                          <span className="uppercase">{stk.viewMode.replace("grid-", "")}</span>
                          <span className="opacity-40">•</span>
                          <span>{new Date(stk.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* MOVE UP */}
                          <button
                            type="button"
                            onClick={(e) => onMoveStock(stk.id, "up", e)}
                            disabled={idx === 0}
                            className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                            title={t("Move up in list", "上へ並び替え")}
                          >
                            <ArrowUp size={12} />
                          </button>
                          {/* MOVE DOWN */}
                          <button
                            type="button"
                            onClick={(e) => onMoveStock(stk.id, "down", e)}
                            disabled={idx === quickStocks.length - 1}
                            className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                            title={t("Move down in list", "下へ並び替え")}
                          >
                            <ArrowDown size={12} />
                          </button>
                          {/* OVERWRITE */}
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
                            <RefreshCw size={12} />
                          </button>
                          {/* RENAME */}
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
                            <Edit2 size={12} />
                          </button>
                          {/* DELETE */}
                          <button
                            type="button"
                            onClick={(e) => onDeleteStock(stk.id, e)}
                            className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                            title={t("Delete stock", "削除")}
                          >
                            <X size={12} />
                          </button>
                          {/* JUMP BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreStock(stk);
                              onClose();
                            }}
                            className={cn(
                              "px-2.5 py-0.5 rounded-none font-bold text-[10px] transition-colors ml-1 cursor-pointer",
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

            {/* DRAWER FOOTER */}
            <div className="px-4 py-2.5 border-t border-panel-border/80 bg-root-bg/40 flex items-center justify-between text-[10px] text-text-muted shrink-0">
              <span>{t("QUICK STOCK ENGINE", "クイックストック機能")}</span>
              <SolidButton
                onClick={onClose}
                className="px-3 py-1 text-[10px] bg-transparent border-panel-border text-text-secondary hover:text-text-primary"
              >
                {t("CLOSE", "閉じる")}
              </SolidButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
