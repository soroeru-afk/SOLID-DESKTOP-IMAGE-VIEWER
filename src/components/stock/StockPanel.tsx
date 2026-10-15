import React from "react";
import {
  Zap,
  X,
  Pin,
  RefreshCw,
  AlertTriangle,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Edit2,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { QuickStockRecord } from "./types";

export interface StockPanelProps {
  quickStocks: QuickStockRecord[];
  activeStockId: string | null;
  checkStockStatus: (stock: QuickStockRecord) => { exists: boolean; reason?: string };
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

export const StockPanel: React.FC<StockPanelProps> = ({
  quickStocks,
  activeStockId,
  checkStockStatus,
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
  const handleCreateQuickStock = onCreateStock;
  const handleClearAllQuickStocks = onClearAllStocks;
  const cleanupInvalidStocks = onCleanupInvalidStocks;
  const handleRenameQuickStock = onRenameStock;
  const handleRestoreQuickStock = onRestoreStock;
  const handleUpdateQuickStock = onUpdateStock;
  const handleMoveQuickStock = onMoveStock;
  const handleDeleteQuickStock = onDeleteStock;

  return (() => {
                          const activeStock = quickStocks.find((s) => s.id === activeStockId);
                          const invalidCount = quickStocks.filter((s) => !checkStockStatus(s).exists).length;

                          return (
                            <div className="flex flex-col gap-2 h-full w-full min-w-0 text-[11px]">
                              {/* 1. ACTIVE STOCK BANNER & DIRECT UPDATE BUTTON */}
                              {activeStock && (
                                <div className="p-2 bg-accent/10 border border-accent/40 rounded-xs flex items-center justify-between gap-2 shrink-0">
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-accent font-bold font-mono uppercase flex items-center gap-1">
                                        <Pin size={10} /> {t("ACTIVE (VIEWING)", "現在選択中")}
                                      </span>
                                      <span className="text-[9px] px-1 py-0 bg-accent/20 text-accent font-mono font-bold rounded">
                                        {Math.round(activeStock.scrollRatio * 100)}%
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-text-primary truncate font-mono mt-0.5">
                                      {activeStock.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleUpdateQuickStock(activeStock.id, e)}
                                    className="px-2.5 py-1.5 bg-accent text-accent-text hover:bg-accent/90 font-mono text-[10px] font-bold flex items-center gap-1 rounded-xs transition-all shadow-xs shrink-0 cursor-pointer"
                                    title={t("Overwrite selected stock with current scroll position", "現在見ているスクロール位置でこのストックを更新")}
                                  >
                                    <RefreshCw size={11} />
                                    <span>{t("UPDATE NOW", "現在位置で更新")}</span>
                                  </button>
                                </div>
                              )}

                              {/* 2. TOOLBAR: CREATE, VIEW MODE (LIST/TILE), EXPAND HEIGHT, CLEANUP */}
                              <div className="flex items-center justify-between gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={handleCreateQuickStock}
                                  className="flex-1 py-1 px-2 bg-accent/15 hover:bg-accent/25 text-text-primary border border-accent/40 hover:border-accent font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-xs transition-all shadow-xs cursor-pointer"
                                  title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
                                >
                                  <Zap size={11} className="text-accent" />
                                  <span>{t("+ STOCK POSITION", "+ 位置をストック")}</span>
                                </button>

                                {/* LIST / TILE MODE TOGGLE */}
                                <div className="flex items-center border border-panel-border bg-panel-bg rounded-xs overflow-hidden shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setStockDisplayMode("list")}
                                    className={cn(
                                      "px-1.5 py-1 text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer",
                                      stockDisplayMode === "list"
                                        ? "bg-accent text-accent-text font-bold"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                    title={t("Detailed List View", "詳細リスト表示")}
                                  >
                                    <List size={10} />
                                    <span>LIST</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setStockDisplayMode("tile")}
                                    className={cn(
                                      "px-1.5 py-1 text-[9px] font-mono transition-colors flex items-center gap-1 cursor-pointer",
                                      stockDisplayMode === "tile"
                                        ? "bg-accent text-accent-text font-bold"
                                        : "text-text-muted hover:text-text-primary"
                                    )}
                                    title={t("Compact Tile View (Quick Jump Cards)", "四角いタイル簡易表示（ワンクリックで即移動）")}
                                  >
                                    <LayoutGrid size={10} />
                                    <span>TILE</span>
                                  </button>
                                </div>

                                {/* EXPAND HEIGHT (PULL UP) TOGGLE */}
                                <button
                                  type="button"
                                  onClick={() => setIsStockPanelExpanded((prev) => !prev)}
                                  className={cn(
                                    "px-1.5 py-1 text-[9px] font-mono border rounded-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0",
                                    isStockPanelExpanded
                                      ? "border-accent bg-accent/20 text-accent font-bold"
                                      : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                  )}
                                  title={isStockPanelExpanded ? t("Collapse height", "標準の高さに戻す") : t("Expand height upwards (view more)", "上へ広げて全体を見渡す")}
                                >
                                  {isStockPanelExpanded ? <ChevronsDown size={11} /> : <ChevronsUp size={11} />}
                                  <span>{isStockPanelExpanded ? t("NORM", "標準") : t("WIDE", "広げる")}</span>
                                </button>

                                {/* INVALID STOCKS CLEANUP */}
                                {invalidCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleCleanupInvalidStocks}
                                    className="px-1.5 py-1 text-red-400 hover:text-red-300 border border-red-500/40 bg-red-500/10 text-[9px] font-mono transition-all rounded-xs cursor-pointer shrink-0"
                                    title={t("Remove stocks whose datasets or folders have been deleted", "削除済みフォルダ・リストのストックを一括消去")}
                                  >
                                    {t(`CLEAN (${invalidCount})`, `整理 (${invalidCount})`)}
                                  </button>
                                )}

                                {quickStocks.length > 0 && invalidCount === 0 && (
                                  <button
                                    type="button"
                                    onClick={handleClearAllQuickStocks}
                                    className="px-1.5 py-1 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[9px] font-mono transition-all rounded-xs cursor-pointer shrink-0"
                                    title={t("Clear all quick stocks", "全ストックを削除")}
                                  >
                                    {t("CLEAR", "消去")}
                                  </button>
                                )}
                              </div>

                              {/* 3. STOCKS CONTAINER (LIST or TILE) */}
                              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                                {quickStocks.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted font-mono text-[10px] gap-2 border border-dashed border-panel-border/60 rounded p-4">
                                    <Zap size={20} className="text-text-muted" />
                                    <span>{t("NO STOCKS SAVED", "ストックがありません")}</span>
                                    <span className="text-[9px] text-text-muted/80 leading-relaxed">
                                      {t("Save scroll positions at mid or bottom and jump back anytime.", "閲覧中の中段・下段の位置を何件でも記録し、いつでもワンクリックで再現できます。")}
                                    </span>
                                  </div>
                                ) : stockDisplayMode === "tile" ? (
                                  /* === TILE VIEW MODE === */
                                  <div className={cn(
                                    "grid gap-1.5",
                                    isStockPanelExpanded ? "grid-cols-3" : "grid-cols-2"
                                  )}>
                                    {quickStocks.map((stk, idx) => {
                                      const status = checkStockStatus(stk);
                                      const isActive = activeStockId === stk.id;
                                      const pct = Math.round(stk.scrollRatio * 100);
                                      const posLabel = pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`;

                                      return (
                                        <div
                                          key={stk.id}
                                          onClick={() => handleRestoreQuickStock(stk)}
                                          className={cn(
                                            "group relative flex flex-col justify-between p-2 rounded-xs border transition-all cursor-pointer text-[10px] select-none min-h-[64px]",
                                            !status.exists
                                              ? "opacity-60 bg-red-950/20 border-red-500/40 hover:border-red-400"
                                              : isActive
                                              ? "bg-accent/15 border-accent text-text-primary ring-1 ring-accent shadow-xs"
                                              : "bg-panel-bg hover:bg-root-bg border-panel-border hover:border-accent/60 text-text-secondary hover:text-text-primary"
                                          )}
                                          title={status.exists ? `${stk.name} (クリックしてジャンプ)` : `${stk.name} [${status.reason}]`}
                                        >
                                          {/* TILE HEADER: INDEX, STATUS / POSITION */}
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
                                                  NOW
                                                </span>
                                              )}
                                            </div>

                                            <span className={cn(
                                              "font-mono text-[9px] px-1 py-0.2 rounded font-bold uppercase",
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

                                          {/* TILE TITLE */}
                                          <div className="my-1">
                                            <span className="font-mono font-bold text-text-primary line-clamp-1 leading-tight text-[10px] group-hover:text-accent transition-colors">
                                              {stk.name}
                                            </span>
                                            <span className="text-[8px] text-text-muted font-mono truncate block">
                                              {stk.datasetName || stk.categoryName || "ALL"}
                                            </span>
                                          </div>

                                          {/* TILE FOOTER: ACTIONS (UPDATE / DELETE) */}
                                          <div className="flex items-center justify-between pt-1 border-t border-panel-border/40 text-[9px] font-mono text-text-muted">
                                            <span className="uppercase text-[8px] opacity-75">
                                              {stk.viewMode.replace("grid-", "")}
                                            </span>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                                className="p-0.5 hover:text-accent transition-colors cursor-pointer"
                                                title={t("Overwrite this stock with current scroll position", "現在の位置で上書き更新")}
                                              >
                                                <RefreshCw size={10} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                                className="p-0.5 hover:text-red-400 transition-colors cursor-pointer"
                                                title={t("Delete stock", "削除")}
                                              >
                                                <X size={10} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* === LIST VIEW MODE === */
                                  <div className="flex flex-col gap-1.5">
                                    {quickStocks.map((stk, idx) => {
                                      const status = checkStockStatus(stk);
                                      const isEditing = editingStockId === stk.id;
                                      const isActive = activeStockId === stk.id;
                                      const pct = Math.round(stk.scrollRatio * 100);

                                      return (
                                        <div
                                          key={stk.id}
                                          className={cn(
                                            "group flex flex-col gap-1 p-2 rounded-xs border transition-all text-[10px] select-none",
                                            !status.exists
                                              ? "opacity-60 bg-red-950/20 border-red-500/40"
                                              : isActive
                                              ? "bg-accent/10 border-accent ring-1 ring-accent"
                                              : "bg-panel-bg/90 hover:bg-panel-bg border-panel-border hover:border-accent/50"
                                          )}
                                        >
                                          {/* TOP: NAME & POSITION BADGE */}
                                          <div className="flex items-center justify-between gap-1.5">
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
                                                className="flex-1 bg-black/40 border border-accent px-1 py-0.5 text-text-primary text-[10px] rounded outline-none font-mono"
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleRestoreQuickStock(stk)}
                                                className={cn(
                                                  "flex-1 text-left font-mono font-bold truncate cursor-pointer transition-colors",
                                                  isActive ? "text-accent" : "text-text-primary hover:text-accent"
                                                )}
                                                title={status.exists ? t("Click to jump to this position", "クリックしてこの位置へジャンプ") : status.reason}
                                              >
                                                {stk.name}
                                              </button>
                                            )}

                                            {isActive && (
                                              <span className="shrink-0 text-[8px] bg-accent/20 text-accent border border-accent/40 px-1 py-0 rounded font-bold font-mono">
                                                ACTIVE
                                              </span>
                                            )}

                                            <span
                                              className={cn(
                                                "shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase",
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
                                                onClick={(e) => handleMoveQuickStock(stk.id, "up", e)}
                                                disabled={idx === 0}
                                                className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                                                title={t("Move up in list", "上へ並び替え")}
                                              >
                                                <ArrowUp size={10} />
                                              </button>
                                              {/* MOVE DOWN */}
                                              <button
                                                type="button"
                                                onClick={(e) => handleMoveQuickStock(stk.id, "down", e)}
                                                disabled={idx === quickStocks.length - 1}
                                                className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors cursor-pointer"
                                                title={t("Move down in list", "下へ並び替え")}
                                              >
                                                <ArrowDown size={10} />
                                              </button>
                                              {/* OVERWRITE / UPDATE */}
                                              <button
                                                type="button"
                                                onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                                className="p-1 text-text-muted hover:text-accent transition-colors cursor-pointer"
                                                title={t("Overwrite with current scroll position", "現在の位置で上書き更新")}
                                              >
                                                <RefreshCw size={10} />
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
                                                onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                                className="p-1 hover:text-red-400 transition-colors cursor-pointer"
                                                title={t("Delete stock", "削除")}
                                              >
                                                <X size={10} />
                                              </button>
                                              {/* JUMP BUTTON */}
                                              <button
                                                type="button"
                                                onClick={() => handleRestoreQuickStock(stk)}
                                                className="px-1.5 py-0.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40 rounded-xs font-bold text-[9px] transition-colors ml-0.5 cursor-pointer"
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
                            </div>
                          );

  })();
};
