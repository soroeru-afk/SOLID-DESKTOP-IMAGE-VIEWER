import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, FolderPlus } from "lucide-react";
import { SolidButton } from "../ui";

export interface CategoryOptionItem {
  id: string;
  name: string;
  parentId?: string | null;
}

interface DatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDatasetId: string | null;
  datasetNameInput: string;
  setDatasetNameInput: (val: string) => void;
  targetCategoryId: string | null;
  setTargetCategoryId: (val: string | null) => void;
  categories: CategoryOptionItem[];
  onConfirm: () => void;
  onSwitchToCreateFolder?: (parentId: string | null) => void;
  t: (en: string, ja: string) => string;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({
  isOpen,
  onClose,
  editingDatasetId,
  datasetNameInput,
  setDatasetNameInput,
  targetCategoryId,
  setTargetCategoryId,
  categories,
  onConfirm,
  onSwitchToCreateFolder,
  t,
}) => {
  const renderCategoryOptions = (parentId: string | null = null, depth: number = 0): React.ReactNode => {
    const subCats = categories.filter((c) => (c.parentId || null) === parentId);
    return subCats.map((cat) => (
      <React.Fragment key={cat.id}>
        <option value={cat.id}>
          {depth === 0 ? "📁 " : `${"  ".repeat(depth)}└─ 📁 `}
          {cat.name}
        </option>
        {renderCategoryOptions(cat.id, depth + 1)}
      </React.Fragment>
    ));
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
                <Layers size={18} className="text-accent" />
                {editingDatasetId ? t("RENAME DATASET", "データセット名の変更") : t("NEW DATASET", "新規データセットの作成")}
              </h2>
              {!editingDatasetId && onSwitchToCreateFolder && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSwitchToCreateFolder(targetCategoryId);
                  }}
                  className="text-[10px] text-folder-icon hover:underline flex items-center gap-1 cursor-pointer"
                  title={t("Switch to Create Folder", "フォルダー作成に切り替え")}
                >
                  <FolderPlus size={12} />
                  <span>{t("CREATE FOLDER INSTEAD", "フォルダー作成はこちら")}</span>
                </button>
              )}
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                  {t("DATASET NAME", "データセット名")}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={datasetNameInput}
                  onChange={(e) => setDatasetNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onConfirm()}
                  className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                  placeholder={t("ENTER DATASET NAME...", "データセット名を入力...")}
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                  {t("FOLDER LOCATION", "作成先（所属フォルダー）の選択")}
                </label>
                <select
                  value={targetCategoryId || ""}
                  onChange={(e) => setTargetCategoryId(e.target.value || null)}
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
