import React, { useState } from "react";
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
  t,
}) => {
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{
    type: "category" | "dataset";
    id: string;
  } | null>(null);

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
    const isDragOver = dragOverTargetId === cat.id;
    const subCategories = categories.filter((c) => c.parentId === cat.id);
    const categoryDatasets = datasets.filter((d) => d.categoryId === cat.id);
    const totalImgCount = getCategoryTotalCount(cat.id);
    const canHaveSubcategory = depth < 2; // Max 3 levels: 0, 1, 2

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
          draggable
          onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            onSelectCategory(cat.id);
            onToggleExpand(cat.id, e);
          }}
          onDragOver={(e) => handleDragOver(e, cat.id)}
          onDragLeave={(e) => handleDragLeave(e, cat.id)}
          onDrop={(e) => handleCategoryNodeDrop(e, cat)}
          style={{ paddingLeft: `${Math.max(8, depth * 22 + 8)}px` }}
          className={cn(
            "flex items-center justify-between pr-2 py-1 font-mono cursor-pointer border transition-all group min-h-[30px] overflow-hidden shrink-0",
            textClass,
            isSelected
              ? "bg-accent/15 border-accent/60 text-accent font-medium"
              : isDragOver
              ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
              : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
          )}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {/* Grip handle for Category */}
            <div
              className="p-0.5 text-text-muted/40 hover:text-folder-icon cursor-grab active:cursor-grabbing transition-colors shrink-0"
              title={t("Drag to re-order/nest folder", "ドラッグしてフォルダーを移動")}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={13} className="text-folder-icon/70" />
            </div>

            {/* Expand / Collapse Toggle Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(cat.id, e);
              }}
              className="p-0.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>

            {/* Folder Icon */}
            <FolderIconComponent
              iconType={cat.icon}
              isOpen={isExpanded}
              size={14}
              className={cn("shrink-0", isSelected ? "text-accent" : "text-folder-icon")}
              style={{ color: isSelected ? undefined : (cat.color || undefined) }}
            />

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
        draggable
        onDragStart={(e) => handleDatasetDragStart(e, ds.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, ds.id)}
        onDragLeave={(e) => handleDragLeave(e, ds.id)}
        onDrop={(e) => handleDatasetItemDrop(e, ds)}
        onClick={() => onSelectDataset(ds.id)}
        style={{ paddingLeft: `${Math.max(8, depth * 22 + 8)}px` }}
        className={cn(
          "flex items-center justify-between pr-2 py-1 font-mono cursor-pointer border transition-colors group min-h-[30px] overflow-hidden shrink-0",
          textClass,
          isSelected
            ? "bg-accent/15 border-accent/60 text-accent font-medium"
            : isDragOver
            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
            : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          <GripVertical
            size={13}
            className="shrink-0 opacity-40 group-hover:opacity-100 text-accent/80 transition-opacity cursor-grab active:cursor-grabbing"
          />

          {/* Dataset Icon Badge */}
          <Layers
            size={13}
            className={cn(
              "shrink-0 transition-colors -translate-y-[1px]",
              isSelected ? "text-accent" : "text-text-muted/70 group-hover:text-accent"
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
      </div>
    );
  };

  const rootCategories = categories.filter((c) => !c.parentId);
  const rootDatasets = datasets.filter((d) => !d.categoryId);

  return (
    <div className="flex flex-col gap-0.5 w-full">
      {/* Root / IMAGE DATA Header Item (Droppable target to unclassify datasets or un-nest folders) */}
      <div
        onClick={() => onSelectCategory(null)}
        onDragOver={(e) => handleDragOver(e, "root")}
        onDragLeave={(e) => handleDragLeave(e, "root")}
        onDrop={(e) => handleDrop(e, null)}
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5 text-xs font-mono cursor-pointer border transition-all group min-h-[32px] overflow-hidden shrink-0",
          activeDatasetId === null && activeCategoryId === null
            ? "bg-accent/15 border-accent/60 text-accent font-semibold"
            : dragOverTargetId === "root"
            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01] shadow-md"
            : "border-transparent text-text-secondary hover:bg-panel-border/60 hover:text-text-primary"
        )}
      >
        <span className="truncate flex-1 min-w-0 pr-2 flex items-center gap-2">
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
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted text-[10px] shrink-0 font-mono">
            ({datasets.length} SETS)
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddCategory(null);
            }}
            className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  );
};
