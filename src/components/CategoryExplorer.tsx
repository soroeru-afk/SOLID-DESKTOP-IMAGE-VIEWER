import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Layers,
  Star,
  Pin,
  FolderPlus,
  FilePlus,
  Trash2,
  ImageIcon,
  Eye,
  GripVertical,
  FolderInput,
  Palette,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  Check,
  Edit3,
  Type,
  Hash,
  ArrowRight,
  Replace,
  FileText,
  Search,
  Folders,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  List,
  Bookmark,
} from "lucide-react";
import { CategoryRecord, DatasetRecord, ImageRecord, getImagesByDataset } from "../lib/db";
import { cn } from "../lib/utils";
import { FolderIconComponent } from "./FolderIcon";

interface CategoryExplorerProps {
  categories: CategoryRecord[];
  datasets: DatasetRecord[];
  datasetCounts: Record<string, number>;
  datasetPreviewUrls: Record<string, string>;
  categoryPreviewUrls?: Record<string, string>;
  activeCategoryId: string | null;
  totalImagesCount: number;
  homeViewMode: "text" | "popup" | "card" | "cover" | "list";
  favoriteDatasetId: string | null;
  setHomeViewMode: (mode: "text" | "popup" | "card" | "cover" | "list") => void;
  onSelectCategory: (catId: string | null) => void;
  onSelectDataset: (datasetId: string) => void;
  onViewCategoryImages: (catId: string) => void;
  onAddCategory: (parentId: string | null) => void;
  onAddDataset: (categoryId: string | null) => void;
  onRenameCategory: (e: React.MouseEvent, cat: CategoryRecord) => void;
  onDeleteCategory: (e: React.MouseEvent, cat: CategoryRecord) => void;
  onTogglePinDataset: (id: string, e: React.MouseEvent) => void;
  onCycleCoverPosition: (id: string, e: React.MouseEvent) => void;
  onCycleCategoryCoverPosition?: (id: string, e: React.MouseEvent) => void;
  onSetCategoryCoverImage?: (categoryId: string, imageId: string | null) => Promise<void>;
  onSetDatasetCoverImage?: (datasetId: string, imageId: string | null) => Promise<void>;
  onMoveDatasetToCategory: (datasetId: string, targetCategoryId: string | null) => void;
  onMoveCategoryParent: (categoryId: string, newParentId: string | null) => void;
  onReorderDatasets?: (draggedDatasetId: string, targetDatasetId: string | null, targetCategoryId: string | null) => void;
  onReorderCategories?: (draggedCategoryId: string, targetCategoryId: string | null, targetParentId: string | null) => void;
  onBatchReorderCategories?: (updates: { id: string; orderIndex: number }[]) => Promise<void>;
  onBatchReorderDatasets?: (updates: { id: string; orderIndex: number }[]) => Promise<void>;
  onRequestMoveDatasetModal: (dataset: DatasetRecord) => void;
  onRequestMoveCategoryModal: (category: CategoryRecord) => void;
  onRequestColorCategoryModal?: (category: CategoryRecord) => void;
  onBulkDeleteItems?: (categoryIds: string[], datasetIds: string[]) => Promise<void>;
  onBulkMoveItems?: (categoryIds: string[], datasetIds: string[], targetCategoryId: string | null) => Promise<void>;
  onBulkRenameItems?: (renames: { id: string; type: "category" | "dataset"; newName: string }[]) => Promise<void>;
  t: (en: string, jp: string) => string;
}

