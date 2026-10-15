import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";
import { SolidButton } from "../ui";

// 1. Delete Category Confirmation Modal
interface DeleteCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: (en: string, ja: string) => string;
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  t,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
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
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 uppercase transition-colors outline-none cursor-pointer"
              >
                {t("DELETE", "削除")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 2. Rename File Modal
interface RenameFileModalProps {
  isOpen: boolean;
  fileNameInput: string;
  setFileNameInput: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const RenameFileModal: React.FC<RenameFileModalProps> = ({
  isOpen,
  fileNameInput,
  setFileNameInput,
  onClose,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
        >
          <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
            <h2 className="text-text-primary mb-4 uppercase">RENAME FILE</h2>
            <input
              autoFocus
              type="text"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirm()}
              className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent"
              placeholder="ENTER FILE NAME..."
            />
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                CANCEL
              </SolidButton>
              <SolidButton onClick={onConfirm} className="text-accent hover:text-accent">
                CONFIRM
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 3. Clear All Database Modal
interface ClearAllModalProps {
  isOpen: boolean;
  totalImagesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearAllModal: React.FC<ClearAllModalProps> = ({
  isOpen,
  totalImagesCount,
  onClose,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
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
              Warning: This will delete all datasets and all {totalImagesCount} stored images. This action cannot be undone. Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                CANCEL
              </SolidButton>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 uppercase transition-colors outline-none cursor-pointer"
              >
                CONFIRM CLEAR
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 4. Overwrite Files Modal
interface OverwriteFilesModalProps {
  overwriteFiles: { files: File[]; targetDatasetId: string } | null;
  onClose: () => void;
  onConfirm: () => void;
  t: (en: string, ja: string) => string;
}

export const OverwriteFilesModal: React.FC<OverwriteFilesModalProps> = ({
  overwriteFiles,
  onClose,
  onConfirm,
  t,
}) => {
  return (
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
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <SolidButton
                onClick={onConfirm}
                className="text-orange-500 hover:text-orange-400 border-orange-900/50"
              >
                {t("UPDATE", "更新する")}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 5. Delete Images Modal
interface DeleteImageModalProps {
  isOpen: boolean;
  context: "selected" | "fullscreen" | null;
  language: "EN" | "JP";
  onClose: () => void;
  onConfirm: () => void;
  t: (en: string, ja: string) => string;
}

export const DeleteImageModal: React.FC<DeleteImageModalProps> = ({
  isOpen,
  context,
  language,
  onClose,
  onConfirm,
  t,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
        >
          <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <h2 className="text-red-500 mb-4 flex items-center gap-2">
              <Trash2 size={20} /> {context === "selected" ? "DELETE IMAGES" : "DELETE IMAGE"}
            </h2>
            <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
              {language === "JP"
                ? "完全に削除してもよろしいですか？この操作は元に戻せません。"
                : "Are you sure you want to permanently delete? This action cannot be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <SolidButton
                onClick={onConfirm}
                className="bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50"
              >
                {t("DELETE", "削除する")}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 6. Delete Dataset Modal
interface DeleteDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDatasetModal: React.FC<DeleteDatasetModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
        >
          <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <h2 className="text-red-500 mb-4 uppercase">DELETE DATASET</h2>
            <p className="text-text-primary text-xs mb-6">
              Are you sure you want to delete this dataset? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                CANCEL
              </SolidButton>
              <SolidButton
                onClick={onConfirm}
                className="text-red-500 hover:text-red-400 border-red-900/50"
              >
                DELETE DATASET
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
