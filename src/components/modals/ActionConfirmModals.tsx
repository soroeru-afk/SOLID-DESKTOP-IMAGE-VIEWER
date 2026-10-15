import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { SolidButton } from "../ui";

export interface ActionConfirmModalsProps {
  // Delete Category
  showDeleteCategoryModal: boolean;
  onCloseDeleteCategory: () => void;
  onConfirmDeleteCategory: () => void;

  // Rename File
  showRenameFileModal: boolean;
  onCloseRenameFile: () => void;
  fileNameInput: string;
  setFileNameInput: (name: string) => void;
  onSubmitFileRename: () => void;

  // Clear All
  showClearAllModal: boolean;
  onCloseClearAll: () => void;
  onConfirmClearAll: () => void;
  totalImagesCount: number;

  // Overwrite Files
  overwriteFiles: { files: File[]; targetDatasetId?: string } | null;
  onCloseOverwrite: () => void;
  onConfirmOverwrite: () => void;

  // Delete Image(s)
  showDeleteImageModal: boolean;
  imageToDeleteContext: "selected" | "fullscreen" | null;
  onCloseDeleteImage: () => void;
  onConfirmDeleteImage: () => void;

  // Delete Dataset
  showDeleteDatasetModal: boolean;
  onCloseDeleteDataset: () => void;
  onConfirmDeleteDataset: () => void;

  // Common
  t: (en: string, jp: string) => string;
  language: "EN" | "JP";
}

export const ActionConfirmModals: React.FC<ActionConfirmModalsProps> = ({
  showDeleteCategoryModal,
  onCloseDeleteCategory,
  onConfirmDeleteCategory,

  showRenameFileModal,
  onCloseRenameFile,
  fileNameInput,
  setFileNameInput,
  onSubmitFileRename,

  showClearAllModal,
  onCloseClearAll,
  onConfirmClearAll,
  totalImagesCount,

  overwriteFiles,
  onCloseOverwrite,
  onConfirmOverwrite,

  showDeleteImageModal,
  imageToDeleteContext,
  onCloseDeleteImage,
  onConfirmDeleteImage,

  showDeleteDatasetModal,
  onCloseDeleteDataset,
  onConfirmDeleteDataset,

  t,
  language,
}) => {
  return (
    <>
      {/* Delete Category Confirmation Modal */}
      <AnimatePresence>
        {showDeleteCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[420px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> {t("DELETE CATEGORY", "カテゴリーの削除")}
              </h2>
              <p className="text-text-primary text-xs mb-6 leading-relaxed">
                {t(
                  "Are you sure you want to delete this category? Any datasets inside will be moved to the parent level.",
                  "このカテゴリーを削除しますか？含まれるデータセットは親階層（またはルート）に移動されます。"
                )}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseDeleteCategory}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <button
                  onClick={onConfirmDeleteCategory}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 uppercase transition-colors outline-none cursor-pointer"
                >
                  {t("DELETE", "削除")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename File Modal */}
      <AnimatePresence>
        {showRenameFileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
              <h2 className="text-text-primary mb-4 uppercase font-bold text-sm">
                RENAME FILE
              </h2>
              <input
                autoFocus
                type="text"
                value={fileNameInput}
                onChange={(e) => setFileNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSubmitFileRename()}
                className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent text-xs font-mono"
                placeholder="ENTER FILE NAME..."
              />
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseRenameFile}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <SolidButton
                  onClick={onSubmitFileRename}
                  className="text-accent hover:text-accent"
                >
                  CONFIRM
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear All Modal */}
      <AnimatePresence>
        {showClearAllModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> CLEAR ENTIRE DATABASE
              </h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                Warning: This will delete all datasets and all{" "}
                {totalImagesCount} stored images. This action cannot be undone.
                Are you sure?
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseClearAll}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <button
                  onClick={onConfirmClearAll}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 uppercase transition-colors outline-none cursor-pointer"
                >
                  CONFIRM CLEAR
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overwrite Confirmation Modal */}
      <AnimatePresence>
        {overwriteFiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-orange-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(249,115,22,0.2)]">
              <h2 className="text-orange-500 mb-4 uppercase">
                {t("UPDATE EXISTING FILES", "既存のファイルを更新")}
              </h2>
              <p className="text-text-primary text-xs mb-6 leading-relaxed">
                {t(
                  `${overwriteFiles.files.length} file(s) already exist. Do you want to overwrite and update them?`,
                  `同じ名前の画像が ${overwriteFiles.files.length} 件あります。これらを新しい画像で上書き更新しますか？`
                )}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseOverwrite}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={onConfirmOverwrite}
                  className="text-orange-500 hover:text-orange-400 border-orange-900/50"
                >
                  {t("UPDATE", "更新する")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Image(s) Modal */}
      <AnimatePresence>
        {showDeleteImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> {imageToDeleteContext === "selected" ? "DELETE IMAGES" : "DELETE IMAGE"}
              </h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                {language === "JP" 
                  ? "完全に削除してもよろしいですか？この操作は元に戻せません。"
                  : "Are you sure you want to permanently delete? This action cannot be undone."}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseDeleteImage}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={onConfirmDeleteImage}
                  className="bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50"
                >
                  {t("DELETE", "削除する")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Dataset Modal */}
      <AnimatePresence>
        {showDeleteDatasetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 uppercase">
                DELETE DATASET
              </h2>
              <p className="text-text-primary text-xs mb-6">
                Are you sure you want to delete this dataset? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={onCloseDeleteDataset}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <SolidButton
                  onClick={onConfirmDeleteDataset}
                  className="text-red-500 hover:text-red-400 border-red-900/50"
                >
                  DELETE DATASET
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
