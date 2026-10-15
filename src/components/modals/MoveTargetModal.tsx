import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { FolderOpen, Folders, Folder } from "lucide-react";
import { SolidButton } from "../ui";
import { cn } from "../../lib/utils";

export interface MoveItemTarget {
  type: "category" | "dataset";
  item: {
    id: string;
    name: string;
    parentId?: string | null;
    categoryId?: string | null;
  };
}

export interface CategoryTreeItem {
  id: string;
  name: string;
  parentId?: string | null;
}

interface MoveTargetModalProps {
  isOpen: boolean;
  itemToMove: MoveItemTarget | null;
  onClose: () => void;
  categories: CategoryTreeItem[];
  onMoveCategory: (categoryId: string, targetParentId: string | null) => void;
  onMoveDataset: (datasetId: string, targetCategoryId: string | null) => void;
  t: (en: string, ja: string) => string;
}

export const MoveTargetModal: React.FC<MoveTargetModalProps> = ({
  isOpen,
  itemToMove,
  onClose,
  categories,
  onMoveCategory,
  onMoveDataset,
  t,
}) => {
  if (!itemToMove) return null;

  const isDescendantCat = (catId: string, potentialChildId: string): boolean => {
    if (catId === potentialChildId) return true;
    const children = categories.filter((c) => c.parentId === potentialChildId);
    for (const ch of children) {
      if (isDescendantCat(catId, ch.id)) return true;
    }
    return false;
  };

  const renderTreeOptions = (parentId: string | null, depth: number): React.ReactNode => {
    const subCats = categories.filter((c) => (c.parentId || null) === parentId);
    return subCats.map((cat) => {
      const isSelfOrChild =
        itemToMove.type === "category" &&
        (cat.id === itemToMove.item.id || isDescendantCat(cat.id, itemToMove.item.id));

      const isCurrentParent =
        itemToMove.type === "category"
          ? itemToMove.item.parentId === cat.id
          : itemToMove.item.categoryId === cat.id;

      return (
        <React.Fragment key={cat.id}>
          <button
            type="button"
            disabled={isSelfOrChild || isCurrentParent}
            onClick={() => {
              if (itemToMove.type === "category") {
                onMoveCategory(itemToMove.item.id, cat.id);
              } else {
                onMoveDataset(itemToMove.item.id, cat.id);
              }
              onClose();
            }}
            style={{ paddingLeft: `${Math.max(12, depth * 16 + 12)}px` }}
            className={cn(
              "w-full text-left pr-3 py-2 text-xs font-mono flex items-center justify-between border transition-colors group",
              isSelfOrChild
                ? "opacity-30 cursor-not-allowed border-transparent text-text-muted"
                : isCurrentParent
                ? "border-accent/40 bg-accent/10 text-accent cursor-default font-bold"
                : "border-panel-border/30 hover:border-accent hover:bg-accent/15 text-text-primary"
            )}
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <Folder size={14} className="text-folder-icon shrink-0" />
              <span className="truncate">{cat.name}</span>
              {isCurrentParent && (
                <span className="text-[9px] text-accent bg-accent/20 px-1 py-0.5 rounded font-mono shrink-0">
                  {t("CURRENT", "現在位置")}
                </span>
              )}
            </div>
            {!isSelfOrChild && !isCurrentParent && (
              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 font-bold shrink-0">
                {t("MOVE HERE →", "ここへ移動 →")}
              </span>
            )}
          </button>
          {renderTreeOptions(cat.id, depth + 1)}
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
          <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[460px] max-h-[85vh] flex flex-col shadow-2xl">
            <h2 className="text-text-primary mb-2 uppercase flex items-center gap-2 text-sm font-bold">
              <FolderOpen size={18} className="text-accent" />
              {itemToMove.type === "category"
                ? t("MOVE FOLDER TO...", "フォルダーの移動先を選択")
                : t("MOVE DATASET TO...", "データセットの移動先フォルダーを選択")}
            </h2>
            <p className="text-xs text-text-muted mb-4">
              {t("TARGET: ", "対象: ")}
              <span className="text-text-primary font-bold">{itemToMove.item.name}</span>
            </p>
            <div className="flex-1 overflow-y-auto border border-panel-border bg-root-bg p-2 flex flex-col gap-1 mb-5 max-h-[320px] scrollbar-dark">
              {/* Option 1: Root / Top level */}
              <button
                type="button"
                onClick={() => {
                  if (itemToMove.type === "category") {
                    onMoveCategory(itemToMove.item.id, null);
                  } else {
                    onMoveDataset(itemToMove.item.id, null);
                  }
                  onClose();
                }}
                className="w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between border border-panel-border/50 hover:border-accent hover:bg-accent/15 transition-colors group text-text-primary"
              >
                <div className="flex items-center gap-2">
                  <Folders size={14} className="text-accent -translate-y-[1px]" />
                  <span className="font-bold">{t("ALL IMAGE DATA (ROOT / UNCLASSIFIED)", "ALL IMAGE DATA (ルート / 未分類)")}</span>
                </div>
                <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 font-bold">
                  {t("SELECT →", "選択 →")}
                </span>
              </button>
              {/* Option List: Category Tree Nodes */}
              {renderTreeOptions(null, 0)}
            </div>
            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
