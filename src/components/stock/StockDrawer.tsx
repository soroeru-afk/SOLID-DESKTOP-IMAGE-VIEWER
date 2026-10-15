import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  X,
  Minimize,
  Maximize,
  Pin,
  RefreshCw,
  AlertTriangle,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Edit2,
  LayoutGrid,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SolidButton } from "../ui";
import { QuickStockRecord } from "./types";

export interface StockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quickStocks: QuickStockRecord[];
  activeStockId: string | null;
  checkStockStatus: (stock: QuickStockRecord) => { exists: boolean; reason?: string };
  isDrawerExpanded: boolean;
  setIsDrawerExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  stockDisplayMode: "list" | "tile";
  setStockDisplayMode: React.Dispatch<React.SetStateAction<"list" | "tile">>;
  onCreateStock: () => void;
  onClearAllStocks: () => void;
  onCleanupInvalidStocks?: () => void;
  editingStockId: string | null;
  setEditingStockId: (id: string | null) => void;
  editingStockName: string;
  setEditingStockName: (name: string) => void;
  onRenameStock: (id: string, newName: string) => void;
  onRestoreStock: (stock: QuickStockRecord) => void;
  onUpdateStock: (id?: string, e?: React.MouseEvent) => void;
  onMoveStock: (id: string, direction: "up" | "down", e?: React.MouseEvent) => void;
  onDeleteStock: (id: string, e?: React.MouseEvent) => void;
  t: (en: string, jp: string) => string;
}

