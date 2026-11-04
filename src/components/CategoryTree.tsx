import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Trash2,
  Star,
  Pin,
  Download,
  GripVertical,
  Layers,
  FilePlus,
  FolderPlus,
  FolderInput,
  Palette,
  Folders,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  Edit3,
} from "lucide-react";
import { FolderIconComponent } from "./FolderIcon";
import { CategoryRecord, DatasetRecord } from "../lib/db";
import { cn } from "../lib/utils";

interface CategoryTreeProps {
  categories: CategoryRecord[];
  datasets: DatasetRecord[];
  datasetCounts: Record<string, number>;
  activeDatasetId: string | null;
  activeCategoryId: string | null;
  expandedCategoryIds: Set<string>;
  favoriteDatasetId: string | null;
  sidebarFontSize?: "xs" | "sm" | "base" | "lg" | "xl";
  onSelectDataset: (id: string) => void;
  onSelectCategory: (id: string | null) => void;
  onToggleExpand: (id: string, e?: React.MouseEvent) => void;
  onTogglePinDataset: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onExportDataset: (id: string) => void;
  onRenameDataset: (e: React.MouseEvent, id: string, name: string) => void;
  onDeleteDataset: (e: React.MouseEvent, id: string) => void;
  onAddCategory: (parentId: string | null) => void;
  onAddDataset: (categoryId: string | null) => void;
  onRenameCategory: (e: React.MouseEvent, cat: CategoryRecord) => void;
  onDeleteCategory: (e: React.MouseEvent, cat: CategoryRecord) => void;
  onMoveDatasetToCategory: (datasetId: string, targetCategoryId: string | null) => void;
  onMoveCategoryParent: (categoryId: string, newParentId: string | null) => void;
  onReorderDatasets?: (draggedDatasetId: string, targetDatasetId: string | null, targetCategoryId: string | null) => void;
  onReorderCategories?: (draggedCategoryId: string, targetCategoryId: string | null, targetParentId: string | null) => void;
  onRequestMoveDatasetModal: (dataset: DatasetRecord) => void;
  onRequestMoveCategoryModal: (category: CategoryRecord) => void;
  onRequestColorCategoryModal?: (category: CategoryRecord) => void;
  onBulkDeleteItems?: (categoryIds: string[], datasetIds: string[]) => Promise<void>;
  onBulkMoveItems?: (categoryIds: string[], datasetIds: string[], targetCategoryId: string | null) => Promise<void>;
  t: (en: string, jp: string) => string;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  categories,
  datasets,
  datasetCounts,
  activeDatasetId,
  activeCategoryId,
  expandedCategoryIds,
  favoriteDatasetId,
  sidebarFontSize = "sm",
  onSelectDataset,
  onSelectCategory,
  onToggleExpand,
  onTogglePinDataset,
  onToggleFavorite,
  onExportDataset,
  onRenameDataset,
  onDeleteDataset,
  onAddCategory,
  onAddDataset,
  onRenameCategory,
  onDeleteCategory,
  onMoveDatasetToCategory,
  onMoveCategoryParent,
  onReorderDatasets,
  onReorderCategories,
  onRequestMoveDatasetModal,
  onRequestMoveCategoryModal,
  onRequestColorCategoryModal,
  onBulkDeleteItems,
  onBulkMoveItems,
  t,
}) => {
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{
    type: "category" | "dataset";
    id: string;
  } | null>(null);

  // Multi-selection states for sidebar
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const totalSelected = selectedCategoryIds.size + selectedDatasetIds.size;
  const isAllSelected =
    categories.length > 0 &&
    datasets.length > 0 &&
    selectedCategoryIds.size === categories.length &&
    selectedDatasetIds.size === datasets.length;

  const toggleCategorySelection = (catId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const toggleDatasetSelection = (dsId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDatasetIds((prev) => {
      const next = new Set(prev);
      if (next.has(dsId)) {
        next.delete(dsId);
      } else {
        next.add(dsId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategoryIds(new Set());
      setSelectedDatasetIds(new Set());
    } else {
      setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
      setSelectedDatasetIds(new Set(datasets.map((d) => d.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCategoryIds(new Set());
    setSelectedDatasetIds(new Set());
    setIsSelectMode(false);
  };

  const handleExecuteBulkMove = async (targetCategoryId: string | null) => {
    if (onBulkMoveItems && totalSelected > 0) {
      await onBulkMoveItems(
        Array.from(selectedCategoryIds),
        Array.from(selectedDatasetIds),
        targetCategoryId
      );
    }
    setShowBulkMoveModal(false);
    clearSelection();
  };

  const handleExecuteBulkDelete = async () => {
    if (onBulkDeleteItems && totalSelected > 0) {
      await onBulkDeleteItems(
        Array.from(selectedCategoryIds),
        Array.from(selectedDatasetIds)
      );
    }
    setShowBulkDeleteModal(false);
    clearSelection();
  };

  // Helper to get total count in category recursively
  const getCategoryTotalCount = (catId: string): number => {
    const directDs = datasets.filter((d) => d.categoryId === catId);
    let count = directDs.reduce((sum, d) => sum + (datasetCounts[d.id] || 0), 0);
    const subCats = categories.filter((c) => c.parentId === catId);
    for (const sub of subCats) {
      count += getCategoryTotalCount(sub.id);
    }
    return count;
  };

  // Helper to check if a category is descendant of another
  const isDescendant = (parentCatId: string, potentialChildId: string): boolean => {
    if (parentCatId === potentialChildId) return true;
    const children = categories.filter((c) => c.parentId === potentialChildId);
    for (const ch of children) {
      if (isDescendant(parentCatId, ch.id)) return true;
    }
    return false;
  };

  // Drag start for Category
  const handleCategoryDragStart = (e: React.DragEvent, catId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-category-id", catId);
    e.dataTransfer.setData("text/plain", `category:${catId}`);
    e.dataTransfer.effectAllowed = "move";
    setActiveDragItem({ type: "category", id: catId });
  };

  // Drag start for Dataset
  const handleDatasetDragStart = (e: React.DragEvent, dsId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-dataset-id", dsId);
    e.dataTransfer.setData("text/plain", `dataset:${dsId}`);
    e.dataTransfer.effectAllowed = "move";
    setActiveDragItem({ type: "dataset", id: dsId });
  };

  const handleDragEnd = () => {
    setActiveDragItem(null);
    setDragOverTargetId(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (activeDragItem?.type === "category" && targetId !== "root") {
      if (isDescendant(targetId, activeDragItem.id)) {
        return;
      }
    }

    if (dragOverTargetId !== targetId) {
      setDragOverTargetId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTargetId === targetId) {
      setDragOverTargetId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCategoryId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);

    const catId =
      e.dataTransfer.getData("application/x-category-id") ||
      (activeDragItem?.type === "category" ? activeDragItem.id : null);

    const dsId =
      e.dataTransfer.getData("application/x-dataset-id") ||
      (activeDragItem?.type === "dataset" ? activeDragItem.id : null);

    if (catId) {
      if (targetCategoryId && isDescendant(targetCategoryId, catId)) {
        setActiveDragItem(null);
        return;
      }
      onMoveCategoryParent(catId, targetCategoryId);
    } else if (dsId) {
      onMoveDatasetToCategory(dsId, targetCategoryId);
    }

    setActiveDragItem(null);
  };

  const handleCategoryNodeDrop = (e: React.DragEvent, targetCat: CategoryRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);

    const catId =
      e.dataTransfer.getData("application/x-category-id") ||
      (activeDragItem?.type === "category" ? activeDragItem.id : null);

    const dsId =
      e.dataTransfer.getData("application/x-dataset-id") ||
      (activeDragItem?.type === "dataset" ? activeDragItem.id : null);

    if (catId && catId !== targetCat.id) {
      if (isDescendant(targetCat.id, catId)) {
        setActiveDragItem(null);
        return;
      }
      if (onReorderCategories) {
        onReorderCategories(catId, targetCat.id, targetCat.parentId || null);
      } else {
        onMoveCategoryParent(catId, targetCat.id);
      }
    } else if (dsId) {
      onMoveDatasetToCategory(dsId, targetCat.id);
    }

    setActiveDragItem(null);
  };

  const handleDatasetItemDrop = (e: React.DragEvent, targetDs: DatasetRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);

    const dsId =
      e.dataTransfer.getData("application/x-dataset-id") ||
      (activeDragItem?.type === "dataset" ? activeDragItem.id : null);

    if (dsId && dsId !== targetDs.id) {
      if (onReorderDatasets) {
        onReorderDatasets(dsId, targetDs.id, targetDs.categoryId || null);
      } else {
        onMoveDatasetToCategory(dsId, targetDs.categoryId || null);
      }
    }

    setActiveDragItem(null);
  };

  // Recursive renderer for Category node
  const renderCategoryNode = (cat: CategoryRecord, depth: number) => {
    const isExpanded = expandedCategoryIds.has(cat.id);
    const isSelected = activeDatasetId === null && activeCategoryId === cat.id;
    const isChecked = selectedCategoryIds.has(cat.id);
    const isDragOver = dragOverTargetId === cat.id;
    const subCategories = categories.filter((c) => c.parentId === cat.id);
    const categoryDatasets = datasets.filter((d) => d.categoryId === cat.id);
    const totalImgCount = getCategoryTotalCount(cat.id);
    const canHaveSubcategory = depth < 10; // Deep folder nesting supported

    const textClass =
      sidebarFontSize === "xs"
        ? "text-[10px]"
        : sidebarFontSize === "sm"
        ? "text-[11px]"
        : sidebarFontSize === "base"
        ? "text-[12px]"
        : sidebarFontSize === "lg"
        ? "text-[14px]"
        : "text-[16px]";

    return (
      <div key={cat.id} className="flex flex-col w-full select-none">
        <div
          draggable={!isSelectMode}
          onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            if (isSelectMode) {
              toggleCategorySelection(cat.id, e);
            } else {
              // Clicking folder row selects the category (does not toggle collapse/expand)
              onSelectCategory(cat.id);
            }
          }}
          onDragOver={(e) => handleDragOver(e, cat.id)}
          onDragLeave={(e) => handleDragLeave(e, cat.id)}
          onDrop={(e) => handleCategoryNodeDrop(e, cat)}
          style={{ paddingLeft: `${Math.max(8, depth * 22 + 8)}px` }}
          className={cn(
            "flex items-center justify-between pr-2 py-1 font-mono cursor-pointer border transition-all group min-h-[30px] overflow-hidden shrink-0",
            textClass,
            isChecked
              ? "bg-accent/20 border-accent/70 text-accent font-medium shadow-xs"
              : isSelected
              ? "bg-accent/15 border-accent/60 text-accent font-medium"
              : isDragOver
              ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
              : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
            {/* Grip handle & Checkbox fixed-width slot (prevents text jumping) */}
            <div className="w-[16px] h-[16px] shrink-0 flex items-center justify-center">
              {isSelectMode || totalSelected > 0 ? (
                <button
                  type="button"
                  onClick={(e) => toggleCategorySelection(cat.id, e)}
                  className="rounded text-accent hover:opacity-80 transition-opacity flex items-center justify-center cursor-pointer"
                  title={isChecked ? t("Deselect folder", "選択解除") : t("Select folder", "フォルダーを選択")}
                >
                  {isChecked ? (
                    <CheckSquare size={13} className="text-accent" />
                  ) : (
                    <Square size={13} className="text-text-muted" />
                  )}
                </button>
              ) : (
                <GripVertical
                  size={13}
                  className="opacity-40 group-hover:opacity-100 text-folder-icon/80 transition-opacity cursor-grab active:cursor-grabbing"
                />
              )}
            </div>

            {/* Folder Icon - Clicking icon toggles expand/collapse */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(cat.id, e);
              }}
              className="shrink-0 p-0.5 rounded hover:bg-accent/20 cursor-pointer transition-all hover:scale-110"
              title={
                isExpanded
                  ? t("Click to collapse folder", "クリックでフォルダーをたたむ")
                  : t("Click to expand folder", "クリックでフォルダーを開く")
              }
            >
              <FolderIconComponent
                iconType={cat.icon}
                isOpen={isExpanded}
                size={13}
                className={cn("shrink-0", isSelected || isChecked ? "text-accent" : "text-folder-icon")}
                style={{ color: isSelected || isChecked ? undefined : (cat.color || undefined) }}
              />
            </div>

            {/* Name (Clicking on text triggers row click and expands/collapses folder) */}
            <span className={cn("truncate font-semibold tracking-wide", textClass)}>
              {cat.name}
            </span>

            {/* Total Count Badge */}
            <span className="text-text-muted text-[10px] shrink-0 ml-1">
              ({totalImgCount})
            </span>
          </div>

          {/* Action buttons on hover */}
          {!isSelectMode && (
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {onRequestColorCategoryModal && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestColorCategoryModal(cat);
                  }}
                  className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                  title={t("Change Folder Color", "フォルダーカラー変更")}
                >
                  <Palette size={12} style={{ color: cat.color || undefined }} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestMoveCategoryModal(cat);
                }}
                className="p-1 hover:text-amber-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                title={t("Move Folder Parent", "親フォルダー変更")}
              >
                <FolderInput size={12} />
              </button>
              {canHaveSubcategory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCategory(cat.id);
                  }}
                  className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                  title={t("New Subfolder", "新しい子フォルダー")}
                >
                  <FolderPlus size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddDataset(cat.id);
                }}
                className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                title={t("New Dataset in this folder", "このフォルダー内に新規データセット")}
              >
                <FilePlus size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => onRenameCategory(e, cat)}
                className="p-1 hover:text-amber-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors text-[10px] font-bold"
                title={t("Rename Folder", "フォルダー名変更")}
              >
                [E]
              </button>
              <button
                type="button"
                onClick={(e) => onDeleteCategory(e, cat)}
                className="p-1 hover:text-red-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                title={t("Delete Folder", "フォルダー削除")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Children (Subcategories & Datasets) */}
        {isExpanded && (
          <div className="flex flex-col w-full relative">
            {/* Child Categories */}
            {subCategories.map((subCat) => renderCategoryNode(subCat, depth + 1))}

            {/* Direct Datasets in this category */}
            {categoryDatasets.map((ds) => renderDatasetItem(ds, depth + 1))}

            {/* Empty state hint */}
            {subCategories.length === 0 && categoryDatasets.length === 0 && (
              <div
                style={{ paddingLeft: `${(depth + 1) * 22 + 20}px` }}
                className="py-1 text-[10px] font-mono text-text-muted/60 italic"
              >
                {t("(empty folder)", "(空のフォルダー)")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Renderer for single Dataset Item
  const renderDatasetItem = (ds: DatasetRecord, depth: number) => {
    const isSelected = activeDatasetId === ds.id;
    const isChecked = selectedDatasetIds.has(ds.id);
    const isFav = favoriteDatasetId === ds.id;
    const isDragOver = dragOverTargetId === ds.id;
    const count = datasetCounts[ds.id] || 0;

    const textClass =
      sidebarFontSize === "xs"
        ? "text-[10px]"
        : sidebarFontSize === "sm"
        ? "text-[11px]"
        : sidebarFontSize === "base"
        ? "text-[12px]"
        : sidebarFontSize === "lg"
        ? "text-[14px]"
        : "text-[16px]";

    return (
      <div
        key={ds.id}
        draggable={!isSelectMode}
        onDragStart={(e) => handleDatasetDragStart(e, ds.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, ds.id)}
        onDragLeave={(e) => handleDragLeave(e, ds.id)}
        onDrop={(e) => handleDatasetItemDrop(e, ds)}
        onClick={(e) => {
          if (isSelectMode) {
            toggleDatasetSelection(ds.id, e);
          } else {
            onSelectDataset(ds.id);
          }
        }}
        style={{ paddingLeft: `${Math.max(8, depth * 22 + 8)}px` }}
        className={cn(
          "flex items-center justify-between pr-2 py-1 font-mono cursor-pointer border transition-colors group min-h-[30px] overflow-hidden shrink-0",
          textClass,
          isChecked
            ? "bg-accent/20 border-accent/70 text-accent font-medium shadow-xs"
            : isSelected
            ? "bg-accent/15 border-accent/60 text-accent font-medium"
            : isDragOver
            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
            : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          {/* Grip handle & Checkbox fixed-width slot (prevents text jumping) */}
          <div className="w-[16px] h-[16px] shrink-0 flex items-center justify-center">
            {isSelectMode || totalSelected > 0 ? (
              <button
                type="button"
                onClick={(e) => toggleDatasetSelection(ds.id, e)}
                className="rounded text-accent hover:opacity-80 transition-opacity flex items-center justify-center cursor-pointer"
                title={isChecked ? t("Deselect dataset", "選択解除") : t("Select dataset", "データセットを選択")}
              >
                {isChecked ? (
                  <CheckSquare size={13} className="text-accent" />
                ) : (
                  <Square size={13} className="text-text-muted" />
                )}
              </button>
            ) : (
              <GripVertical
                size={13}
                className="opacity-40 group-hover:opacity-100 text-accent/80 transition-opacity cursor-grab active:cursor-grabbing"
              />
            )}
          </div>

          {/* Dataset Icon Badge */}
          <Layers
            size={13}
            className={cn(
              "shrink-0 transition-colors -translate-y-[1px]",
              isSelected || isChecked ? "text-accent" : "text-text-muted/70 group-hover:text-accent"
            )}
          />

          {ds.isPinned && (
            <button
              type="button"
              onClick={(e) => onTogglePinDataset(ds.id, e)}
              className="p-0.5 -ml-0.5 rounded text-accent hover:opacity-75 transition-opacity shrink-0"
              title={t("UNPIN FROM TOP", "ピン留め解除")}
            >
              <Pin size={11} className="fill-accent rotate-45" />
            </button>
          )}

          <span className={cn("truncate", textClass)}>{ds.name}</span>

          <span className="text-text-muted text-[10px] shrink-0">
            ({count})
          </span>
        </div>

        {/* Dataset Action buttons */}
        {!isSelectMode && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestMoveDatasetModal(ds);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-70 hover:!opacity-100 text-text-muted hover:text-accent transition-opacity"
              title={t("Move Dataset to Folder", "フォルダーへ移動")}
            >
              <FolderInput size={12} />
            </button>

            {!ds.isPinned && (
              <button
                type="button"
                onClick={(e) => onTogglePinDataset(ds.id, e)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-muted hover:text-text-primary transition-opacity"
                title={t("PIN TO TOP", "最上部にピン留め固定")}
              >
                <Pin size={12} />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => onToggleFavorite(ds.id, e)}
              className={cn(
                "p-0.5 transition-opacity",
                isFav
                  ? "text-yellow-400 opacity-100"
                  : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-muted"
              )}
              title={t("FAVORITE DATASET", "お気に入り")}
            >
              <Star size={13} fill={isFav ? "currentColor" : "none"} />
            </button>

            {isSelected && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportDataset(ds.id);
                  }}
                  className="hover:text-accent opacity-50 hover:opacity-100 transition-opacity p-0.5"
                  title={t("EXPORT THIS DATASET", "このデータセットをエクスポート")}
                >
                  <Download size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => onRenameDataset(e, ds.id, ds.name)}
                  className="hover:text-amber-400 opacity-50 hover:opacity-100 transition-opacity p-0.5 text-[10px] font-bold"
                  title={t("RENAME DATASET", "名前変更")}
                >
                  [E]
                </button>
                <button
                  type="button"
                  onClick={(e) => onDeleteDataset(e, ds.id)}
                  className="hover:text-red-400 opacity-50 hover:opacity-100 transition-opacity p-0.5"
                  title={t("DELETE DATASET", "削除")}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootCategories = categories.filter((c) => !c.parentId);
  const rootDatasets = datasets.filter((d) => !d.categoryId);

  return (
    <div className="flex flex-col gap-0.5 w-full">
      {/* Root / ALL DATA Header Item (Single consolidated row with inline bulk actions) */}
      <div
        onClick={() => {
          if (!isSelectMode) {
            onSelectCategory(null);
          }
        }}
        onDragOver={(e) => handleDragOver(e, "root")}
        onDragLeave={(e) => handleDragLeave(e, "root")}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          "flex items-center justify-between px-2.5 py-1 text-xs font-mono cursor-pointer border transition-all group h-[32px] min-h-[32px] overflow-hidden shrink-0",
          activeDatasetId === null && activeCategoryId === null && !isSelectMode
            ? "bg-accent/15 border-accent/60 text-accent font-semibold"
            : dragOverTargetId === "root"
            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
            : isSelectMode || totalSelected > 0
            ? "border-accent/40 bg-panel-bg text-text-primary"
            : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
        )}
      >
        <span className="truncate flex-1 min-w-0 pr-1 flex items-center gap-1.5">
          <Folders
            size={14}
            className={cn(
              "shrink-0 -translate-y-[1px]",
              activeDatasetId === null && activeCategoryId === null
                ? "text-accent"
                : "text-text-muted"
            )}
          />
          <span className="tracking-wide font-bold">ALL IMAGE DATA</span>
        </span>

        {/* Right Action Controls (Consolidated on a single line) */}
        <div className="flex items-center gap-1 shrink-0">
          {isSelectMode || totalSelected > 0 ? (
            <>
              {/* Select All Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSelectAll();
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded-xs transition-colors text-[9px] font-mono font-bold border cursor-pointer",
                  isAllSelected
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-panel-border bg-root-bg text-text-secondary hover:text-text-primary"
                )}
                title={isAllSelected ? t("Deselect all", "全解除") : t("Select all items", "全選択")}
              >
                {isAllSelected ? t("CLR", "解除") : t("ALL", "全選択")}
              </button>

              {/* Selected Count Indicator */}
              <span
                className="text-[10px] font-mono font-bold text-accent tabular-nums px-1 py-0.5 bg-accent/10 border border-accent/30 rounded-xs"
                title={t("Selected items count", "選択件数")}
              >
                {totalSelected}
              </span>

              {/* Move Button (Icon only) */}
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBulkMoveModal(true);
                }}
                className={cn(
                  "p-1 rounded-xs border transition-colors",
                  totalSelected > 0
                    ? "border-accent/60 bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer shadow-xs"
                    : "border-panel-border text-text-muted opacity-30 cursor-not-allowed"
                )}
                title={t("Move selected items", "選択項目を移動")}
              >
                <FolderInput size={13} />
              </button>

              {/* Delete Button (Trash icon only) */}
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBulkDeleteModal(true);
                }}
                className={cn(
                  "p-1 rounded-xs border transition-colors",
                  totalSelected > 0
                    ? "border-red-500/60 bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer shadow-xs"
                    : "border-panel-border text-text-muted opacity-30 cursor-not-allowed"
                )}
                title={t("Delete selected items", "選択項目を一括削除")}
              >
                <Trash2 size={13} />
              </button>

              {/* SELECT toggle / exit button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                className="px-1.5 py-0.5 rounded-xs transition-colors text-[9px] font-mono font-bold border border-accent bg-accent text-accent-text cursor-pointer tracking-wider"
                title={t("Exit selection mode", "選択モード終了")}
              >
                SELECT
              </button>
            </>
          ) : (
            <>
              <span className="text-text-muted text-[10px] shrink-0 font-mono pr-0.5">
                ({datasets.length})
              </span>

              {/* SELECT Button (Enter selection mode) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSelectMode(true);
                }}
                className="px-1.5 py-0.5 rounded-xs transition-colors text-[9px] font-mono font-bold border border-panel-border bg-root-bg text-text-muted hover:border-accent hover:text-accent cursor-pointer tracking-wider"
                title={t("Multi-select mode", "複数選択モード")}
              >
                SELECT
              </button>
            </>
          )}

          {/* New Root Folder */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddCategory(null);
            }}
            className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded-xs transition-colors cursor-pointer"
            title={t("New Root Folder", "新しいルートフォルダー")}
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      {/* Categories Tree */}
      {rootCategories.map((cat) => renderCategoryNode(cat, 0))}

      {/* Root / Unclassified Datasets */}
      {rootDatasets.map((ds) => renderDatasetItem(ds, 0))}

      {/* BULK MOVE MODAL FOR SIDEBAR */}
      <AnimatePresence>
        {showBulkMoveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-accent p-6 font-mono w-[480px] max-h-[85vh] flex flex-col shadow-2xl rounded-xs">
              <h2 className="text-accent mb-2 uppercase flex items-center gap-2 text-sm font-bold tracking-wider">
                <FolderInput size={18} />
                {t("MOVE SELECTED ITEMS", "選択項目の一括移動")}
              </h2>
              <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                {t(
                  `Select destination folder for ${selectedCategoryIds.size} folder(s) and ${selectedDatasetIds.size} dataset(s):`,
                  `選択されている ${selectedCategoryIds.size}件のフォルダー / ${selectedDatasetIds.size}件のデータセット の移動先を選択してください:`
                )}
              </p>

              <div className="flex-1 overflow-y-auto border border-panel-border bg-root-bg p-2 flex flex-col gap-1 mb-5 max-h-[280px] scrollbar-dark">
                {/* ROOT Option */}
                <button
                  type="button"
                  onClick={() => handleExecuteBulkMove(null)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-mono border border-panel-border/60 hover:border-accent hover:bg-accent/10 text-text-primary transition-all text-left group rounded-xs cursor-pointer"
                >
                  <Folder size={14} className="text-accent shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-bold">{t("ROOT LEVEL (Top)", "ルート階層 (最上部)")}</span>
                </button>

                {/* All available folders */}
                {categories.map((cat) => {
                  const isSelfOrDescendant = Array.from(selectedCategoryIds).some((selectedId: string) =>
                    selectedId === cat.id || isDescendant(cat.id, selectedId)
                  );

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isSelfOrDescendant}
                      onClick={() => handleExecuteBulkMove(cat.id)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-xs font-mono border transition-all text-left rounded-xs",
                        isSelfOrDescendant
                          ? "bg-panel-bg/30 border-panel-border/30 text-text-muted/40 cursor-not-allowed"
                          : "border-panel-border/60 hover:border-accent hover:bg-accent/10 text-text-primary cursor-pointer group"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder
                          size={14}
                          className="shrink-0 group-hover:scale-110 transition-transform"
                          style={{ color: cat.color || "var(--folder-icon, #fbbf24)" }}
                        />
                        <span className="font-bold truncate">{cat.name}</span>
                      </div>
                      {isSelfOrDescendant && (
                        <span className="text-[10px] text-text-muted/60 shrink-0 italic">
                          {t("(Current/Child)", "(移動不可)")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowBulkMoveModal(false)}
                  className="px-4 py-2 text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {t("CANCEL", "キャンセル")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BULK DELETE CONFIRMATION MODAL FOR SIDEBAR */}
      <AnimatePresence>
        {showBulkDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/60 p-6 font-mono w-[480px] max-h-[85vh] flex flex-col shadow-2xl rounded-xs">
              <h2 className="text-red-400 mb-2 uppercase flex items-center gap-2 text-sm font-bold tracking-wider">
                <Trash2 size={18} className="text-red-500 shrink-0" />
                {t("DELETE SELECTED ITEMS", "選択項目の一括削除確認")}
              </h2>
              <p className="text-xs text-text-primary mb-3 leading-relaxed">
                {t(
                  `Are you sure you want to delete ${selectedCategoryIds.size} folder(s) and ${selectedDatasetIds.size} dataset(s)?`,
                  `選択されているフォルダー ${selectedCategoryIds.size}件、データセット ${selectedDatasetIds.size}件 を削除してもよろしいですか？`
                )}
              </p>

              {/* Items Summary List */}
              <div className="flex-1 overflow-y-auto border border-panel-border bg-root-bg p-3 flex flex-col gap-1.5 mb-4 max-h-[200px] scrollbar-dark">
                {Array.from(selectedCategoryIds).map((id) => {
                  const cat = categories.find((c) => c.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono text-text-secondary border-b border-panel-border/30 pb-1">
                      <Folder size={13} className="text-folder-icon shrink-0" />
                      <span className="font-bold text-text-primary truncate">{cat?.name || id}</span>
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-xs ml-auto shrink-0 font-bold">
                        {t("FOLDER", "フォルダー")}
                      </span>
                    </div>
                  );
                })}
                {Array.from(selectedDatasetIds).map((id) => {
                  const ds = datasets.find((d) => d.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs font-mono text-text-secondary border-b border-panel-border/30 pb-1">
                      <Layers size={13} className="text-accent shrink-0" />
                      <span className="font-bold text-text-primary truncate">{ds?.name || id}</span>
                      <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded-xs ml-auto shrink-0 font-bold">
                        {t("DATASET", "リスト")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Warning Notice */}
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xs text-[11px] text-red-300 mb-5 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <span>
                  {t(
                    "Warning: Deleting a folder will also permanently delete all subfolders, datasets, and images inside it. This action cannot be undone.",
                    "※フォルダーを削除すると、その中に含まれるサブフォルダーやデータセット、画像データもすべて一括削除されます。この操作は取り消せません。"
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(false)}
                  className="px-4 py-2 text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {t("CANCEL", "キャンセル")}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkDelete}
                  className="px-4 py-2 text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white rounded-xs transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>{t("DELETE PERMANENTLY", "完全に削除する")}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
