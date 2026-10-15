import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";
import { cn } from "../../lib/utils";
import { SolidButton } from "../ui";
import { DatasetRecord } from "../../lib/db";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: DatasetRecord[];
  datasetCounts: Record<string, number>;
  selectedExportDatasetIds: string[];
  setSelectedExportDatasetIds: React.Dispatch<React.SetStateAction<string[]>>;
  onExport: (targetIds: string[]) => void;
  t: (en: string, jp: string) => string;
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
                  onClick={() => setSelectedExportDatasetIds(datasets.map(d => d.id))}
                  className="text-accent hover:underline"
                >
                  {t("SELECT ALL", "すべて選択")}
                </button>
                <span className="text-text-secondary/40">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedExportDatasetIds([])}
                  className="text-text-secondary hover:text-text-primary hover:underline"
                >
                  {t("CLEAR", "解除")}
                </button>
              </div>
              <span className="text-text-secondary">
                {selectedExportDatasetIds.length} / {datasets.length} {t("SELECTED", "件選択中")}
              </span>
            </div>

            <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1 mb-5 border border-border-main p-2 bg-root-bg/40">
              {datasets.map(d => {
                const isChecked = selectedExportDatasetIds.includes(d.id);
                const count = datasetCounts[d.id] || 0;
                return (
                  <label
                    key={d.id}
                    className={cn(
                      "flex items-center justify-between p-2 cursor-pointer transition-colors border text-xs select-none",
                      isChecked
                        ? "bg-accent/10 border-accent/40 text-text-primary"
                        : "bg-panel-bg/40 border-border-main/50 text-text-secondary hover:bg-hover-bg"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedExportDatasetIds(prev => prev.filter(id => id !== d.id));
                          } else {
                            setSelectedExportDatasetIds(prev => [...prev, d.id]);
                          }
                        }}
                        className="rounded border-border-main bg-root-bg text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-root-bg border border-border-main text-text-secondary font-mono flex-shrink-0">
                      {count} {t("ITEMS", "件")}
                    </span>
                  </label>
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
