import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Folder, FilePlus } from "lucide-react";
import { SolidButton } from "../ui";

export interface CategoryItem {
  id: string;
  name: string;
  parentId?: string | null;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategoryId: string | null;
  categoryNameInput: string;
  setCategoryNameInput: (val: string) => void;
  newCategoryParentId: string | null;
  setNewCategoryParentId: (val: string | null) => void;
  categories: CategoryItem[];
  onConfirm: () => void;
  onSwitchToCreateDataset?: (parentId: string | null) => void;
  t: (en: string, ja: string) => string;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  editingCategoryId,
  categoryNameInput,
  setCategoryNameInput,
  newCategoryParentId,
  setNewCategoryParentId,
  categories,
  onConfirm,
  onSwitchToCreateDataset,
  t,
}) => {
  const isDescendant = (catId: string, potentialChildId: string): boolean => {
    if (catId === potentialChildId) return true;
    const children = categories.filter((c) => c.parentId === potentialChildId);
    for (const ch of children) {
      if (isDescendant(catId, ch.id)) return true;
    }
    return false;
  };

  const renderCategoryOptions = (parentId: string | null = null, depth: number = 0): React.ReactNode => {
    const subCats = categories.filter((c) => (c.parentId || null) === parentId);
    return subCats.map((cat) => {
      const isSelfOrChild = editingCategoryId && isDescendant(cat.id, editingCategoryId);
      return (
        <React.Fragment key={cat.id}>
          <option value={cat.id} disabled={!!isSelfOrChild}>
            {depth === 0 ? "📁 " : `${"  ".repeat(depth)}└─ 📁 `}
            {cat.name}
          </option>
          {renderCategoryOptions(cat.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
        >
          <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[440px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text-primary uppercase flex items-center gap-2 font-bold text-sm">
                <Folder size={18} className="text-folder-icon" />
                {editingCategoryId ? t("RENAME CATEGORY", "フォルダー名の変更") : t("NEW CATEGORY", "新規フォルダーの作成")}
              </h2>
              {!editingCategoryId && onSwitchToCreateDataset && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSwitchToCreateDataset(newCategoryParentId);
                  }}
                  className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  title={t("Switch to Create Dataset", "データセット作成に切り替え")}
                >
                  <FilePlus size={12} />
                  <span>{t("CREATE DATASET INSTEAD", "セット作成はこちら")}</span>
                </button>
              )}
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                  {t("FOLDER NAME", "フォルダー名")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onConfirm()}
                  className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                  placeholder={t("ENTER CATEGORY NAME...", "フォルダー名を入力...")}
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                  {t("LOCATION / PARENT FOLDER", "作成先（親フォルダー）の選択")}
                </label>
                <select
                  value={newCategoryParentId || ""}
                  onChange={(e) => setNewCategoryParentId(e.target.value || null)}
                  className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">📁 {t("ALL IMAGE DATA (ROOT LEVEL)", "ALL IMAGE DATA (ルート / トップ階層)")}</option>
                  {renderCategoryOptions(null, 0)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <SolidButton onClick={onConfirm} className="text-accent hover:text-accent">
                {t("CONFIRM", "確定")}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
