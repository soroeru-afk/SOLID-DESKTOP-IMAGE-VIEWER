import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { SolidButton } from "../ui";
import { CategoryRecord, updateCategoryColor, updateCategoryIcon, getAllCategories } from "../../lib/db";
import { FolderIconComponent, FolderIconType, FOLDER_ICON_OPTIONS } from "../FolderIcon";

export interface CategoryAppearanceModalProps {
  target: CategoryRecord | null;
  onClose: () => void;
  colorCategoryInput: string;
  setColorCategoryInput: (color: string) => void;
  categoryIconInput: FolderIconType | undefined;
  setCategoryIconInput: (icon: FolderIconType | undefined) => void;
  setCategories: React.Dispatch<React.SetStateAction<CategoryRecord[]>>;
  t: (en: string, jp: string) => string;
  language: "EN" | "JP";
}

export const CategoryAppearanceModal: React.FC<CategoryAppearanceModalProps> = ({
  target,
  onClose,
  colorCategoryInput,
  setColorCategoryInput,
  categoryIconInput,
  setCategoryIconInput,
  setCategories,
  t,
  language,
}) => {
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
        >
          <div className="bg-panel-bg border border-accent/50 p-6 font-mono w-[460px] max-w-[92vw] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <h2 className="text-accent mb-2 flex items-center gap-2 text-sm uppercase font-bold">
              <Palette size={18} /> {t("SET FOLDER APPEARANCE", "フォルダーの外観設定")}
            </h2>
            <p className="text-text-secondary text-xs mb-4 leading-relaxed">
              {t(
                `Customize icon variation and color for folder "${target.name}":`,
                `フォルダー「${target.name}」の表示アイコンと個別カラーを設定します：`
              )}
            </p>

            {/* 1. Folder Icon Variation Selector */}
            <div className="mb-5 border-b border-panel-border/60 pb-4">
              <span className="block text-[11px] font-mono text-text-muted mb-2 font-bold uppercase tracking-wider">
                {t("FOLDER ICON VARIATION", "フォルダーアイコンの種類")}:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {FOLDER_ICON_OPTIONS.map((opt) => {
                  const isSelected = categoryIconInput === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCategoryIconInput(opt.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 border text-xs font-mono transition-all rounded-[2px] cursor-pointer text-left select-none",
                        isSelected
                          ? "bg-accent/20 border-accent text-accent font-bold ring-1 ring-accent"
                          : "bg-root-bg/40 border-panel-border/80 text-text-secondary hover:text-text-primary hover:border-text-muted"
                      )}
                    >
                      <FolderIconComponent
                        iconType={opt.id}
                        size={16}
                        style={{ color: colorCategoryInput || undefined }}
                        className="shrink-0"
                      />
                      <span className="truncate text-[10px]">{language === "JP" ? opt.labelJp : opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Folder Color Selector */}
            <div className="flex flex-col gap-3 mb-6">
              <span className="block text-[11px] font-mono text-text-muted font-bold uppercase tracking-wider">
                {t("FOLDER ICON COLOR", "アイコンの個別カラー")}:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { name: "アンバー", hex: "#fbbf24" },
                  { name: "スカイ", hex: "#38bdf8" },
                  { name: "ブルー", hex: "#3b82f6" },
                  { name: "エメラルド", hex: "#10b981" },
                  { name: "ローズ", hex: "#f43f5e" },
                  { name: "パープル", hex: "#a855f7" },
                  { name: "シルバー", hex: "#9ca3af" },
                  { name: "ホワイト", hex: "#ffffff" },
                  { name: "シアン", hex: "#06b6d4" },
                  { name: "ピンク", hex: "#ec4899" },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColorCategoryInput(c.hex)}
                    title={c.name}
                    className={cn(
                      "w-6 h-6 rounded border transition-transform flex items-center justify-center cursor-pointer hover:scale-110",
                      colorCategoryInput.toLowerCase() === c.hex.toLowerCase()
                        ? "border-text-primary ring-2 ring-accent ring-offset-1 scale-105"
                        : "border-black/30"
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {colorCategoryInput.toLowerCase() === c.hex.toLowerCase() && (
                      <Check size={12} className="text-black drop-shadow-xs" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-panel-border/60 pt-3">
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <span>{t("Custom Color", "カスタムカラー")}:</span>
                  <input
                    type="color"
                    value={colorCategoryInput || "#fbbf24"}
                    onChange={(e) => setColorCategoryInput(e.target.value)}
                    className="w-6 h-6 border-0 bg-transparent cursor-pointer p-0"
                  />
                  <span className="font-mono text-[11px] text-text-primary uppercase">{colorCategoryInput || "THEME"}</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setColorCategoryInput("");
                  }}
                  className={cn(
                    "px-2 py-1 text-[10px] border transition-colors",
                    !colorCategoryInput
                      ? "bg-accent/20 border-accent text-accent font-bold"
                      : "border-panel-border text-text-muted hover:text-text-primary"
                  )}
                >
                  {t("Clear (Use Theme)", "標準色に戻す")}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-panel-border/60 pt-4">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <SolidButton
                onClick={async () => {
                  if (target) {
                    await updateCategoryColor(target.id, colorCategoryInput || null);
                    await updateCategoryIcon(
                      target.id,
                      categoryIconInput === "folder" ? null : categoryIconInput
                    );
                    const updatedCats = await getAllCategories();
                    setCategories(updatedCats);
                    onClose();
                  }
                }}
                className="text-accent hover:text-accent border-accent/50"
              >
                {t("SAVE SETTINGS", "設定を保存")}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