export const CategoryExplorer: React.FC<CategoryExplorerProps> = ({
  categories,
  datasets,
  datasetCounts,
  datasetPreviewUrls,
  categoryPreviewUrls,
  activeCategoryId,
  totalImagesCount,
  homeViewMode,
  favoriteDatasetId,
  setHomeViewMode,
  onSelectCategory,
  onSelectDataset,
  onViewCategoryImages,
  onAddCategory,
  onAddDataset,
  onRenameCategory,
  onDeleteCategory,
  onTogglePinDataset,
  onCycleCoverPosition,
  onCycleCategoryCoverPosition,
  onSetCategoryCoverImage,
  onSetDatasetCoverImage,
  onMoveDatasetToCategory,
  onMoveCategoryParent,
  onReorderDatasets,
  onReorderCategories,
  onBatchReorderCategories,
  onBatchReorderDatasets,
  onRequestMoveDatasetModal,
  onRequestMoveCategoryModal,
  onRequestColorCategoryModal,
  onBulkDeleteItems,
  onBulkMoveItems,
  onBulkRenameItems,
  t,
}) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [popupMousePos, setPopupMousePos] = useState({ x: 0, y: 0 });
  const [dragOverTargetKey, setDragOverTargetKey] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{
    type: "category" | "dataset";
    id: string;
  } | null>(null);

  // Category Cover Art Selection Modal States
  const [categoryCoverModalTarget, setCategoryCoverModalTarget] = useState<CategoryRecord | null>(null);
  const [categoryCoverCandidateImages, setCategoryCoverCandidateImages] = useState<ImageRecord[]>([]);
  const [isLoadingCoverImages, setIsLoadingCoverImages] = useState(false);
  const [coverSearchQuery, setCoverSearchQuery] = useState("");

  // Dataset Cover Art Selection Modal States
  const [datasetCoverModalTarget, setDatasetCoverModalTarget] = useState<DatasetRecord | null>(null);
  const [datasetCoverCandidateImages, setDatasetCoverCandidateImages] = useState<ImageRecord[]>([]);
  const [isLoadingDatasetCoverImages, setIsLoadingDatasetCoverImages] = useState(false);
  const [datasetCoverSearchQuery, setDatasetCoverSearchQuery] = useState("");

  // Bulk Selection States
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Bulk Rename States
  const [showBulkRenameModal, setShowBulkRenameModal] = useState(false);
  const [bulkRenameTab, setBulkRenameTab] = useState<"quick" | "replace" | "prefix">("quick");
  const [targetScope, setTargetScope] = useState<"all_items" | "all_datasets" | "all_categories" | "selected">("all_items");
  const [checkedRenameIds, setCheckedRenameIds] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState("");
  const [quickNames, setQuickNames] = useState<Record<string, string>>({});
  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [prefixInput, setPrefixInput] = useState("");
  const [suffixInput, setSuffixInput] = useState("");
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [enableNumbering, setEnableNumbering] = useState(false);
  const [numberStart, setNumberStart] = useState(1);
  const [numberDigits, setNumberDigits] = useState(2);
  const [numberPosition, setNumberPosition] = useState<"prefix" | "suffix">("prefix");
  const [numberOrder, setNumberOrder] = useState<"asc" | "desc">("asc");

  // Get current active category
  const currentCategory = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId) || null
    : null;

  // Calculate breadcrumbs
  const breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: "ALL IMAGE DATA" }];
  if (currentCategory) {
    const chain: CategoryRecord[] = [];
    let cur: CategoryRecord | undefined = currentCategory;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? categories.find((c) => c.id === cur?.parentId) : undefined;
    }
    chain.forEach((cat) => breadcrumbs.push({ id: cat.id, name: cat.name }));
  }

  // Calculate current folder depth (0, 1, 2)
  const currentDepth = breadcrumbs.length - 1;
  const canCreateSubcategory = currentDepth < 2;

  // Direct subcategories in current folder
  const currentSubcategories = activeCategoryId
    ? categories.filter((c) => c.parentId === activeCategoryId)
    : categories.filter((c) => !c.parentId);

  // Direct datasets in current folder
  const currentDatasets = activeCategoryId
    ? datasets.filter((d) => d.categoryId === activeCategoryId)
    : datasets.filter((d) => !d.categoryId);

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

  // Helper to find preview url for a category
  const getCategoryCoverUrl = (catId: string): string | null => {
    const cat = categories.find((c) => c.id === catId);
    if (cat?.coverImageId && categoryPreviewUrls?.[catId]) {
      return categoryPreviewUrls[catId];
    }
    const directDs = datasets.filter((d) => d.categoryId === catId);
    for (const ds of directDs) {
      if (datasetPreviewUrls[ds.id]) return datasetPreviewUrls[ds.id];
    }
    const subCats = categories.filter((c) => c.parentId === catId);
    for (const sub of subCats) {
      const url = getCategoryCoverUrl(sub.id);
      if (url) return url;
    }
    return null;
  };

  const handleOpenCategoryCoverModal = async (cat: CategoryRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCategoryCoverModalTarget(cat);
    setIsLoadingCoverImages(true);
    setCoverSearchQuery("");
    try {
      const dsIds: string[] = [];
      const collectDsIds = (targetCatId: string) => {
        const direct = datasets.filter((d) => d.categoryId === targetCatId);
        direct.forEach((d) => dsIds.push(d.id));
        const subs = categories.filter((c) => c.parentId === targetCatId);
        subs.forEach((sub) => collectDsIds(sub.id));
      };
      collectDsIds(cat.id);

      const allCandidateImages: ImageRecord[] = [];
      for (const dsId of dsIds) {
        const imgs = await getImagesByDataset(dsId);
        allCandidateImages.push(...imgs);
      }
      setCategoryCoverCandidateImages(allCandidateImages);
    } catch (err) {
      console.error("Failed to load candidate images for category cover", err);
    } finally {
      setIsLoadingCoverImages(false);
    }
  };

  const handleOpenDatasetCoverModal = async (ds: DatasetRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDatasetCoverModalTarget(ds);
    setIsLoadingDatasetCoverImages(true);
    setDatasetCoverSearchQuery("");
    try {
      const imgs = await getImagesByDataset(ds.id);
      setDatasetCoverCandidateImages(imgs);
    } catch (err) {
      console.error("Failed to load candidate images for dataset cover", err);
    } finally {
      setIsLoadingDatasetCoverImages(false);
    }
  };

  const getCoverPositionStyle = (pos?: "top" | "center" | "bottom"): string => {
    if (pos === "center") return "50% 50%";
    if (pos === "bottom") return "50% 85%";
    return "50% 15%";
  };

  const totalCurrentFolderImages = activeCategoryId
    ? getCategoryTotalCount(activeCategoryId)
    : totalImagesCount;

  // Bulk Selection Logic
  const totalSelected = selectedCategoryIds.size + selectedDatasetIds.size;
  const currentSubCatIds = currentSubcategories.map((c) => c.id);
  const currentDsIds = currentDatasets.map((d) => d.id);
  const isAllSelected =
    currentSubCatIds.length + currentDsIds.length > 0 &&
    currentSubCatIds.every((id) => selectedCategoryIds.has(id)) &&
    currentDsIds.every((id) => selectedDatasetIds.has(id));

  const toggleCategorySelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDatasetSelect = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setSelectedDatasetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategoryIds((prev) => {
        const next = new Set(prev);
        currentSubCatIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedDatasetIds((prev) => {
        const next = new Set(prev);
        currentDsIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedCategoryIds((prev) => new Set([...prev, ...currentSubCatIds]));
      setSelectedDatasetIds((prev) => new Set([...prev, ...currentDsIds]));
    }
  };

  const clearSelection = () => {
    setSelectedCategoryIds(new Set());
    setSelectedDatasetIds(new Set());
    setLastSelectedIndex(null);
  };

  const allOrderedItems: Array<{ type: "category" | "dataset"; id: string }> = [
    ...currentSubcategories.map((c) => ({ type: "category" as const, id: c.id })),
    ...currentDatasets.map((d) => ({ type: "dataset" as const, id: d.id })),
  ];

  const handleSelectWithShift = (
    type: "category" | "dataset",
    id: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const currentIndex = allOrderedItems.findIndex(
      (x) => x.type === type && x.id === id
    );

    if (e.shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);

      setSelectedCategoryIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (allOrderedItems[i].type === "category") {
            next.add(allOrderedItems[i].id);
          }
        }
        return next;
      });

      setSelectedDatasetIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (allOrderedItems[i].type === "dataset") {
            next.add(allOrderedItems[i].id);
          }
        }
        return next;
      });
    } else {
      if (type === "category") {
        toggleCategorySelect(id);
      } else {
        toggleDatasetSelect(id);
      }
      setLastSelectedIndex(currentIndex);
    }
  };

  const handleMoveSelectionUp = async () => {
    // 1. Categories
    if (selectedCategoryIds.size > 0) {
      const list = [...currentSubcategories];
      let hasChanges = false;
      for (let i = 0; i < list.length; i++) {
        if (selectedCategoryIds.has(list[i].id)) {
          if (i > 0 && !selectedCategoryIds.has(list[i - 1].id)) {
            const temp = list[i];
            list[i] = list[i - 1];
            list[i - 1] = temp;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        if (onBatchReorderCategories) {
          const updates = list.map((c, idx) => ({ id: c.id, orderIndex: idx }));
          await onBatchReorderCategories(updates);
        } else if (onReorderCategories) {
          for (let i = 0; i < list.length; i++) {
            if (selectedCategoryIds.has(list[i].id)) {
              const prevItem = i > 0 ? list[i - 1] : null;
              onReorderCategories(list[i].id, prevItem ? prevItem.id : null, activeCategoryId);
            }
          }
        }
      }
    }

    // 2. Datasets
    if (selectedDatasetIds.size > 0) {
      const list = [...currentDatasets];
      let hasChanges = false;
      for (let i = 0; i < list.length; i++) {
        if (selectedDatasetIds.has(list[i].id)) {
          if (i > 0 && !selectedDatasetIds.has(list[i - 1].id)) {
            const temp = list[i];
            list[i] = list[i - 1];
            list[i - 1] = temp;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        if (onBatchReorderDatasets) {
          const updates = list.map((d, idx) => ({ id: d.id, orderIndex: idx }));
          await onBatchReorderDatasets(updates);
        } else if (onReorderDatasets) {
          for (let i = 0; i < list.length; i++) {
            if (selectedDatasetIds.has(list[i].id)) {
              const prevItem = i > 0 ? list[i - 1] : null;
              onReorderDatasets(list[i].id, prevItem ? prevItem.id : null, activeCategoryId);
            }
          }
        }
      }
    }
  };

  const handleMoveSelectionDown = async () => {
    // 1. Categories
    if (selectedCategoryIds.size > 0) {
      const list = [...currentSubcategories];
      let hasChanges = false;
      for (let i = list.length - 1; i >= 0; i--) {
        if (selectedCategoryIds.has(list[i].id)) {
          if (i < list.length - 1 && !selectedCategoryIds.has(list[i + 1].id)) {
            const temp = list[i];
            list[i] = list[i + 1];
            list[i + 1] = temp;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        if (onBatchReorderCategories) {
          const updates = list.map((c, idx) => ({ id: c.id, orderIndex: idx }));
          await onBatchReorderCategories(updates);
        } else if (onReorderCategories) {
          for (let i = list.length - 1; i >= 0; i--) {
            if (selectedCategoryIds.has(list[i].id)) {
              const nextItem = i < list.length - 1 ? list[i + 1] : null;
              onReorderCategories(list[i].id, nextItem ? nextItem.id : null, activeCategoryId);
            }
          }
        }
      }
    }

    // 2. Datasets
    if (selectedDatasetIds.size > 0) {
      const list = [...currentDatasets];
      let hasChanges = false;
      for (let i = list.length - 1; i >= 0; i--) {
        if (selectedDatasetIds.has(list[i].id)) {
          if (i < list.length - 1 && !selectedDatasetIds.has(list[i + 1].id)) {
            const temp = list[i];
            list[i] = list[i + 1];
            list[i + 1] = temp;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        if (onBatchReorderDatasets) {
          const updates = list.map((d, idx) => ({ id: d.id, orderIndex: idx }));
          await onBatchReorderDatasets(updates);
        } else if (onReorderDatasets) {
          for (let i = list.length - 1; i >= 0; i--) {
            if (selectedDatasetIds.has(list[i].id)) {
              const nextItem = i < list.length - 1 ? list[i + 1] : null;
              onReorderDatasets(list[i].id, nextItem ? nextItem.id : null, activeCategoryId);
            }
          }
        }
      }
    }
  };

  const handleReverseOrder = async () => {
    // Determine whether to reverse selected items only or all items in the current folder if none selected
    const targetCatIds = selectedCategoryIds.size > 0 ? selectedCategoryIds : new Set(currentSubcategories.map((c) => c.id));
    const targetDsIds = selectedDatasetIds.size > 0 ? selectedDatasetIds : new Set(currentDatasets.map((d) => d.id));

    // 1. Reverse Categories order among target items
    if (targetCatIds.size > 1) {
      const list = [...currentSubcategories];
      const indices: number[] = [];
      const itemsToReverse: CategoryRecord[] = [];
      
      list.forEach((c, idx) => {
        if (targetCatIds.has(c.id)) {
          indices.push(idx);
          itemsToReverse.push(c);
        }
      });

      itemsToReverse.reverse();
      indices.forEach((listIdx, i) => {
        list[listIdx] = itemsToReverse[i];
      });

      if (onBatchReorderCategories) {
        const updates = list.map((c, idx) => ({ id: c.id, orderIndex: idx }));
        await onBatchReorderCategories(updates);
      }
    }

    // 2. Reverse Datasets order among target items
    if (targetDsIds.size > 1) {
      const list = [...currentDatasets];
      const indices: number[] = [];
      const itemsToReverse: DatasetRecord[] = [];

      list.forEach((d, idx) => {
        if (targetDsIds.has(d.id)) {
          indices.push(idx);
          itemsToReverse.push(d);
        }
      });

      itemsToReverse.reverse();
      indices.forEach((listIdx, i) => {
        list[listIdx] = itemsToReverse[i];
      });

      if (onBatchReorderDatasets) {
        const updates = list.map((d, idx) => ({ id: d.id, orderIndex: idx }));
        await onBatchReorderDatasets(updates);
      }
    }
  };

  const executeBulkDelete = async () => {
    if (onBulkDeleteItems) {
      await onBulkDeleteItems(Array.from(selectedCategoryIds), Array.from(selectedDatasetIds));
    }
    setShowBulkDeleteModal(false);
    clearSelection();
  };

  const executeBulkMove = async (targetCategoryId: string | null) => {
    if (onBulkMoveItems) {
      await onBulkMoveItems(Array.from(selectedCategoryIds), Array.from(selectedDatasetIds), targetCategoryId);
    }
    setShowBulkMoveModal(false);
    clearSelection();
  };

  const getItemIdsForScope = (scope: "all_items" | "all_datasets" | "all_categories" | "selected"): string[] => {
    if (scope === "all_datasets") {
      return datasets.map((d) => d.id);
    } else if (scope === "all_categories") {
      return categories.map((c) => c.id);
    } else if (scope === "all_items") {
      return [...categories.map((c) => c.id), ...datasets.map((d) => d.id)];
    } else {
      return [...currentSubcategories.map((c) => c.id), ...currentDatasets.map((d) => d.id)];
    }
  };

  const handleTargetScopeChange = (newScope: "all_items" | "all_datasets" | "all_categories" | "selected") => {
    setTargetScope(newScope);
    const ids = getItemIdsForScope(newScope);
    setCheckedRenameIds(new Set(ids));
  };

  const handleOpenBulkRenameModal = () => {
    const initNames: Record<string, string> = {};
    categories.forEach((cat) => { initNames[cat.id] = cat.name; });
    datasets.forEach((ds) => { initNames[ds.id] = ds.name; });

    setQuickNames(initNames);
    setReplaceSearch("");
    setReplaceWith("");
    setPrefixInput("");
    setSuffixInput("");
    setTrimStart(0);
    setTrimEnd(0);
    setFilterSearch("");
    setEnableNumbering(false);
    setNumberStart(1);
    setNumberDigits(2);
    setNumberPosition("prefix");
    setNumberOrder("asc");
    setBulkRenameTab("quick");
    setTargetScope("all_items");

    // Check ALL items by default when opening
    const allIds = [...categories.map((c) => c.id), ...datasets.map((d) => d.id)];
    setCheckedRenameIds(new Set(allIds));

    setShowBulkRenameModal(true);
  };

  const toggleItemRenameCheck = (id: string) => {
    setCheckedRenameIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllRename = (allVisibleItems: { id: string }[]) => {
    const visibleIds = allVisibleItems.map((i) => i.id);
    const allChecked = visibleIds.every((id) => checkedRenameIds.has(id));
    setCheckedRenameIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const getBulkRenameItemsList = () => {
    let targetCatIds: string[] = [];
    let targetDsIds: string[] = [];

    if (targetScope === "all_datasets") {
      targetCatIds = [];
      targetDsIds = datasets.map((d) => d.id);
    } else if (targetScope === "all_categories") {
      targetCatIds = categories.map((c) => c.id);
      targetDsIds = [];
    } else if (targetScope === "all_items") {
      targetCatIds = categories.map((c) => c.id);
      targetDsIds = datasets.map((d) => d.id);
    } else {
      // CURRENT VIEW: Always load ALL subcategories and datasets in the current view
      targetCatIds = currentSubcategories.map((c) => c.id);
      targetDsIds = currentDatasets.map((d) => d.id);
    }

    const rawList: { id: string; type: "category" | "dataset"; originalName: string }[] = [];

    targetCatIds.forEach((id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      if (filterSearch && !cat.name.toLowerCase().includes(filterSearch.toLowerCase())) return;
      rawList.push({ id, type: "category", originalName: cat.name });
    });


    targetDsIds.forEach((id: string) => {
      const ds = datasets.find((d) => d.id === id);
      if (!ds) return;
      if (filterSearch && !ds.name.toLowerCase().includes(filterSearch.toLowerCase())) return;
      rawList.push({ id, type: "dataset", originalName: ds.name });
    });

    const checkedItems = rawList.filter((item) => checkedRenameIds.has(item.id));
    const totalChecked = checkedItems.length;

    let checkedCounter = 0;
    const list: { id: string; type: "category" | "dataset"; originalName: string; newName: string }[] = [];

    rawList.forEach((item) => {
      let newName = item.originalName;

      if (bulkRenameTab === "quick") {
        newName = quickNames[item.id] ?? item.originalName;
      } else if (bulkRenameTab === "replace") {
        if (replaceSearch) {
          newName = item.originalName.split(replaceSearch).join(replaceWith);
        }
      } else if (bulkRenameTab === "prefix") {
        let name = item.originalName;

        // 1. Trim characters from Start / End
        if (trimStart > 0 && name.length > 0) {
          name = name.slice(Math.min(trimStart, name.length));
        }
        if (trimEnd > 0 && name.length > 0) {
          name = name.slice(0, Math.max(0, name.length - trimEnd));
        }

        // 2. Add Prefix / Suffix
        if (prefixInput) name = `${prefixInput}${name}`;
        if (suffixInput) name = `${suffixInput}${name}`;

        // 3. Add Numbering with Ascending / Descending order
        if (enableNumbering && checkedRenameIds.has(item.id)) {
          const numVal = numberOrder === "asc"
            ? numberStart + checkedCounter
            : numberStart + (totalChecked - 1 - checkedCounter);
          const numStr = String(numVal).padStart(numberDigits, "0");

          if (numberPosition === "prefix") name = `${numStr}_${name}`;
          else name = `${name}_${numStr}`;
        }

        newName = name;
      }

      if (checkedRenameIds.has(item.id)) {
        checkedCounter++;
      }

      list.push({ id: item.id, type: item.type, originalName: item.originalName, newName });
    });

    return list;
  };

  const executeBulkRename = async () => {
    if (onBulkRenameItems) {
      const items = getBulkRenameItemsList();
      const renames = items
        .filter((i) => checkedRenameIds.has(i.id) && i.newName.trim() !== "" && i.newName !== i.originalName)
        .map((i) => ({ id: i.id, type: i.type, newName: i.newName.trim() }));

      if (renames.length > 0) {
        await onBulkRenameItems(renames);
      }
    }
    setShowBulkRenameModal(false);
  };

  // Helper to check if a category is descendant
  const isDescendant = (parentCatId: string, potentialChildId: string): boolean => {
    if (parentCatId === potentialChildId) return true;
    const children = categories.filter((c) => c.parentId === potentialChildId);
    for (const ch of children) {
      if (isDescendant(parentCatId, ch.id)) return true;
    }
    return false;
  };

  // Drag Handlers for Categories
  const handleCategoryDragStart = (e: React.DragEvent, catId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-category-id", catId);
    e.dataTransfer.setData("text/plain", `category:${catId}`);
    e.dataTransfer.effectAllowed = "move";
    setActiveDragItem({ type: "category", id: catId });
  };

  // Drag Handlers for Datasets
  const handleDatasetDragStart = (e: React.DragEvent, dsId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-dataset-id", dsId);
    e.dataTransfer.setData("text/plain", `dataset:${dsId}`);
    e.dataTransfer.effectAllowed = "move";
    setActiveDragItem({ type: "dataset", id: dsId });
  };

  const handleDragEnd = () => {
    setActiveDragItem(null);
    setDragOverTargetKey(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    if (activeDragItem?.type === "category") {
      if (targetFolderId && isDescendant(targetFolderId, activeDragItem.id)) {
        return;
      }
    }

    const key = targetFolderId || "root-crumb";
    if (dragOverTargetKey !== key) {
      setDragOverTargetKey(key);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const key = targetFolderId || "root-crumb";
    if (dragOverTargetKey === key) {
      setDragOverTargetKey(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetKey(null);

    const catId =
      e.dataTransfer.getData("application/x-category-id") ||
      (activeDragItem?.type === "category" ? activeDragItem.id : null);

    const dsId =
      e.dataTransfer.getData("application/x-dataset-id") ||
      (activeDragItem?.type === "dataset" ? activeDragItem.id : null);

    if (catId) {
      if (targetFolderId && isDescendant(targetFolderId, catId)) {
        setActiveDragItem(null);
        return;
      }
      onMoveCategoryParent(catId, targetFolderId);
    } else if (dsId) {
      onMoveDatasetToCategory(dsId, targetFolderId);
    }

    setActiveDragItem(null);
  };

  const handleSubcategoryDrop = (e: React.DragEvent, targetCat: CategoryRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetKey(null);

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
        onReorderCategories(catId, targetCat.id, activeCategoryId);
      } else {
        onMoveCategoryParent(catId, targetCat.id);
      }
    } else if (dsId) {
      onMoveDatasetToCategory(dsId, targetCat.id);
    }

    setActiveDragItem(null);
  };

  const handleDatasetCardDrop = (e: React.DragEvent, targetDs: DatasetRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetKey(null);

    const dsId =
      e.dataTransfer.getData("application/x-dataset-id") ||
      (activeDragItem?.type === "dataset" ? activeDragItem.id : null);

    if (dsId && dsId !== targetDs.id) {
      if (onReorderDatasets) {
        onReorderDatasets(dsId, targetDs.id, activeCategoryId);
      } else {
        onMoveDatasetToCategory(dsId, activeCategoryId);
      }
    }

    setActiveDragItem(null);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
        <div className="text-[10vw] font-black tracking-tight text-panel-border/25 leading-none text-center select-none">
          {currentCategory ? currentCategory.name : <>IMAGE<br />DATA</>}
        </div>
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-dark flex flex-col items-center justify-start">
        <div className="w-full max-w-[1700px] flex flex-col items-center">
          {/* View Style Switcher Buttons & Overview Bar */}
          <div className="flex flex-wrap items-center justify-between w-full gap-3 mb-6 select-none">
            <div className="text-text-muted text-xs tracking-widest uppercase font-mono bg-panel-bg/90 backdrop-blur-md px-4 py-1.5 border border-panel-border shadow-sm flex items-center gap-2">
              <Folder size={13} className="text-accent" />
              <span>
                {currentCategory ? currentCategory.name : t("ROOT EXPLORER", "ルート階層")}
              </span>
              <span className="text-text-primary font-bold">
                ({currentSubcategories.length} FOLDERS / {currentDatasets.length} DATASETS / {totalCurrentFolderImages} IMAGES)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-text-muted hidden sm:inline-block">
                {t("💡 GRIP (⋮⋮) TO DRAG FOLDERS & DATASETS", "💡 グリップ (⋮⋮) でフォルダーやセットを自由に移動")}
              </span>
              <div className="flex items-center border border-panel-border bg-panel-bg/90 backdrop-blur-md p-1 text-[10px] font-mono shadow-sm">
                {(["text", "popup", "card", "cover", "list"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setHomeViewMode(mode)}
                    className={cn(
                      "px-3 py-1 transition-colors uppercase font-mono cursor-pointer",
                      homeViewMode === mode
                        ? "bg-accent text-accent-text font-bold"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* K-Navigator Style Bulk Selection & Action Toolbar */}
          <div className="w-full bg-panel-bg/95 border border-panel-border p-2 px-3 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm backdrop-blur-md rounded-xs">
            <div className="flex items-center gap-3">
              {/* SELECT ALL Checkbox Button */}
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xs border transition-colors select-none font-bold cursor-pointer",
                  isAllSelected
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-root-bg border-panel-border text-text-secondary hover:text-text-primary hover:border-text-muted"
                )}
              >
                {isAllSelected ? (
                  <CheckSquare size={14} className="text-accent" />
                ) : (
                  <Square size={14} />
                )}
                <span>{t("SELECT ALL", "全選択")}</span>
              </button>

              {/* Selection Count Indicator */}
              <div
                className={cn(
                  "px-3 py-1.5 rounded-xs font-bold transition-all border flex items-center gap-1.5",
                  totalSelected > 0
                    ? "bg-accent text-accent-text border-accent shadow-xs"
                    : "bg-root-bg/50 border-panel-border text-text-muted opacity-60"
                )}
              >
                <span>{totalSelected}</span>
                <span>{t("ITEMS SELECTED", "件選択中")}</span>
              </div>

              {/* Cancel Button */}
              {totalSelected > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-text-secondary hover:text-text-primary border border-panel-border/60 hover:border-panel-border rounded-xs transition-colors cursor-pointer"
                >
                  <X size={13} />
                  <span>{t("Cancel", "解除")}</span>
                </button>
              )}
            </div>

            {/* Action Buttons: Move Up/Down, Rename, Move to... & DELETE */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleMoveSelectionUp}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected > 0
                    ? "bg-panel-bg border-accent/60 text-accent hover:bg-accent/15 hover:border-accent cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
                title={t("Move selected items up", "選択した項目を上へ移動")}
              >
                <ArrowUp size={14} />
                <span>{t("UP", "上へ")}</span>
              </button>

              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleMoveSelectionDown}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected > 0
                    ? "bg-panel-bg border-accent/60 text-accent hover:bg-accent/15 hover:border-accent cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
                title={t("Move selected items down", "選択した項目を下へ移動")}
              >
                <ArrowDown size={14} />
                <span>{t("DOWN", "下へ")}</span>
              </button>

              {/* REVERSE ORDER BUTTON */}
              <button
                type="button"
                disabled={totalSelected < 2 && (currentSubcategories.length < 2 && currentDatasets.length < 2)}
                onClick={handleReverseOrder}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected >= 2 || (totalSelected === 0 && (currentSubcategories.length >= 2 || currentDatasets.length >= 2))
                    ? "bg-panel-bg border-accent/60 text-accent hover:bg-accent/15 hover:border-accent cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
                title={
                  totalSelected >= 2
                    ? t("Reverse order of selected items", "選択した項目の並び順を真逆に反転")
                    : t("Reverse order of all items in current folder", "現在のフォルダー内の全項目の並び順を真逆に反転")
                }
              >
                <ArrowUpDown size={14} />
                <span>{t("REVERSE", "反転")}</span>
              </button>

              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleOpenBulkRenameModal}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected > 0
                    ? "bg-panel-bg border-accent/60 text-accent hover:bg-accent/15 hover:border-accent cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
              >
                <Edit3 size={14} />
                <span>{t("RENAME", "一括リネーム")}</span>
              </button>

              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={() => setShowBulkMoveModal(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected > 0
                    ? "bg-panel-bg border-accent/60 text-accent hover:bg-accent/15 hover:border-accent cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
              >
                <FolderInput size={14} />
                <span>{t("Move to...", "Move to...")}</span>
              </button>

              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={() => setShowBulkDeleteModal(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xs font-bold border transition-all shadow-xs",
                  totalSelected > 0
                    ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 cursor-pointer"
                    : "bg-panel-bg/40 border-panel-border/40 text-text-muted opacity-40 cursor-not-allowed"
                )}
              >
                <Trash2 size={14} />
                <span>{t("DELETE", "DELETE")}</span>
              </button>
            </div>
          </div>

          {/* Empty State */}
          {currentSubcategories.length === 0 && currentDatasets.length === 0 && (
            <div className="text-text-muted font-mono text-xs mt-12 bg-panel-bg/60 px-6 py-6 border border-panel-border flex flex-col items-center gap-3">
              <FolderOpen size={32} className="opacity-40 text-accent" />
              <span>
                {t(
                  "THIS FOLDER IS EMPTY. CREATE A SUBFOLDER OR DATASET ABOVE.",
                  "このフォルダーは空です。上部のボタンからフォルダーやデータセットを作成してください。"
                )}
              </span>
            </div>
          )}

          {/* 1. Subcategories Grid (DRAGGABLE & DROPPABLE FOLDERS!) */}
          {currentSubcategories.length > 0 && (
            <div className="w-full flex flex-col gap-2 mb-8">
              <div className="flex items-center gap-2 font-mono text-xs text-text-muted uppercase tracking-widest px-1">
                <Folder size={13} className="text-folder-icon" />
                <span>{t("FOLDERS", "フォルダー")} ({currentSubcategories.length})</span>
                {activeDragItem && (
                  <span className="text-accent font-bold text-[11px] animate-pulse">
                    ← {t("DROP HERE TO MOVE", "ここにドロップして移動")}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "w-full",
                  homeViewMode === "list"
                    ? "flex flex-col gap-2"
                    : "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
                )}
              >
                {currentSubcategories.map((cat) => {
                  const subCount = categories.filter((c) => c.parentId === cat.id).length;
                  const dsCount = datasets.filter((d) => d.categoryId === cat.id).length;
                  const totalImages = getCategoryTotalCount(cat.id);
                  const coverUrl = getCategoryCoverUrl(cat.id);
                  const isCatSelected = selectedCategoryIds.has(cat.id);
                  const isFolderDragOver = dragOverTargetKey === cat.id;

                  if (homeViewMode === "list") {
                    return (
                      <div
                        key={cat.id}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleFolderDragOver(e, cat.id)}
                        onDragLeave={(e) => handleFolderDragLeave(e, cat.id)}
                        onDrop={(e) => handleSubcategoryDrop(e, cat)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            handleSelectWithShift("category", cat.id, e);
                          } else if (totalSelected > 0) {
                            toggleCategorySelect(cat.id, e);
                          } else {
                            onSelectCategory(cat.id);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded border font-mono text-xs transition-all cursor-pointer group select-none",
                          isCatSelected
                            ? "bg-accent/20 border-accent text-accent font-bold shadow-md"
                            : isFolderDragOver
                            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01]"
                            : "bg-panel-bg/90 border-panel-border hover:border-accent hover:bg-accent/15 text-text-primary"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Selection Checkbox (Shift+Click supported) */}
                          <div
                            onClick={(e) => handleSelectWithShift("category", cat.id, e)}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-all",
                              isCatSelected
                                ? "bg-accent border-accent text-accent-text"
                                : "border-panel-border/80 hover:border-accent hover:bg-accent/10"
                            )}
                            title={t("Click or Shift+Click to select range", "クリックまたはShift+クリックで範囲選択")}
                          >
                            {isCatSelected ? <Check size={12} className="stroke-[3]" /> : null}
                          </div>

                          {/* Drag Grip */}
                          <GripVertical size={14} className="shrink-0 opacity-40 group-hover:opacity-100 text-folder-icon cursor-grab" />

                          {/* Folder Icon */}
                          <FolderIconComponent
                            iconType={cat.icon}
                            isOpen={false}
                            size={16}
                            className="shrink-0 -translate-y-[1px]"
                            style={{ color: cat.color || undefined }}
                          />

                          {/* Category Name */}
                          <span className="font-bold truncate text-sm tracking-wide">
                            {cat.name}
                          </span>

                          {/* Counts badge */}
                          <span className="text-[10px] text-text-muted shrink-0 font-mono">
                            ({totalImages} {t("IMAGES", "枚")})
                          </span>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onSetCategoryCoverImage && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenCategoryCoverModal(cat, e)}
                              className={cn(
                                "p-1 hover:text-amber-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors",
                                cat.coverImageId && "text-amber-400"
                              )}
                              title={cat.coverImageId ? t("Custom cover image set (Click to change)", "カバー画像設定中（クリックで変更）") : t("Set Folder Cover Image", "フォルダーカバー画像を設定")}
                            >
                              <Bookmark size={13} fill={cat.coverImageId ? "currentColor" : "none"} />
                            </button>
                          )}
                          {onRequestColorCategoryModal && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestColorCategoryModal(cat);
                              }}
                              className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                              title={t("Folder Settings", "フォルダー設定")}
                            >
                              <Palette size={13} style={{ color: cat.color || undefined }} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRenameCategory(e, cat);
                            }}
                            className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                            title={t("Rename", "名前変更")}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCategory(e, cat);
                            }}
                            className="p-1 hover:text-red-400 text-text-muted hover:bg-red-500/10 rounded transition-colors"
                            title={t("Delete", "削除")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleFolderDragOver(e, cat.id)}
                      onDragLeave={(e) => handleFolderDragLeave(e, cat.id)}
                      onDrop={(e) => handleSubcategoryDrop(e, cat)}
                      className={cn(
                        "relative group select-none cursor-pointer transition-all",
                        isCatSelected
                          ? "ring-2 ring-accent border-accent bg-accent/10 shadow-lg scale-[1.01]"
                          : isFolderDragOver
                          ? "ring-2 ring-accent border-accent scale-[1.02] shadow-xl"
                          : ""
                      )}
                      onMouseEnter={(e) => {
                        setHoveredItemId(cat.id);
                        setPopupMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        setPopupMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      {/* Selection Checkbox (K-Navigator Style) */}
                      <div
                        onClick={(e) => handleSelectWithShift("category", cat.id, e)}
                        className={cn(
                          "absolute top-2 left-2 z-20 w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer border shadow-md",
                          isCatSelected
                            ? "bg-accent border-accent text-accent-text font-bold scale-110"
                            : totalSelected > 0
                            ? "bg-panel-bg/95 border-accent/80 text-text-muted hover:border-accent"
                            : "bg-panel-bg/85 border-panel-border/80 text-transparent opacity-0 group-hover:opacity-100 hover:border-accent hover:text-accent"
                        )}
                        title={t("Select folder", "フォルダーを選択")}
                      >
                        <CheckSquare size={13} className={isCatSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"} />
                      </div>

                      <div
                        onClick={(e) => {
                          if (totalSelected > 0) {
                            toggleCategorySelect(cat.id, e);
                          } else {
                            onSelectCategory(cat.id);
                          }
                        }}
                        className={cn(
                          "w-full h-full flex flex-col justify-between transition-all text-left shadow-sm hover:shadow-md text-text-primary overflow-hidden relative border rounded-[3px]",
                          isFolderDragOver
                            ? "border-accent bg-accent/20"
                            : "border-panel-border hover:border-amber-400/80",
                          homeViewMode === "card"
                            ? "p-0 bg-panel-bg/90"
                            : "p-4 min-h-[105px] sm:min-h-[110px] bg-panel-bg/85 hover:bg-panel-bg backdrop-blur-md"
                        )}
                      >
                        {/* COVER MODE */}
                        {homeViewMode === "cover" && coverUrl && (
                          <div
                            className="absolute inset-0 z-0 bg-cover pointer-events-none opacity-[var(--cover-base-op,0.32)] group-hover:opacity-[var(--cover-hover-op,0.48)] transition-opacity duration-300 transform scale-105 group-hover:scale-100"
                            style={{
                              backgroundImage: `url(${coverUrl})`,
                              backgroundPosition: getCoverPositionStyle(cat.coverImagePosition),
                              filter: "var(--cover-blur-filter, none)",
                            }}
                          />
                        )}

                        {/* COVER MODE POS BUTTON */}
                        {homeViewMode === "cover" && coverUrl && onCycleCategoryCoverPosition && (
                          <button
                            type="button"
                            onClick={(e) => onCycleCategoryCoverPosition(cat.id, e)}
                            className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-md cursor-pointer transition-colors"
                            title={t("Cycle crop position", "トリミング位置切替")}
                          >
                            <span>POS:</span>
                            <span className="text-amber-400 uppercase font-bold">
                              {cat.coverImagePosition === "center"
                                ? "MID"
                                : cat.coverImagePosition === "bottom"
                                ? "BTM"
                                : "TOP"}
                            </span>
                          </button>
                        )}

                        {/* CARD MODE */}
                        {homeViewMode === "card" && (
                          <div className="w-full aspect-[16/11] sm:aspect-[16/11] max-h-[225px] sm:max-h-[240px] bg-black/20 overflow-hidden relative flex items-center justify-center border-b border-panel-border/60">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={cat.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                style={{
                                  objectPosition: getCoverPositionStyle(cat.coverImagePosition),
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-folder-icon/50 font-mono text-[10px]">
                                <FolderIconComponent iconType={cat.icon} size={32} className="mb-1 opacity-70" style={{ color: cat.color || undefined }} />
                                <span>{t("FOLDER", "フォルダー")}</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-mono text-folder-icon border border-folder-icon/30 backdrop-blur-xs flex items-center gap-1">
                              <Folder size={10} />
                              <span>{t("DIR", "フォルダ")}</span>
                            </div>

                            {/* Cover select & crop buttons in CARD mode */}
                            {onSetCategoryCoverImage && (
                              <button
                                type="button"
                                onClick={(e) => handleOpenCategoryCoverModal(cat, e)}
                                className={cn(
                                  "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/20 backdrop-blur-xs flex items-center gap-1 shadow-sm z-10",
                                  cat.coverImageId && "opacity-100 text-amber-400 border-amber-400/50 bg-black/90"
                                )}
                                title={cat.coverImageId ? t("Custom cover image set (Click to change/reset)", "カスタムカバー画像設定済み (クリックで変更/解除)") : t("Choose cover image for folder", "フォルダーのカバー画像を選択")}
                              >
                                <Bookmark size={10} fill={cat.coverImageId ? "currentColor" : "none"} />
                                <span>{cat.coverImageId ? t("CUSTOM COVER", "カバー変更") : t("SET COVER", "カバー設定")}</span>
                              </button>
                            )}

                            {coverUrl && onCycleCategoryCoverPosition && (
                              <button
                                type="button"
                                onClick={(e) => onCycleCategoryCoverPosition(cat.id, e)}
                                className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-sm z-10 transition-colors"
                                title={t("Cycle crop position", "トリミング位置切替")}
                              >
                                <span>POS:</span>
                                <span className="text-amber-400 uppercase font-bold">
                                  {cat.coverImagePosition === "center"
                                    ? "MID"
                                    : cat.coverImagePosition === "bottom"
                                    ? "BTM"
                                    : "TOP"}
                                </span>
                              </button>
                            )}

                            {/* Drag over badge */}
                            {isFolderDragOver && (
                              <div className="absolute inset-0 bg-accent/90 backdrop-blur-xs flex flex-col items-center justify-center text-accent-text font-mono font-bold text-xs">
                                <FolderOpen size={28} className="mb-1 animate-bounce" />
                                <span>{t("DROP TO MOVE HERE", "ドロップして移動")}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CONTENT */}
                        <div
                          className={cn(
                            "relative z-10 flex flex-col justify-between flex-1",
                            homeViewMode === "card" ? "p-3" : ""
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 w-full mb-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {/* Prominent Grip Handle for Folder */}
                              <div
                                className="p-0.5 text-text-muted/50 hover:text-folder-icon cursor-grab active:cursor-grabbing transition-colors shrink-0"
                                title={t("Drag folder to re-organize", "ドラッグしてフォルダーを移動")}
                              >
                                <GripVertical size={14} className="text-folder-icon/80" />
                              </div>
                              {homeViewMode !== "card" && (
                                <FolderIconComponent
                                  iconType={cat.icon}
                                  size={18}
                                  className={cn(
                                    "text-folder-icon shrink-0 group-hover:scale-110 transition-transform",
                                    isFolderDragOver && "animate-bounce text-accent"
                                  )}
                                  style={{ color: cat.color || undefined }}
                                />
                              )}
                              <span className="font-mono text-sm font-bold truncate text-text-primary group-hover:text-folder-icon transition-colors">
                                {cat.name}
                              </span>
                            </div>

                            {/* Folder actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {onSetCategoryCoverImage && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenCategoryCoverModal(cat, e)}
                                  className={cn(
                                    "p-1 hover:text-amber-400 text-text-muted transition-colors",
                                    cat.coverImageId && "text-amber-400"
                                  )}
                                  title={cat.coverImageId ? t("Cover image is set (Click to edit)", "カバー画像設定中（クリックで変更）") : t("Set Folder Cover Image", "フォルダーカバー画像を設定")}
                                >
                                  <Bookmark size={12} fill={cat.coverImageId ? "currentColor" : "none"} />
                                </button>
                              )}
                              {onRequestColorCategoryModal && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRequestColorCategoryModal(cat);
                                  }}
                                  className="p-1 hover:text-accent text-text-muted transition-colors"
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
                                className="p-1 hover:text-amber-400 text-text-muted transition-colors"
                                title={t("Move Folder Parent", "親フォルダー変更")}
                              >
                                <FolderInput size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => onRenameCategory(e, cat)}
                                className="p-1 hover:text-amber-400 text-text-muted transition-colors text-[10px] font-bold"
                                title={t("Rename Folder", "名前変更")}
                              >
                                [E]
                              </button>
                              <button
                                type="button"
                                onClick={(e) => onDeleteCategory(e, cat)}
                                className="p-1 hover:text-red-400 text-text-muted transition-colors"
                                title={t("Delete Folder", "削除")}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mt-1 pt-2 border-t border-panel-border/40">
                            <span>
                              {subCount > 0 && `${subCount} dirs `}
                              {dsCount} sets ({totalImages} imgs)
                            </span>

                            {/* Move button */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestMoveCategoryModal(cat);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-panel-border/50 hover:bg-folder-icon hover:text-black rounded text-[9px] font-mono text-text-secondary transition-colors"
                                title={t("Move folder to another parent", "親フォルダーを変更")}
                              >
                                <FolderInput size={11} />
                                <span>{t("MOVE", "移動")}</span>
                              </button>
                              <span className={cn("transition-opacity flex items-center gap-0.5", isFolderDragOver ? "text-accent font-bold" : "text-folder-icon opacity-0 group-hover:opacity-100")}>
                                {isFolderDragOver ? t("DROP!", "ドロップ!") : "OPEN →"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Datasets Grid (DRAGGABLE DATASET CARDS!) */}
          {currentDatasets.length > 0 && (
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center gap-2 font-mono text-xs text-text-muted uppercase tracking-widest px-1">
                <Layers size={13} className="text-accent" />
                <span>{t("DATASETS", "データセット")} ({currentDatasets.length})</span>
              </div>
              <div
                className={cn(
                  "w-full pb-12",
                  homeViewMode === "list"
                    ? "flex flex-col gap-2"
                    : "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4"
                )}
              >
                {currentDatasets.map((ds) => {
                  const count = datasetCounts[ds.id] || 0;
                  const isFav = favoriteDatasetId === ds.id;
                  const previewUrl = datasetPreviewUrls[ds.id];
                  const isDsSelected = selectedDatasetIds.has(ds.id);
                  const isDatasetDragOver = dragOverTargetKey === ds.id;

                  if (homeViewMode === "list") {
                    return (
                      <div
                        key={ds.id}
                        draggable
                        onDragStart={(e) => handleDatasetDragStart(e, ds.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleFolderDragOver(e, ds.id)}
                        onDragLeave={(e) => handleFolderDragLeave(e, ds.id)}
                        onDrop={(e) => handleDatasetCardDrop(e, ds)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            handleSelectWithShift("dataset", ds.id, e);
                          } else if (totalSelected > 0) {
                            toggleDatasetSelect(ds.id, e);
                          } else {
                            onSelectDataset(ds.id);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded border font-mono text-xs transition-all cursor-pointer group select-none",
                          isDsSelected
                            ? "bg-accent/20 border-accent text-accent font-bold shadow-md"
                            : isDatasetDragOver
                            ? "bg-accent/30 border-accent text-accent ring-2 ring-accent scale-[1.01]"
                            : "bg-panel-bg/90 border-panel-border hover:border-accent hover:bg-accent/15 text-text-primary"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Selection Checkbox (Shift+Click supported) */}
                          <div
                            onClick={(e) => handleSelectWithShift("dataset", ds.id, e)}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-all",
                              isDsSelected
                                ? "bg-accent border-accent text-accent-text"
                                : "border-panel-border/80 hover:border-accent hover:bg-accent/10"
                            )}
                            title={t("Click or Shift+Click to select range", "クリックまたはShift+クリックで範囲選択")}
                          >
                            {isDsSelected ? <Check size={12} className="stroke-[3]" /> : null}
                          </div>

                          {/* Drag Grip */}
                          <GripVertical size={14} className="shrink-0 opacity-40 group-hover:opacity-100 text-folder-icon cursor-grab" />

                          {/* Dataset Icon */}
                          <Layers size={16} className="shrink-0 text-accent -translate-y-[1px]" />

                          {/* Dataset Name */}
                          <span className="font-bold truncate text-sm tracking-wide">
                            {ds.name}
                          </span>

                          {/* Pin & Favorite badges */}
                          {ds.pinned && (
                            <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.2 rounded border border-amber-500/40 shrink-0">
                              PIN
                            </span>
                          )}
                          {isFav && (
                            <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                          )}

                          {/* Counts badge */}
                          <span className="text-[10px] text-text-muted shrink-0 font-mono">
                            ({count} {t("IMAGES", "枚")})
                          </span>
                        </div>

                        {/* Right side actions */}
                        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleOpenDatasetCoverModal(ds, e)}
                            className="p-1 hover:text-amber-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                            title={t("Select Cover Art", "カバー画像を選択")}
                          >
                            <ImageIcon size={13} className={ds.coverImageId ? "text-amber-400" : ""} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => onTogglePinDataset(ds.id, e)}
                            className="p-1 hover:text-amber-400 text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                            title={t("Toggle Pin", "ピン留め切り替え")}
                          >
                            <Pin size={13} className={ds.pinned ? "text-amber-400 fill-amber-400" : ""} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestMoveDatasetModal(ds);
                            }}
                            className="p-1 hover:text-accent text-text-muted hover:bg-panel-border/50 rounded transition-colors"
                            title={t("Move Dataset", "フォルダーへ移動")}
                          >
                            <FolderInput size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={ds.id}
                      draggable
                      onDragStart={(e) => handleDatasetDragStart(e, ds.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleFolderDragOver(e, ds.id)}
                      onDragLeave={(e) => handleFolderDragLeave(e, ds.id)}
                      onDrop={(e) => handleDatasetCardDrop(e, ds)}
                      className={cn(
                        "relative group select-none cursor-pointer transition-all",
                        isDsSelected
                          ? "ring-2 ring-accent border-accent bg-accent/10 shadow-lg scale-[1.01]"
                          : isDatasetDragOver
                          ? "ring-2 ring-accent border-accent scale-[1.02] shadow-xl"
                          : ""
                      )}
                      onMouseEnter={(e) => {
                        setHoveredItemId(ds.id);
                        setPopupMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        setPopupMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      {/* Selection Checkbox (K-Navigator Style) */}
                      <div
                        onClick={(e) => handleSelectWithShift("dataset", ds.id, e)}
                        className={cn(
                          "absolute top-2 left-2 z-20 w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer border shadow-md",
                          isDsSelected
                            ? "bg-accent border-accent text-accent-text font-bold scale-110"
                            : totalSelected > 0
                            ? "bg-panel-bg/95 border-accent/80 text-text-muted hover:border-accent"
                            : "bg-panel-bg/85 border-panel-border/80 text-transparent opacity-0 group-hover:opacity-100 hover:border-accent hover:text-accent"
                        )}
                        title={t("Select dataset", "データセットを選択")}
                      >
                        <CheckSquare size={13} className={isDsSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"} />
                      </div>

                      <div
                        onClick={(e) => {
                          if (totalSelected > 0) {
                            toggleDatasetSelect(ds.id, e);
                          } else {
                            onSelectDataset(ds.id);
                          }
                        }}
                        className={cn(
                          "w-full h-full flex flex-col justify-between transition-all text-left shadow-sm hover:shadow-md text-text-primary overflow-hidden relative border rounded-[3px]",
                          "border-panel-border hover:border-accent/70",
                          homeViewMode === "card"
                            ? "p-0 bg-panel-bg/90"
                            : "p-4 min-h-[105px] sm:min-h-[110px] bg-panel-bg/85 hover:bg-panel-bg backdrop-blur-md"
                        )}
                      >
                        {/* COVER MODE */}
                        {homeViewMode === "cover" && previewUrl && (
                          <div
                            className="absolute inset-0 z-0 bg-cover pointer-events-none opacity-[var(--cover-base-op,0.32)] group-hover:opacity-[var(--cover-hover-op,0.48)] transition-opacity duration-300 transform scale-105 group-hover:scale-100"
                            style={{
                              backgroundImage: `url(${previewUrl})`,
                              backgroundPosition: getCoverPositionStyle(ds.coverImagePosition),
                              filter: "var(--cover-blur-filter, none)",
                            }}
                          />
                        )}

                            {/* COVER MODE POS & COVER SELECT BUTTON */}
                            {homeViewMode === "cover" && previewUrl && (
                              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenDatasetCoverModal(ds, e)}
                                  className="bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-md cursor-pointer transition-colors"
                                  title={t("Select Cover Art", "カバー画像を選択")}
                                >
                                  <ImageIcon size={9} className={ds.coverImageId ? "text-amber-400" : "text-white/80"} />
                                  <span>{t("COVER", "カバー")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => onCycleCoverPosition(ds.id, e)}
                                  className="bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-md cursor-pointer transition-colors"
                                  title={t("Cycle crop position", "トリミング位置切替")}
                                >
                                  <span>POS:</span>
                                  <span className="text-amber-400 uppercase font-bold">
                                    {ds.coverImagePosition === "center"
                                      ? "MID"
                                      : ds.coverImagePosition === "bottom"
                                      ? "BTM"
                                      : "TOP"}
                                  </span>
                                </button>
                              </div>
                            )}

                        {/* CARD MODE */}
                        {homeViewMode === "card" && (
                          <div className="w-full aspect-[16/11] sm:aspect-[16/11] max-h-[225px] sm:max-h-[240px] bg-black/20 overflow-hidden relative flex items-center justify-center border-b border-panel-border/60">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={ds.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                style={{
                                  objectPosition: getCoverPositionStyle(ds.coverImagePosition),
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-text-muted/40 font-mono text-[10px]">
                                <ImageIcon size={24} className="mb-1 opacity-50" />
                                <span>EMPTY</span>
                              </div>
                            )}
                            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                              {isFav && (
                                <div className="bg-black/60 p-1 rounded-full backdrop-blur-xs">
                                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                </div>
                              )}
                              {!ds.isPinned && (
                                <button
                                  type="button"
                                  onClick={(e) => onTogglePinDataset(ds.id, e)}
                                  className="p-1 rounded-full backdrop-blur-xs transition-opacity bg-black/60 text-white/70 hover:text-white opacity-0 group-hover:opacity-100"
                                  title={t("PIN TO TOP", "最上部にピン留め固定")}
                                >
                                  <Pin size={12} />
                                </button>
                              )}
                            </div>
                            {previewUrl && (
                              <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenDatasetCoverModal(ds, e)}
                                  className="bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-md cursor-pointer transition-colors"
                                  title={t("Select Cover Art", "カバー画像を選択")}
                                >
                                  <ImageIcon size={9} className={ds.coverImageId ? "text-amber-400" : "text-white/80"} />
                                  <span>{t("COVER", "カバー")}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => onCycleCoverPosition(ds.id, e)}
                                  className="bg-black/80 hover:bg-black text-white hover:text-amber-400 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/25 backdrop-blur-xs flex items-center gap-0.5 shadow-md cursor-pointer transition-colors"
                                  title={t("Cycle crop position", "トリミング位置切替")}
                                >
                                  <span>POS:</span>
                                  <span className="text-amber-400 uppercase font-bold">
                                    {ds.coverImagePosition === "center"
                                      ? "MID"
                                      : ds.coverImagePosition === "bottom"
                                      ? "BTM"
                                      : "TOP"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CONTENT */}
                        <div
                          className={cn(
                            "relative z-10 flex flex-col justify-between flex-1",
                            homeViewMode === "card" ? "p-3" : ""
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 w-full mb-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {/* Prominent Grip Handle for Dataset */}
                              <div
                                className="p-0.5 text-text-muted/50 hover:text-accent cursor-grab active:cursor-grabbing transition-colors shrink-0"
                                title={t("Drag dataset to move into folder", "ドラッグしてフォルダーへ移動")}
                              >
                                <GripVertical size={14} className="text-accent/80" />
                              </div>
                              {homeViewMode !== "card" && (
                                <Layers
                                  size={16}
                                  className="text-accent shrink-0 group-hover:scale-110 transition-transform"
                                />
                              )}
                              {ds.isPinned && (
                                <button
                                  type="button"
                                  onClick={(e) => onTogglePinDataset(ds.id, e)}
                                  className="p-0.5 rounded text-accent hover:opacity-75 transition-opacity"
                                  title={t("UNPIN FROM TOP", "ピン留め解除")}
                                >
                                  <Pin size={11} className="fill-accent rotate-45" />
                                </button>
                              )}
                              <span className="font-mono text-sm font-bold truncate group-hover:text-accent transition-colors">
                                {ds.name}
                              </span>
                            </div>
                            {homeViewMode !== "card" && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!ds.isPinned && (
                                  <button
                                    type="button"
                                    onClick={(e) => onTogglePinDataset(ds.id, e)}
                                    className="transition-opacity p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 text-text-muted hover:text-text-primary"
                                    title={t("PIN TO TOP", "最上部にピン留め固定")}
                                  >
                                    <Pin size={13} />
                                  </button>
                                )}
                                {isFav && (
                                  <Star
                                    size={12}
                                    className="text-yellow-400 fill-yellow-400 shrink-0"
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-text-muted mt-1 pt-2 border-t border-panel-border/40">
                            <span>
                              {count} {count === 1 ? "IMAGE" : "IMAGES"}
                            </span>

                            {/* Actions: Cover & Move & Open */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleOpenDatasetCoverModal(ds, e)}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-panel-border/50 hover:bg-amber-500 hover:text-black rounded text-[9px] font-mono text-text-secondary transition-colors"
                                title={t("Select Cover Art", "カバー画像を選択")}
                              >
                                <ImageIcon size={10} className={ds.coverImageId ? "text-amber-500" : ""} />
                                <span>{t("COVER", "カバー")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestMoveDatasetModal(ds);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 bg-panel-border/50 hover:bg-accent hover:text-accent-text rounded text-[9px] font-mono text-text-secondary transition-colors"
                                title={t("Move dataset to another folder", "他のフォルダーへ移動")}
                              >
                                <FolderInput size={11} />
                                <span>{t("MOVE", "移動")}</span>
                              </button>
                              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                OPEN &rarr;
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* POPUP PREVIEW FLOATER */}
          {homeViewMode === "popup" && hoveredItemId && (() => {
            const hoveredDs = datasets.find((d) => d.id === hoveredItemId);
            const hoveredCat = !hoveredDs ? categories.find((c) => c.id === hoveredItemId) : null;

            if (!hoveredDs && !hoveredCat) return null;

            const previewUrl = hoveredDs
              ? datasetPreviewUrls[hoveredDs.id]
              : hoveredCat
              ? getCategoryCoverUrl(hoveredCat.id)
              : null;

            if (!previewUrl) return null;

            const name = hoveredDs ? hoveredDs.name : hoveredCat?.name || "";
            const count = hoveredDs
              ? (datasetCounts[hoveredDs.id] || 0)
              : hoveredCat
              ? getCategoryTotalCount(hoveredCat.id)
              : 0;
            const coverPos = hoveredDs
              ? hoveredDs.coverImagePosition
              : hoveredCat?.coverImagePosition;

            const popupWidth = 190;

            let left = popupMousePos.x - popupWidth / 2;
            if (typeof window !== "undefined") {
              left = Math.min(window.innerWidth - popupWidth - 16, Math.max(16, left));
            }
            const top = popupMousePos.y + 16;

            return (
              <div
                style={{ left: `${left}px`, top: `${top}px` }}
                className="fixed z-[100] pointer-events-none w-[190px] bg-panel-bg border border-accent/60 shadow-2xl p-2 font-mono flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="w-full aspect-[4/3] bg-black/40 overflow-hidden flex items-center justify-center border border-panel-border">
                  <img
                    src={previewUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: getCoverPositionStyle(coverPos),
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-text-primary px-1">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {hoveredCat ? (
                      <Folder size={11} className="text-folder-icon shrink-0" />
                    ) : (
                      <Layers size={11} className="text-accent shrink-0" />
                    )}
                    <span className="truncate font-bold text-accent">{name}</span>
                  </div>
                  <span className="text-text-muted text-[9px] shrink-0 ml-1">({count})</span>
                </div>
              </div>
            );
          })()}

          {/* BULK MOVE MODAL */}
          <AnimatePresence>
            {showBulkMoveModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
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
                      onClick={() => executeBulkMove(null)}
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
                          onClick={() => executeBulkMove(cat.id)}
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

          {/* BULK DELETE CONFIRMATION MODAL */}
          <AnimatePresence>
            {showBulkDeleteModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
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

                  {/* Actions */}
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
                      onClick={executeBulkDelete}
                      className="px-5 py-2 text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white border border-red-400 shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      <span>{t("CONFIRM DELETE", "一括削除実行")}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BULK RENAME MODAL */}
          <AnimatePresence>
            {showBulkRenameModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-4 backdrop-blur-sm"
              >
                <div className="bg-panel-bg border border-accent/60 p-5 font-mono w-[780px] max-w-[96vw] h-[840px] max-h-[96vh] flex flex-col shadow-2xl rounded-xs">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-panel-border/60 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Edit3 size={18} className="text-accent shrink-0" />
                      <div>
                        <h2 className="text-text-primary text-sm font-bold tracking-wider uppercase">
                          {t("BATCH RENAME FOLDERS & DATASETS", "フォルダー・データセット名の一括編集")}
                        </h2>
                        <p className="text-[10px] text-text-muted">
                          {t(
                            `Target: ${getBulkRenameItemsList().length} Item(s)`,
                            `対象項目: 合計 ${getBulkRenameItemsList().length}件`
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBulkRenameModal(false)}
                      className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Target Scope Switcher */}
                  <div className="flex items-center gap-1 bg-root-bg/90 p-1 border border-panel-border rounded-xs mb-3 text-[11px] font-mono shrink-0">
                    <span className="text-text-muted px-1 font-bold shrink-0 uppercase text-[10px] hidden sm:inline">{t("SCOPE:", "対象範囲:")}</span>
                    <button
                      type="button"
                      onClick={() => handleTargetScopeChange("all_datasets")}
                      className={cn(
                        "px-2 py-1 rounded-xs transition-all font-bold cursor-pointer text-xs flex-1 text-center whitespace-nowrap",
                        targetScope === "all_datasets"
                          ? "bg-accent/20 text-accent border border-accent/50 shadow-xs"
                          : "text-text-secondary hover:text-text-primary border border-transparent"
                      )}
                    >
                      {t("ALL DATASETS", "全リスト")} ({datasets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTargetScopeChange("all_categories")}
                      className={cn(
                        "px-2 py-1 rounded-xs transition-all font-bold cursor-pointer text-xs flex-1 text-center whitespace-nowrap",
                        targetScope === "all_categories"
                          ? "bg-accent/20 text-accent border border-accent/50 shadow-xs"
                          : "text-text-secondary hover:text-text-primary border border-transparent"
                      )}
                    >
                      {t("ALL FOLDERS", "全フォルダー")} ({categories.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTargetScopeChange("all_items")}
                      className={cn(
                        "px-2 py-1 rounded-xs transition-all font-bold cursor-pointer text-xs flex-1 text-center whitespace-nowrap",
                        targetScope === "all_items"
                          ? "bg-accent/20 text-accent border border-accent/50 shadow-xs"
                          : "text-text-secondary hover:text-text-primary border border-transparent"
                      )}
                    >
                      {t("ALL ITEMS", "全項目")} ({categories.length + datasets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTargetScopeChange("selected")}
                      className={cn(
                        "px-2 py-1 rounded-xs transition-all font-bold cursor-pointer text-xs flex-1 text-center whitespace-nowrap",
                        targetScope === "selected"
                          ? "bg-accent/20 text-accent border border-accent/50 shadow-xs"
                          : "text-text-secondary hover:text-text-primary border border-transparent"
                      )}
                    >
                      {t("CURRENT VIEW", "現在の階層")} ({currentSubcategories.length + currentDatasets.length})
                    </button>
                  </div>

                  {/* Mode Tab Switcher */}
                  <div className="flex items-center gap-1 bg-root-bg p-1 border border-panel-border rounded-xs mb-3 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setBulkRenameTab("quick")}
                      className={cn(
                        "flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-xs font-bold transition-all cursor-pointer",
                        bulkRenameTab === "quick"
                          ? "bg-accent text-accent-text shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Type size={13} />
                      <span>{t("QUICK LIST EDIT", "リスト直接修正")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkRenameTab("replace")}
                      className={cn(
                        "flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-xs font-bold transition-all cursor-pointer",
                        bulkRenameTab === "replace"
                          ? "bg-accent text-accent-text shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Replace size={13} />
                      <span>{t("TEXT REPLACE", "文字列一括置換")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkRenameTab("prefix")}
                      className={cn(
                        "flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-xs font-bold transition-all cursor-pointer",
                        bulkRenameTab === "prefix"
                          ? "bg-accent text-accent-text shadow-xs"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      <Hash size={13} />
                      <span>{t("PREFIX / SUFFIX / NUMBERING", "前後記号・連番")}</span>
                    </button>
                  </div>

                  {/* Controls based on selected Tab */}
                  <div className="mb-3 bg-root-bg/60 p-3.5 border border-panel-border rounded-xs text-xs shrink-0 flex flex-col justify-center">
                    {bulkRenameTab === "quick" && (
                      <div className="flex items-center justify-center h-full text-center px-4">
                        <p className="text-xs text-text-secondary leading-relaxed font-mono">
                          {t(
                            "💡 Edit each item name individually below. Changes apply to checked items.",
                            "💡 以下のリストで名称を1件ずつ直接編集できます。チェック（☑）が入っている項目のみに名前の変更が反映されます。"
                          )}
                        </p>
                      </div>
                    )}

                    {bulkRenameTab === "replace" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-auto font-mono">
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                            {t("SEARCH TEXT (置換前の文字)", "置換前（検索）文字列")}
                          </label>
                          <input
                            type="text"
                            value={replaceSearch}
                            onChange={(e) => setReplaceSearch(e.target.value)}
                            placeholder={t("e.g. 2024", "例: 2024 や [旧]")}
                            className="w-full bg-panel-bg border border-panel-border text-text-primary px-2.5 py-1.5 text-xs rounded-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                            {t("REPLACE WITH (置換後の文字)", "置換後（新しい）文字列")}
                          </label>
                          <input
                            type="text"
                            value={replaceWith}
                            onChange={(e) => setReplaceWith(e.target.value)}
                            placeholder={t("e.g. 2025", "例: 2025 や [新]")}
                            className="w-full bg-panel-bg border border-panel-border text-text-primary px-2.5 py-1.5 text-xs rounded-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>
                    )}

                    {bulkRenameTab === "prefix" && (
                      <div className="space-y-2 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                              {t("PREFIX (先頭に付与)", "前に追加する文字")}
                            </label>
                            <input
                              type="text"
                              value={prefixInput}
                              onChange={(e) => setPrefixInput(e.target.value)}
                              placeholder={t("e.g. [WORK] ", "例: 【重要】 や 01_")}
                              className="w-full bg-panel-bg border border-panel-border text-text-primary px-2.5 py-1 text-xs rounded-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                              {t("SUFFIX (末尾に付与)", "後ろに追加する文字")}
                            </label>
                            <input
                              type="text"
                              value={suffixInput}
                              onChange={(e) => setSuffixInput(e.target.value)}
                              placeholder={t("e.g. _DONE", "例: _完了 や _2025")}
                              className="w-full bg-panel-bg border border-panel-border text-text-primary px-2.5 py-1 text-xs rounded-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {/* Character Trim Controls */}
                        <div className="grid grid-cols-2 gap-2 bg-panel-bg/40 p-2 rounded-xs border border-panel-border/30">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">
                              {t("TRIM START:", "先頭削除:")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={trimStart}
                              onChange={(e) => setTrimStart(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 text-xs text-center focus:outline-none focus:border-accent"
                            />
                            <span className="text-[10px] text-text-muted">{t("chars", "文字")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">
                              {t("TRIM END:", "末尾削除:")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={trimEnd}
                              onChange={(e) => setTrimEnd(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-12 bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 text-xs text-center focus:outline-none focus:border-accent"
                            />
                            <span className="text-[10px] text-text-muted">{t("chars", "文字")}</span>
                          </div>
                        </div>

                        {/* Sequential Numbering Option */}
                        <div className="pt-1 border-t border-panel-border/40 flex flex-wrap items-center justify-between gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={enableNumbering}
                              onChange={(e) => setEnableNumbering(e.target.checked)}
                              className="accent-accent cursor-pointer"
                            />
                            <span className="font-bold text-[11px] text-text-primary">
                              {t("Enable Sequential Numbers", "連番の自動付与")}
                            </span>
                          </label>

                          {enableNumbering && (
                            <div className="flex items-center gap-2 font-mono text-[10px]">
                              <div className="flex items-center gap-1">
                                <span className="text-text-muted">{t("Start:", "開始:")}</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={numberStart}
                                  onChange={(e) => setNumberStart(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-9 bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 text-center focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-text-muted">{t("Digits:", "桁数:")}</span>
                                <select
                                  value={numberDigits}
                                  onChange={(e) => setNumberDigits(parseInt(e.target.value))}
                                  className="bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 focus:outline-none focus:border-accent"
                                >
                                  <option value={1}>1桁</option>
                                  <option value={2}>2桁(01)</option>
                                  <option value={3}>3桁(001)</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-text-muted">{t("Pos:", "位置:")}</span>
                                <select
                                  value={numberPosition}
                                  onChange={(e) => setNumberPosition(e.target.value as "prefix" | "suffix")}
                                  className="bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 focus:outline-none focus:border-accent"
                                >
                                  <option value="prefix">{t("Prefix", "先頭")}</option>
                                  <option value="suffix">{t("Suffix", "末尾")}</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-text-muted">{t("Order:", "順序:")}</span>
                                <select
                                  value={numberOrder}
                                  onChange={(e) => setNumberOrder(e.target.value as "asc" | "desc")}
                                  className="bg-panel-bg border border-panel-border text-text-primary px-1 py-0.5 focus:outline-none focus:border-accent"
                                >
                                  <option value="asc">{t("Asc (1→N)", "昇順 (1→N)")}</option>
                                  <option value="desc">{t("Desc (N→1)", "降順 (N→1)")}</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Realtime Preview Table */}
                  {(() => {
                    const visibleItems = getBulkRenameItemsList();
                    const selectedCount = visibleItems.filter((i) => checkedRenameIds.has(i.id)).length;
                    const changedCount = visibleItems.filter((i) => checkedRenameIds.has(i.id) && i.newName !== i.originalName && i.newName.trim() !== "").length;
                    const isAllVisibleChecked = visibleItems.length > 0 && visibleItems.every((i) => checkedRenameIds.has(i.id));

                    return (
                      <>
                        <div className="text-[11px] font-bold uppercase text-text-muted mb-1.5 flex items-center justify-between px-1 shrink-0">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleSelectAllRename(visibleItems)}
                              className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary cursor-pointer font-mono"
                              title={t("Toggle select all visible items", "全選択/全解除")}
                            >
                              {isAllVisibleChecked ? (
                                <CheckSquare size={14} className="text-accent" />
                              ) : (
                                <Square size={14} className="text-text-muted" />
                              )}
                              <span>{t("ALL", "全選択")}</span>
                            </button>
                            <span className="text-panel-border">|</span>
                            <span>{t("PREVIEW & SELECTION", "対象選択＆結果確認")}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Search Filter Box */}
                            <div className="flex items-center gap-1.5 bg-root-bg border border-panel-border px-2 py-0.5 rounded-xs w-44">
                              <Search size={11} className="text-text-muted shrink-0" />
                              <input
                                type="text"
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                placeholder={t("Filter items...", "項目名で絞り込み...")}
                                className="bg-transparent text-text-primary text-[10px] w-full outline-none font-mono"
                              />
                              {filterSearch && (
                                <button type="button" onClick={() => setFilterSearch("")} className="text-text-muted hover:text-text-primary cursor-pointer">
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] text-text-muted font-bold">
                              選択: <span className="text-text-primary">{selectedCount}/{visibleItems.length}</span>件
                              {changedCount > 0 && (
                                <span className="text-accent ml-1.5">({changedCount}件変更予定)</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-panel-border bg-root-bg p-2.5 flex flex-col gap-1.5 mb-3 min-h-[180px] scrollbar-dark">
                          {visibleItems.length === 0 ? (
                            <div className="py-8 text-center text-xs text-text-muted font-mono">
                              {t("No matching items found.", "該当する項目がありません。")}
                            </div>
                          ) : (
                            visibleItems.map((item) => {
                              const isChecked = checkedRenameIds.has(item.id);
                              const isChanged = isChecked && item.newName !== item.originalName && item.newName.trim() !== "";
                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "flex items-center gap-2 p-1.5 border rounded-xs transition-all",
                                    !isChecked
                                      ? "opacity-50 bg-panel-bg/20 border-panel-border/20"
                                      : isChanged
                                      ? "bg-accent/10 border-accent/40 shadow-xs"
                                      : "bg-panel-bg/60 border-panel-border/40"
                                  )}
                                >
                                  {/* Checkbox */}
                                  <button
                                    type="button"
                                    onClick={() => toggleItemRenameCheck(item.id)}
                                    className="p-0.5 shrink-0 cursor-pointer"
                                  >
                                    {isChecked ? (
                                      <CheckSquare size={16} className="text-accent shrink-0" />
                                    ) : (
                                      <Square size={16} className="text-text-muted hover:text-text-primary shrink-0" />
                                    )}
                                  </button>

                                  {/* Type Badge & Icon */}
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-panel-bg border border-panel-border text-text-muted font-bold shrink-0 flex items-center gap-1">
                                    {item.type === "category" ? (
                                      <>
                                        <Folder size={11} className="text-folder-icon shrink-0" />
                                        <span>フォルダ</span>
                                      </>
                                    ) : (
                                      <>
                                        <Layers size={11} className="text-accent shrink-0" />
                                        <span>リスト</span>
                                      </>
                                    )}
                                  </span>

                                  {bulkRenameTab === "quick" ? (
                                    <div className="flex items-center gap-2 w-full">
                                      <span className={cn("text-xs font-mono truncate w-1/3 shrink-0", isChecked ? "text-text-muted" : "text-text-muted/60")} title={item.originalName}>
                                        {item.originalName}
                                      </span>
                                      <ArrowRight size={12} className="text-text-muted shrink-0" />
                                      <input
                                        type="text"
                                        disabled={!isChecked}
                                        value={quickNames[item.id] ?? item.originalName}
                                        onChange={(e) =>
                                          setQuickNames((prev) => ({ ...prev, [item.id]: e.target.value }))
                                        }
                                        className="flex-1 bg-panel-bg border border-panel-border text-text-primary px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent rounded-xs disabled:opacity-50"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 w-full text-xs font-mono truncate">
                                      <span className={cn("truncate w-1/3 shrink-0", isChecked ? "text-text-muted" : "text-text-muted/60")} title={item.originalName}>
                                        {item.originalName}
                                      </span>
                                      <ArrowRight size={12} className="text-text-muted shrink-0" />
                                      <span
                                        className={cn(
                                          "truncate flex-1 font-mono",
                                          !isChecked
                                            ? "text-text-muted/60 line-through"
                                            : isChanged
                                            ? "text-accent font-bold"
                                            : "text-text-primary"
                                        )}
                                      >
                                        {item.newName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2 border-t border-panel-border/60">
                    <button
                      type="button"
                      onClick={() => setShowBulkRenameModal(false)}
                      className="px-4 py-2 text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      {t("CANCEL", "キャンセル")}
                    </button>
                    <button
                      type="button"
                      onClick={executeBulkRename}
                      className="px-5 py-2 text-xs font-mono font-bold bg-accent hover:bg-accent/90 text-accent-text border border-accent shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      <span>{t("APPLY RENAME", "一括変更を実行")}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category Cover Art Selection Modal */}
          <AnimatePresence>
            {categoryCoverModalTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
              >
                <div className="bg-panel-bg border border-amber-500/50 p-6 font-mono w-[760px] max-w-[94vw] h-[85vh] max-h-[800px] flex flex-col shadow-[0_0_40px_rgba(245,158,11,0.2)]">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-panel-border/80 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderIconComponent
                        iconType={categoryCoverModalTarget.icon}
                        size={20}
                        style={{ color: categoryCoverModalTarget.color || undefined }}
                        className="text-amber-400 shrink-0"
                      />
                      <div>
                        <h2 className="text-amber-400 font-bold text-sm uppercase flex items-center gap-2 truncate">
                          <span>{t("SELECT FOLDER COVER ART", "フォルダーのカバー画像を選択")}</span>
                        </h2>
                        <span className="text-[11px] text-text-muted">
                          {t("Folder: ", "フォルダー: ")}
                          <span className="text-text-primary font-bold">{categoryCoverModalTarget.name}</span>
                          {" "}• {categoryCoverCandidateImages.length} {t("images available in sub-datasets", "枚の画像が利用可能")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCategoryCoverModalTarget(null)}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-panel-border/50 rounded transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Top Controls: Search & Reset & Crop Position */}
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-panel-border/60 shrink-0">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={coverSearchQuery}
                        onChange={(e) => setCoverSearchQuery(e.target.value)}
                        placeholder={t("SEARCH IMAGES BY NAME...", "画像名で検索...")}
                        className="w-full bg-root-bg border border-panel-border text-text-primary pl-8 pr-3 py-1.5 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Crop position cycle button */}
                      {onCycleCategoryCoverPosition && (
                        <button
                          type="button"
                          onClick={(e) => onCycleCategoryCoverPosition(categoryCoverModalTarget.id, e)}
                          className="px-2.5 py-1.5 bg-root-bg border border-panel-border hover:border-accent text-text-primary hover:text-accent text-xs font-mono font-bold transition-colors flex items-center gap-1.5"
                          title={t("Cycle crop position", "トリミング表示位置切替")}
                        >
                          <span className="text-text-muted font-normal">POS:</span>
                          <span className="text-accent uppercase">
                            {categoryCoverModalTarget.coverImagePosition === "center"
                              ? "MID"
                              : categoryCoverModalTarget.coverImagePosition === "bottom"
                              ? "BTM"
                              : "TOP"}
                          </span>
                        </button>
                      )}

                      {/* Reset to Auto button */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (onSetCategoryCoverImage) {
                            await onSetCategoryCoverImage(categoryCoverModalTarget.id, null);
                            setCategoryCoverModalTarget((prev) => (prev ? { ...prev, coverImageId: undefined } : null));
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-mono border transition-colors flex items-center gap-1.5",
                          !categoryCoverModalTarget.coverImageId
                            ? "bg-amber-500/20 border-amber-500 text-amber-400 font-bold"
                            : "border-panel-border text-text-muted hover:text-text-primary hover:border-text-muted bg-root-bg"
                        )}
                        title={t("Reset to default automatic cover", "自動設定（先頭の画像）に戻す")}
                      >
                        <Bookmark size={13} className={!categoryCoverModalTarget.coverImageId ? "text-amber-400" : ""} />
                        <span>{t("AUTO (DEFAULT)", "自動（初期設定）")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Image Grid Area */}
                  <div className="flex-1 overflow-y-auto p-2 bg-root-bg/50 border border-panel-border/40 my-3 scrollbar-dark">
                    {isLoadingCoverImages ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12">
                        <ImageIcon size={36} className="animate-spin mb-3 text-amber-400 opacity-60" />
                        <span>{t("LOADING IMAGES...", "画像を読み込み中...")}</span>
                      </div>
                    ) : categoryCoverCandidateImages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12 text-center">
                        <ImageIcon size={40} className="mb-3 opacity-30" />
                        <p className="font-bold text-text-primary mb-1">
                          {t("NO IMAGES FOUND IN THIS FOLDER", "このフォルダー配下に画像がありません")}
                        </p>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          {t(
                            "Add datasets with images inside this folder to select a custom cover art.",
                            "このフォルダー内に画像を含むリストを作成すると、カバー画像を選択できるようになります。"
                          )}
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = coverSearchQuery.trim()
                          ? categoryCoverCandidateImages.filter((img) =>
                              img.name.toLowerCase().includes(coverSearchQuery.toLowerCase())
                            )
                          : categoryCoverCandidateImages;

                        if (filtered.length === 0) {
                          return (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12">
                              <span>{t("NO MATCHING IMAGES FOUND", "該当する画像が見つかりませんでした")}</span>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                            {filtered.map((img) => {
                              const isCurrentCover = categoryCoverModalTarget.coverImageId === img.id;
                              const imgUrl = img.data ? URL.createObjectURL(img.data) : "";

                              return (
                                <div
                                  key={img.id}
                                  onClick={async () => {
                                    if (onSetCategoryCoverImage) {
                                      const nextCoverId = isCurrentCover ? null : img.id;
                                      await onSetCategoryCoverImage(categoryCoverModalTarget.id, nextCoverId);
                                      setCategoryCoverModalTarget((prev) =>
                                        prev ? { ...prev, coverImageId: nextCoverId || undefined } : null
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "group relative aspect-square bg-black/40 border rounded-[2px] overflow-hidden cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between shadow-sm",
                                    isCurrentCover
                                      ? "border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                      : "border-panel-border/80 hover:border-amber-400/80"
                                  )}
                                >
                                  {imgUrl && (
                                    <img
                                      src={imgUrl}
                                      alt={img.name}
                                      className="w-full h-full object-cover"
                                      style={{
                                        objectPosition: getCoverPositionStyle(categoryCoverModalTarget.coverImagePosition),
                                      }}
                                      referrerPolicy="no-referrer"
                                    />
                                  )}

                                  {/* Badge on Image */}
                                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                                    {isCurrentCover ? (
                                      <span className="bg-amber-500 text-black font-bold text-[9px] px-1.5 py-0.5 rounded-[2px] shadow-sm flex items-center gap-1">
                                        <Bookmark size={10} fill="currentColor" />
                                        <span>{t("COVER", "カバー")}</span>
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                  </div>

                                  {/* Name label at bottom */}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-4 pointer-events-none">
                                    <span className="text-[10px] font-mono text-white/90 truncate block drop-shadow-sm">
                                      {img.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-panel-border/60 shrink-0">
                    <span className="text-[11px] text-text-muted">
                      {t("Click any image to set/unset as folder cover", "画像をクリックしてフォルダーのカバーに設定/解除します")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCategoryCoverModalTarget(null)}
                      className="px-5 py-2 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 shadow-md transition-all cursor-pointer"
                    >
                      {t("DONE", "完了")}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dataset Cover Art Selection Modal */}
          <AnimatePresence>
            {datasetCoverModalTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-6 backdrop-blur-sm"
              >
                <div className="bg-panel-bg border border-amber-500/50 p-6 font-mono w-[760px] max-w-[94vw] h-[85vh] max-h-[800px] flex flex-col shadow-[0_0_40px_rgba(245,158,11,0.2)]">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-panel-border/80 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Layers size={20} className="text-accent shrink-0" />
                      <div>
                        <h2 className="text-amber-400 font-bold text-sm uppercase flex items-center gap-2 truncate">
                          <span>{t("SELECT DATASET COVER ART", "データセットのカバー画像を選択")}</span>
                        </h2>
                        <span className="text-[11px] text-text-muted">
                          {t("Dataset: ", "リスト: ")}
                          <span className="text-text-primary font-bold">{datasetCoverModalTarget.name}</span>
                          {" "}• {datasetCoverCandidateImages.length} {t("images available", "枚の画像が利用可能")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDatasetCoverModalTarget(null)}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-panel-border/50 rounded transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Top Controls: Search & Reset & Crop Position */}
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-panel-border/60 shrink-0">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={datasetCoverSearchQuery}
                        onChange={(e) => setDatasetCoverSearchQuery(e.target.value)}
                        placeholder={t("SEARCH IMAGES BY NAME...", "画像名で検索...")}
                        className="w-full bg-root-bg border border-panel-border text-text-primary pl-8 pr-3 py-1.5 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Crop position cycle button */}
                      {onCycleCoverPosition && (
                        <button
                          type="button"
                          onClick={(e) => onCycleCoverPosition(datasetCoverModalTarget.id, e)}
                          className="px-2.5 py-1.5 bg-root-bg border border-panel-border hover:border-accent text-text-primary hover:text-accent text-xs font-mono font-bold transition-colors flex items-center gap-1.5"
                          title={t("Cycle crop position", "トリミング表示位置切替")}
                        >
                          <span className="text-text-muted font-normal">POS:</span>
                          <span className="text-accent uppercase">
                            {datasetCoverModalTarget.coverImagePosition === "center"
                              ? "MID"
                              : datasetCoverModalTarget.coverImagePosition === "bottom"
                              ? "BTM"
                              : "TOP"}
                          </span>
                        </button>
                      )}

                      {/* Reset to Auto button */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (onSetDatasetCoverImage) {
                            await onSetDatasetCoverImage(datasetCoverModalTarget.id, null);
                            setDatasetCoverModalTarget((prev) => (prev ? { ...prev, coverImageId: undefined } : null));
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-mono border transition-colors flex items-center gap-1.5",
                          !datasetCoverModalTarget.coverImageId
                            ? "bg-amber-500/20 border-amber-500 text-amber-400 font-bold"
                            : "border-panel-border text-text-muted hover:text-text-primary hover:border-text-muted bg-root-bg"
                        )}
                        title={t("Reset to default automatic cover", "自動設定（先頭の画像）に戻す")}
                      >
                        <Bookmark size={13} className={!datasetCoverModalTarget.coverImageId ? "text-amber-400" : ""} />
                        <span>{t("AUTO (DEFAULT)", "自動（初期設定）")}</span>
                      </button>
                    </div>
                  </div>

                  {/* Image Grid Area */}
                  <div className="flex-1 overflow-y-auto p-2 bg-root-bg/50 border border-panel-border/40 my-3 scrollbar-dark">
                    {isLoadingDatasetCoverImages ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12">
                        <ImageIcon size={36} className="animate-spin mb-3 text-amber-400 opacity-60" />
                        <span>{t("LOADING IMAGES...", "画像を読み込み中...")}</span>
                      </div>
                    ) : datasetCoverCandidateImages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12 text-center">
                        <ImageIcon size={40} className="mb-3 opacity-30" />
                        <p className="font-bold text-text-primary mb-1">
                          {t("NO IMAGES FOUND IN THIS DATASET", "このリスト内に画像がありません")}
                        </p>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          {t(
                            "Add images to this dataset to select a custom cover art.",
                            "このリストに画像を追加すると、カバー画像を選択できるようになります。"
                          )}
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = datasetCoverSearchQuery.trim()
                          ? datasetCoverCandidateImages.filter((img) =>
                              img.name.toLowerCase().includes(datasetCoverSearchQuery.toLowerCase())
                            )
                          : datasetCoverCandidateImages;

                        if (filtered.length === 0) {
                          return (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs font-mono py-12">
                              <span>{t("NO MATCHING IMAGES FOUND", "該当する画像が見つかりませんでした")}</span>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                            {filtered.map((img) => {
                              const isCurrentCover = datasetCoverModalTarget.coverImageId === img.id;
                              const imgUrl = img.data ? URL.createObjectURL(img.data) : "";

                              return (
                                <div
                                  key={img.id}
                                  onClick={async () => {
                                    if (onSetDatasetCoverImage) {
                                      const nextCoverId = isCurrentCover ? null : img.id;
                                      await onSetDatasetCoverImage(datasetCoverModalTarget.id, nextCoverId);
                                      setDatasetCoverModalTarget((prev) =>
                                        prev ? { ...prev, coverImageId: nextCoverId || undefined } : null
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "group relative aspect-square bg-black/40 border rounded-[2px] overflow-hidden cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between shadow-sm",
                                    isCurrentCover
                                      ? "border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                      : "border-panel-border/80 hover:border-amber-400/80"
                                  )}
                                >
                                  {imgUrl && (
                                    <img
                                      src={imgUrl}
                                      alt={img.name}
                                      className="w-full h-full object-cover"
                                      style={{
                                        objectPosition: getCoverPositionStyle(datasetCoverModalTarget.coverImagePosition),
                                      }}
                                      referrerPolicy="no-referrer"
                                    />
                                  )}

                                  {/* Badge on Image */}
                                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                                    {isCurrentCover ? (
                                      <span className="bg-amber-500 text-black font-bold text-[9px] px-1.5 py-0.5 rounded-[2px] shadow-sm flex items-center gap-1">
                                        <Bookmark size={10} fill="currentColor" />
                                        <span>{t("COVER", "カバー")}</span>
                                      </span>
                                    ) : (
                                      <span />
                                    )}
                                  </div>

                                  {/* Name label at bottom */}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-4 pointer-events-none">
                                    <span className="text-[10px] font-mono text-white/90 truncate block drop-shadow-sm">
                                      {img.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-panel-border/60 shrink-0">
                    <span className="text-[11px] text-text-muted">
                      {t("Click any image to set/unset as dataset cover", "画像をクリックしてリストのカバーに設定/解除します")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDatasetCoverModalTarget(null)}
                      className="px-5 py-2 text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 shadow-md transition-all cursor-pointer"
                    >
                      {t("DONE", "完了")}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
