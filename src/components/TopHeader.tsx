import React from "react";
import {
  ScatterChart,
  Palette,
  WifiOff,
  Download,
  Zap,
  Minimize,
  Maximize,
  PanelLeft,
  PanelRight,
  ExternalLink,
} from "lucide-react";
import { SolidButton } from "./ui";
import { cn } from "../lib/utils";

interface TopHeaderProps {
  itemScale: number;
  setItemScale: (val: number) => void;
  gridGap: number;
  setGridGap: (val: number) => void;
  canvasBg: "theme" | "auto" | "black" | "white" | "checker";
  setCanvasBg: (val: "theme" | "auto" | "black" | "white" | "checker") => void;
  appFont: string;
  setAppFont: (val: any) => void;
  theme: string;
  cycleTheme: () => void;
  language: "EN" | "JP";
  setLanguage: (val: "EN" | "JP") => void;
  isOnline: boolean;
  deferredInstallPrompt: any;
  handleInstallPWA: () => void;
  quickStocksCount: number;
  isQuickStockDrawerOpen: boolean;
  setIsQuickStockDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAppFullscreen: boolean;
  toggleAppFullscreen: () => void;
  sidebarPosition: "left" | "right";
  setSidebarPosition: React.Dispatch<React.SetStateAction<"left" | "right">>;
  t: (en: string, ja: string) => string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  itemScale,
  setItemScale,
  gridGap,
  setGridGap,
  canvasBg,
  setCanvasBg,
  appFont,
  setAppFont,
  theme,
  cycleTheme,
  language,
  setLanguage,
  isOnline,
  deferredInstallPrompt,
  handleInstallPWA,
  quickStocksCount,
  isQuickStockDrawerOpen,
  setIsQuickStockDrawerOpen,
  isAppFullscreen,
  toggleAppFullscreen,
  sidebarPosition,
  setSidebarPosition,
  t,
}) => {
  return (
    <header className="flex justify-between items-center shrink-0 h-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-panel-border flex items-center justify-center rounded-none text-accent">
          <ScatterChart size={18} />
        </div>
        <div className="flex flex-col mr-8 pt-0.5">
          <h1 className="font-sans font-semibold tracking-widest text-lg text-text-primary uppercase leading-none">
            SOLID DESKTOP IMAGE VIEWER
          </h1>
          <span className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest opacity-80">
            v1.1.0 OS
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 h-full mr-4">
        <div className="flex items-center gap-2 h-full">
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">SIZE:</span>
          <div className="w-40 flex items-center">
            <input
              type="range"
              min="40"
              max="900"
              step="1"
              value={itemScale}
              tabIndex={-1}
              onChange={(e) => {
                setItemScale(Number(e.target.value));
              }}
              onMouseUp={(e) => (e.target as HTMLElement).blur()}
              onPointerUp={(e) => (e.target as HTMLElement).blur()}
            />
          </div>
          <span className="text-[10px] font-mono text-text-primary w-10 text-right tabular-nums">{itemScale}px</span>
        </div>

        <div className="flex items-center gap-2 h-full">
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">GAP:</span>
          <div className="w-40 flex items-center">
            <input
              type="range"
              min="0"
              max="160"
              step="1"
              value={gridGap}
              tabIndex={-1}
              onChange={(e) => {
                setGridGap(Number(e.target.value));
              }}
              onMouseUp={(e) => (e.target as HTMLElement).blur()}
              onPointerUp={(e) => (e.target as HTMLElement).blur()}
            />
          </div>
          <span className="text-[10px] font-mono text-text-primary w-10 text-right tabular-nums">{gridGap}px</span>
        </div>

        <div className="flex items-center gap-2 h-full">
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">CANVAS:</span>
          <div className="flex gap-1 h-full py-2 items-center">
            <SolidButton active={canvasBg === "theme"} onClick={() => setCanvasBg("theme")} className="w-[50px] h-6 px-0 py-0 text-[10px] font-mono tracking-tighter">
              THEME
            </SolidButton>
            <SolidButton active={canvasBg === "auto"} onClick={() => setCanvasBg("auto")} className="w-[50px] h-6 px-0 py-0 text-[10px] font-mono tracking-tighter">
              AUTO
            </SolidButton>
            <SolidButton active={canvasBg === "black"} onClick={() => setCanvasBg("black")} className="w-[50px] h-6 px-0 py-0 text-[10px] font-mono tracking-tighter">
              BLK
            </SolidButton>
            <SolidButton active={canvasBg === "white"} onClick={() => setCanvasBg("white")} className="w-[50px] h-6 px-0 py-0 text-[10px] font-mono tracking-tighter">
              WHT
            </SolidButton>
            <SolidButton active={canvasBg === "checker"} onClick={() => setCanvasBg("checker")} className="w-[50px] h-6 px-0 py-0 text-[10px] font-mono tracking-tighter">
              CHK
            </SolidButton>
          </div>
        </div>

        <div className="flex items-center gap-2 h-full">
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">FONT:</span>
          <select
            value={appFont}
            onChange={(e) => setAppFont(e.target.value)}
            className="bg-panel-bg outline-none text-[10px] uppercase font-mono tracking-wider text-text-primary cursor-pointer border h-6 px-2 border-panel-border rounded"
          >
            <option value="GOTHIC">GOTHIC</option>
            <option value="MARU">MARU</option>
            <option value="MEIRYO">MEIRYO</option>
            <option value="MONO">MONO</option>
          </select>
        </div>

        <div className="flex items-center h-full">
          <SolidButton
            onClick={cycleTheme}
            className={`h-6 px-3 py-0 text-[10px] flex items-center justify-start gap-2 w-[138px] whitespace-nowrap ${
              theme === "TRUE_BLACK"
                ? "!border-neutral-600 hover:!border-neutral-500 hover:!bg-neutral-900"
                : ""
            }`}
          >
            <Palette size={12} className="shrink-0" /> THEME: {theme === "TRUE_BLACK" ? "T-BLACK" : theme}
          </SolidButton>
        </div>

        <div className="w-px h-6 bg-panel-border mx-1" />

        <div className="flex bg-root-bg rounded border border-panel-border overflow-hidden text-[10px] font-mono leading-none h-6 hidden sm:flex">
          <button
            className={cn(
              "px-2 transition-colors cursor-pointer",
              language === "EN"
                ? "bg-text-secondary text-root-bg font-bold"
                : "bg-panel-bg text-text-muted hover:text-text-primary"
            )}
            onClick={() => setLanguage("EN")}
          >
            EN
          </button>
          <button
            className={cn(
              "px-2 transition-colors cursor-pointer",
              language === "JP"
                ? "bg-text-secondary text-root-bg font-bold"
                : "bg-panel-bg text-text-muted hover:text-text-primary"
            )}
            onClick={() => setLanguage("JP")}
          >
            JP
          </button>
        </div>

        <div className="flex items-center gap-2 h-full border-l border-panel-border pl-4">
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-mono tracking-wider animate-pulse select-none">
              <WifiOff size={11} />
              <span>OFFLINE</span>
            </div>
          )}

          {deferredInstallPrompt && (
            <SolidButton
              onClick={handleInstallPWA}
              className="px-2.5 py-0 h-6 text-[10px] flex items-center gap-1.5 text-accent border-accent/40 bg-accent/10 hover:bg-accent/20 cursor-pointer"
              title={t("Install app on this device", "この端末にアプリをインストール")}
            >
              <Download size={12} />
              <span>INSTALL</span>
            </SolidButton>
          )}

          {/* QUICK STOCK BUTTON */}
          <SolidButton
            onClick={() => setIsQuickStockDrawerOpen((prev) => !prev)}
            className={cn(
              "px-2.5 py-0 h-6 text-[10px] flex items-center gap-1.5 font-mono cursor-pointer transition-all",
              isQuickStockDrawerOpen
                ? "border-amber-400 bg-amber-500/25 text-amber-300 font-bold shadow-xs"
                : quickStocksCount > 0
                ? "border-amber-500/40 text-amber-400 hover:border-amber-400 hover:text-amber-300"
                : "border-panel-border text-text-secondary hover:text-text-primary"
            )}
            title={t("Toggle Quick Stock Drawer (Save & restore scroll states)", "クイックストック一覧を開閉（閲覧・スクロール位置保存）")}
          >
            <Zap size={12} className={cn("shrink-0", quickStocksCount > 0 ? "fill-amber-400 text-amber-400" : "")} />
            <span>STOCK</span>
            {quickStocksCount > 0 && (
              <span className="bg-amber-500/30 text-amber-400 px-1 py-0 rounded text-[9px] font-bold">
                {quickStocksCount}
              </span>
            )}
          </SolidButton>

          <SolidButton
            onClick={toggleAppFullscreen}
            className="px-2 cursor-pointer"
            title="TOGGLE FULLSCREEN (F11)"
          >
            {isAppFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </SolidButton>

          <SolidButton
            onClick={() => setSidebarPosition((p) => (p === "left" ? "right" : "left"))}
            className="px-2 cursor-pointer"
            title="TOGGLE SIDEBAR POSITION"
          >
            {sidebarPosition === "left" ? <PanelLeft size={16} /> : <PanelRight size={16} />}
          </SolidButton>

          <SolidButton
            onClick={() => window.open(window.location.href, "_blank")}
            className="px-2 ml-2 cursor-pointer"
            title="OPEN IN NEW TAB"
          >
            <ExternalLink size={16} />
          </SolidButton>
        </div>
      </div>
    </header>
  );
};