export const StockDrawer: React.FC<StockDrawerProps> = ({
  isOpen,
  onClose,
  quickStocks,
  activeStockId,
  checkStockStatus,
  isDrawerExpanded,
  setIsDrawerExpanded,
  stockDisplayMode,
  setStockDisplayMode,
  onCreateStock,
  onClearAllStocks,
  onCleanupInvalidStocks,
  editingStockId,
  setEditingStockId,
  editingStockName,
  setEditingStockName,
  onRenameStock,
  onRestoreStock,
  onUpdateStock,
  onMoveStock,
  onDeleteStock,
  t,
}) => {
  const isQuickStockDrawerOpen = isOpen;
  const setIsQuickStockDrawerOpen = (open: boolean) => {
    if (!open) onClose();
  };
  const handleCreateQuickStock = onCreateStock;
  const handleClearAllQuickStocks = onClearAllStocks;
  const handleCleanupInvalidStocks = onCleanupInvalidStocks;
  const cleanupInvalidStocks = onCleanupInvalidStocks;
  const handleRenameQuickStock = onRenameStock;
  const handleRestoreQuickStock = onRestoreStock;
  const handleUpdateQuickStock = onUpdateStock;
  const handleMoveQuickStock = onMoveStock;
  const handleDeleteQuickStock = onDeleteStock;

  return (
    <AnimatePresence>
      {isQuickStockDrawerOpen && (() => {
          const activeStock = quickStocks.find((s) => s.id === activeStockId);
          const invalidCount = quickStocks.filter((s) => !checkStockStatus(s).exists).length;

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-root-bg/75 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setIsQuickStockDrawerOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "bg-panel-bg border border-panel-border flex flex-col font-mono shadow-2xl rounded-xs overflow-hidden transition-all duration-200",
                  isDrawerExpanded ? "w-[840px] max-w-[96vw] h-[88vh]" : "w-[540px] max-w-[96vw] max-h-[85vh]"
                )}
              >
                {/* DRAWER HEADER */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border/80 bg-root-bg/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-xs bg-accent/20 border border-accent/40 flex items-center justify-center">
                      <Zap size={13} className="text-accent" />
                    </div>
                    <span className="text-sm font-bold tracking-wider text-text-primary uppercase">
                      {t("QUICK STOCK", "クイックストック")}
                    </span>
                    <span className="text-[10px] bg-accent/20 text-accent border border-accent/40 px-1.5 py-0.2 rounded font-bold">
                      {quickStocks.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* EXPAND / SHRINK MODAL */}
                    <button
                      type="button"
                      onClick={() => setIsDrawerExpanded((prev) => !prev)}
                      className="px-2 py-1 text-[10px] border border-panel-border bg-panel-bg text-text-secondary hover:text-text-primary rounded-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title={isDrawerExpanded ? t("Standard size", "標準サイズに戻す") : t("Maximize view (view all)", "広げて全ストックを見渡す")}
                    >
                      {isDrawerExpanded ? <Minimize size={12} /> : <Maximize size={12} />}
                      <span>{isDrawerExpanded ? t("NORM", "標準") : t("WIDE", "広げる")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsQuickStockDrawerOpen(false)}
                      className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 rounded-xs transition-colors cursor-pointer"
                      title="CLOSE"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* 1. ACTIVE STOCK BANNER & DIRECT UPDATE BUTTON */}
                {activeStock && (
                  <div className="p-3 bg-accent/10 border-b border-accent/30 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-accent font-bold font-mono uppercase flex items-center gap-1">
                          <Pin size={11} /> {t("CURRENTLY ACTIVE STOCK", "現在閲覧中のストック")}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-accent/20 text-accent font-mono font-bold rounded">
                          {Math.round(activeStock.scrollRatio * 100)}%
                        </span>
                      </div>
                      <span className="text-xs font-bold text-text-primary truncate font-mono mt-0.5">
                        {activeStock.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleUpdateQuickStock(activeStock.id, e)}
                      className="px-3 py-1.5 bg-accent text-accent-text hover:bg-accent/90 font-mono text-[11px] font-bold flex items-center gap-1.5 rounded-xs transition-all shadow-xs shrink-0 cursor-pointer"
                      title={t("Overwrite selected stock with current scroll position", "現在見ているスクロール位置でこのストックを更新")}
                    >
                      <RefreshCw size={12} />
                      <span>{t("UPDATE TO CURRENT POSITION", "現在の位置で更新")}</span>
                    </button>
                  </div>
                )}

                {/* 2. ACTION BAR */}
                <div className="p-2.5 border-b border-panel-border/60 bg-panel-bg flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCreateQuickStock}
                    className="flex-1 py-1.5 px-3 bg-accent/15 hover:bg-accent/25 text-text-primary border border-accent/40 hover:border-accent text-xs font-bold flex items-center justify-center gap-2 rounded-xs transition-all shadow-xs cursor-pointer"
                    title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
                  >
                    <Zap size={13} className="text-accent" />
                    <span>{t("+ STORE CURRENT SCROLL POSITION", "+ 現在の閲覧位置をストック保存")}</span>
                  </button>

                  {/* LIST / TILE MODE TOGGLE */}
                  <div className="flex items-center border border-panel-border bg-root-bg rounded-xs overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setStockDisplayMode("list")}
                      className={cn(
                        "px-2 py-1 text-[10px] font-mono transition-colors flex items-center gap-1 cursor-pointer",
                        stockDisplayMode === "list"
                          ? "bg-accent text-accent-text font-bold"
                          : "text-text-muted hover:text-text-primary"
                      )}
                      title={t("List View", "リスト表示")}
                    >
                      <List size={11} />
                      <span>LIST</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockDisplayMode("tile")}
                      className={cn(
                        "px-2 py-1 text-[10px] font-mono transition-colors flex items-center gap-1 cursor-pointer",
                        stockDisplayMode === "tile"
                          ? "bg-accent text-accent-text font-bold"
                          : "text-text-muted hover:text-text-primary"
                      )}
                      title={t("Tile View (Compact square stock cards)", "四角いタイル簡易表示（一望・即ジャンプ）")}
                    >
                      <LayoutGrid size={11} />
                      <span>TILE</span>
                    </button>
                  </div>

                  {/* CLEANUP BUTTON */}
                  {invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={handleCleanupInvalidStocks}
                      className="px-2.5 py-1.5 text-red-400 hover:text-red-300 border border-red-500/40 bg-red-500/10 text-[10px] font-mono transition-all rounded-xs cursor-pointer shrink-0"
                      title={t("Clean up stocks whose datasets/folders are deleted", "削除されたデータのストックを整理")}
                    >
                      {t(`CLEAN (${invalidCount})`, `整理 (${invalidCount})`)}
                    </button>
                  )}

                  {quickStocks.length > 0 && invalidCount === 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllQuickStocks}
                      className="px-2.5 py-1.5 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[10px] transition-all rounded-xs cursor-pointer shrink-0"
                      title={t("Clear all quick stocks", "全ストックを削除")}
                    >
                      {t("CLEAR ALL", "全消去")}
                    </button>
                  )}
                </div>

                {/* 3. STOCKS CONTAINER */}
                <div className="flex-1 overflow-y-auto p-3 min-h-[180px]">
                  {quickStocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted text-xs gap-2.5 border border-dashed border-panel-border/60 rounded p-6 my-auto">
                      <Zap size={28} className="text-text-muted" />
                      <span className="font-bold text-text-primary">{t("NO STOCKS SAVED", "ストックが記録されていません")}</span>
                      <span className="text-[11px] text-text-muted/80 max-w-sm leading-relaxed">
                        {t(
                          "Click '+ STORE CURRENT SCROLL POSITION' or use the 'STOCK POSITION' button on the breadcrumbs bar to save your exact scroll state at mid or bottom. Jump back anytime with 1 click.",
                          "一覧表示中に「+ 現在の閲覧位置をストック保存」またはパンくずバーの「位置をストック」を押すと、中段や下段のスクロール位置を何件でも記録できます。いつでもワンクリックでその場所へ復元できます。"
                        )}
                      </span>
                    </div>
                  ) : stockDisplayMode === "tile" ? (
                    /* === TILE VIEW IN DRAWER === */
                    <div className={cn(
                      "grid gap-2",
                      isDrawerExpanded ? "grid-cols-4" : "grid-cols-3"
                    )}>
                      {quickStocks.map((stk, idx) => {
                        const status = checkStockStatus(stk);
                        const isActive = activeStockId === stk.id;
                        const pct = Math.round(stk.scrollRatio * 100);
                        const posLabel = pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`;

                        return (
                          <div
                            key={stk.id}
                            onClick={() => {
                              handleRestoreQuickStock(stk);
                              setIsQuickStockDrawerOpen(false);
                            }}
                            className={cn(
                              "group relative flex flex-col justify-between p-2.5 rounded-xs border transition-all cursor-pointer text-[11px] select-none min-h-[78px]",
                              !status.exists
                                ? "opacity-60 bg-red-950/20 border-red-500/40 hover:border-red-400"
                                : isActive
                                ? "bg-accent/15 border-accent text-text-primary ring-1 ring-accent shadow-xs"
                                : "bg-root-bg/60 hover:bg-root-bg border-panel-border hover:border-accent text-text-secondary hover:text-text-primary"
                            )}
                            title={status.exists ? `${stk.name} (クリックしてジャンプ)` : `${stk.name} [${status.reason}]`}
                          >
                            {/* TOP: INDEX & POSITION */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 font-mono">
                                <span className={cn(
                                  "font-bold text-[9px] px-1 py-0.2 rounded-2xs",
                                  isActive ? "bg-accent text-accent-text" : "bg-panel-border/60 text-text-muted"
                                )}>
                                  #{idx + 1}
                                </span>
                                {isActive && (
                                  <span className="text-[8px] text-accent font-bold tracking-tight uppercase">
                                    ACTIVE
                                  </span>
                                )}
                              </div>

                              <span className={cn(
                                "font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase",
                                !status.exists
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30 text-[8px]"
                                  : pct <= 5
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : pct >= 95
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                  : "bg-panel-border/60 text-text-primary border border-panel-border"
                              )}>
                                {!status.exists ? t("MISSING", "削除済") : posLabel}
                              </span>
                            </div>

                            {/* TITLE & META */}
                            <div className="my-1.5">
                              <span className="font-mono font-bold text-text-primary line-clamp-1 leading-tight text-[11px] group-hover:text-accent transition-colors">
                                {stk.name}
                              </span>
                              <span className="text-[9px] text-text-muted font-mono truncate block mt-0.5">
                                {stk.datasetName || stk.categoryName || "ALL"}
                              </span>
                            </div>

                            {/* FOOTER: MODE & ACTIONS */}
                            <div className="flex items-center justify-between pt-1 border-t border-panel-border/40 text-[9px] font-mono text-text-muted">
                              <span className="uppercase text-[9px] opacity-75">
                                {stk.viewMode.replace("grid-", "")}
                              </span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                  className="p-1 hover:text-accent transition-colors cursor-pointer"
                                  title={t("Overwrite this stock with current scroll position", "現在の位置で上書き更新")}
                                >
                                  <RefreshCw size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                  className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                                  title={t("Delete stock", "削除")}
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* === LIST VIEW IN DRAWER === */
                    <div className="flex flex-col gap-2">
                      {quickStocks.map((stk, idx) => {
                        const status = checkStockStatus(stk);
                        const isEditing = editingStockId === stk.id;
                        const isActive = activeStockId === stk.id;
                        const pct = Math.round(stk.scrollRatio * 100);

                        return (
                          <div
                            key={stk.id}
                            className={cn(
                              "group flex flex-col gap-1.5 p-2.5 rounded-xs border transition-all text-[11px] select-none",
                              !status.exists
                                ? "opacity-60 bg-red-950/20 border-red-500/40"
                                : isActive
                                ? "bg-accent/10 border-accent ring-1 ring-accent"
                                : "bg-root-bg/50 hover:bg-root-bg/80 border-panel-border hover:border-accent/60"
                            )}
                          >
                            {/* TOP ROW: NAME & POSITION BADGE */}
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "font-mono text-[9px] px-1 py-0.2 rounded-2xs font-bold shrink-0",
                                isActive ? "bg-accent text-accent-text" : "bg-panel-border/60 text-text-muted"
                              )}>
                                #{idx + 1}
                              </span>

                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingStockName}
                                  onChange={(e) => setEditingStockName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleRenameQuickStock(stk.id, editingStockName);
                                      setEditingStockId(null);
                                    } else if (e.key === "Escape") {
                                      setEditingStockId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    handleRenameQuickStock(stk.id, editingStockName);
                                    setEditingStockId(null);
                                  }}
                                  className="flex-1 bg-black/50 border border-accent px-1.5 py-0.5 text-text-primary text-[11px] rounded outline-none"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRestoreQuickStock(stk);
                                    setIsQuickStockDrawerOpen(false);
                                  }}
                                  className={cn(
                                    "flex-1 text-left font-bold truncate cursor-pointer transition-colors",
                                    isActive ? "text-accent" : "text-text-primary hover:text-accent"
                                  )}
                                  title={status.exists ? t("Click to jump to this position", "クリックしてこの位置へジャンプ") : status.reason}
                                >
                                  {stk.name}
                                </button>
                              )}

                              {isActive && (
                                <span className="shrink-0 text-[8px] bg-accent/20 text-accent border border-accent/40 px-1.5 py-0 rounded font-bold font-mono">
                                  ACTIVE
                                </span>
                              )}

                              <span
                                className={cn(
                                  "shrink-0 text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                                  !status.exists
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : pct <= 5
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    : pct >= 95
                                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                    : "bg-panel-border/60 text-text-primary border border-panel-border"
                                )}
                              >
                                {!status.exists ? t("MISSING", "削除済") : pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
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
                                <span>{new Date(stk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* MOVE UP */}
                                <button
                                  type="button"
                                  onClick={(e) => handleMoveQuickStock(stk.id, "up", e)}
                                  disabled={idx === 0}
                                  className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                                  title={t("Move up in list", "上へ並び替え")}
                                >
                                  <ArrowUp size={12} />
                                </button>
                                {/* MOVE DOWN */}
                                <button
                                  type="button"
                                  onClick={(e) => handleMoveQuickStock(stk.id, "down", e)}
                                  disabled={idx === quickStocks.length - 1}
                                  className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                                  title={t("Move down in list", "下へ並び替え")}
                                >
                                  <ArrowDown size={12} />
                                </button>
                                {/* OVERWRITE */}
                                <button
                                  type="button"
                                  onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                  className="p-1 text-text-muted hover:text-accent transition-colors cursor-pointer"
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
                                  onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                  className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                                  title={t("Delete stock", "削除")}
                                >
                                  <X size={12} />
                                </button>
                                {/* JUMP BUTTON */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRestoreQuickStock(stk);
                                    setIsQuickStockDrawerOpen(false);
                                  }}
                                  className="px-2.5 py-0.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40 rounded-xs font-bold text-[10px] transition-colors ml-1 cursor-pointer"
                                  title={t("Restore this view and jump to scroll position", "この位置へ復元ジャンプ")}
                                >
                                  JUMP
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* DRAWER FOOTER */}
                <div className="px-4 py-2.5 border-t border-panel-border/80 bg-root-bg/40 flex items-center justify-between text-[10px] text-text-muted shrink-0">
                  <span>{t("QUICK STOCK ENGINE", "クイックストック機能")}</span>
                  <SolidButton
                    onClick={() => setIsQuickStockDrawerOpen(false)}
                    className="px-3 py-1 text-[10px] bg-transparent border-panel-border text-text-secondary hover:text-text-primary"
                  >
                    {t("CLOSE", "閉じる")}
                  </SolidButton>
                </div>
              </motion.div>
            </motion.div>
          );

      })()}
    </AnimatePresence>
  );
};
