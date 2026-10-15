import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download } from "lucide-react";
import { SolidButton } from "../ui";
import { cn } from "../../lib/utils";

export interface DatasetExportItem {
  id: string;
  name: string;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: DatasetExportItem[];
  datasetCounts: Record<string, number>;
  selectedExportDatasetIds: string[];
  setSelectedExportDatasetIds: React.Dispatch<React.SetStateAction<string[]>>;
  onExport: (selectedIds: string[]) => void;
  t: (en: string, ja: string) => string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  datasets,
  datasetCounts,
  selectedExportDatasetIds,
  setSelectedExportDatasetIds,
  onExport,
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
          <div className="bg-panel-bg border border-accent/50 p-6 font-mono w-[480px] max-w-[90vw] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <h2 className="text-accent mb-2 flex items-center gap-2 text-sm uppercase">
              <Download size={18} /> {t("EXPORT DATASETS", "データセットのエクスポート")}
            </h2>
            <p className="text-text-secondary text-xs mb-4 leading-relaxed">
              {t(
                "Select the datasets to backup and export:",
                "バックアップ（エクスポート）するリストを選択してください："
              )}
            </p>

            <div className="flex items-center justify-between text-[11px] mb-2 px-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedExportDatasetIds(datasets.map((d) => d.id))}
                  className="text-accent hover:underline cursor-pointer"
                >
                  {t("SELECT ALL", "すべて選択")}
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedExportDatasetIds([])}
                  className="text-text-muted hover:text-text-primary hover:underline cursor-pointer"
                >
                  {t("DESELECT ALL", "全解除")}
                </button>
              </div>
              <span className="text-text-secondary font-mono">
                {selectedExportDatasetIds.length} / {datasets.length} {t("selected", "件選択中")}
              </span>
            </div>

            <div className="max-h-[340px] overflow-y-auto flex flex-col gap-1 pr-1 border border-panel-border/60 p-2 bg-root-bg/40 rounded-[2px] scrollbar-dark mb-6">
              {datasets.map((ds) => {
                const isChecked = selectedExportDatasetIds.includes(ds.id);
                const count = datasetCounts[ds.id] || 0;
                return (
                  <div
                    key={ds.id}
                    onClick={() => {
                      setSelectedExportDatasetIds((prev) =>
                        isChecked ? prev.filter((id) => id !== ds.id) : [...prev, ds.id]
                      );
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-xs font-mono cursor-pointer border rounded-[2px] transition-colors select-none",
                      isChecked
                        ? "bg-accent/10 border-accent/50 text-text-primary"
                        : "border-transparent text-text-muted hover:bg-panel-border/30 hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="accent-accent cursor-pointer"
                      />
                      <span className="truncate">{ds.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted shrink-0">
                      {count} {t("images", "枚")}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <SolidButton
                onClick={onClose}
                className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
              >
                {t("CANCEL", "キャンセル")}
              </SolidButton>
              <SolidButton
                onClick={() => {
                  if (selectedExportDatasetIds.length === 0) return;
                  onClose();
                  onExport(selectedExportDatasetIds);
                }}
                disabled={selectedExportDatasetIds.length === 0}
                className={cn(
                  "text-accent hover:text-accent border-accent/50",
                  selectedExportDatasetIds.length === 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                {t(
                  `EXPORT (${selectedExportDatasetIds.length})`,
                  `エクスポート (${selectedExportDatasetIds.length}件)`
                )}
              </SolidButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
