export type ViewMode = "grid-sq" | "grid-ma" | "list" | "free";

export interface QuickStockRecord {
  id: string;
  name: string;
  createdAt: number;
  datasetId: string | null;
  categoryId: string | null;
  isCategoryImagesView?: boolean;
  datasetName?: string;
  categoryName?: string;
  viewMode: ViewMode;
  scale: number;
  gap: number;
  orientationFilter: "all" | "portrait" | "landscape";
  sortField: "name" | "size" | "type" | "date" | "custom" | "random";
  sortOrders: Record<string, "asc" | "desc">;
  showHiddenImages: boolean;
  searchQuery: string;
  scrollTop: number;
  scrollRatio: number;
  anchorImageId?: string;
}
