import React from "react";
import {
  Folder,
  FolderOpen,
  Pin,
  Star,
  Heart,
  Lock,
  Archive,
  Check,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "../lib/utils";

export type FolderIconType =
  | "folder"
  | "folder-pin"
  | "folder-star"
  | "folder-heart"
  | "folder-lock"
  | "folder-archive"
  | "folder-check"
  | "folder-plus"
  | "folder-search";

export interface FolderIconProps {
  iconType?: string | null;
  isOpen?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const FOLDER_ICON_OPTIONS: { id: FolderIconType; label: string; labelJp: string }[] = [
  { id: "folder", label: "Standard", labelJp: "標準フォルダー" },
  { id: "folder-pin", label: "Pinned", labelJp: "ピン付き" },
  { id: "folder-star", label: "Starred", labelJp: "スター付き" },
  { id: "folder-heart", label: "Favorite", labelJp: "ハート付き" },
  { id: "folder-lock", label: "Lock", labelJp: "鍵付き" },
  { id: "folder-archive", label: "Archive", labelJp: "アーカイブ" },
  { id: "folder-check", label: "Check", labelJp: "チェック" },
  { id: "folder-plus", label: "Plus", labelJp: "プラス付き" },
  { id: "folder-search", label: "Search", labelJp: "検索用" },
];

export const FolderIconComponent: React.FC<FolderIconProps> = ({
  iconType = "folder",
  isOpen = false,
  size = 14,
  className,
  style,
}) => {
  const BaseFolder = isOpen ? FolderOpen : Folder;
  const iconProps = { size, className: cn("shrink-0", className), style };

  if (!iconType || iconType === "folder") {
    return <BaseFolder {...iconProps} />;
  }

  const badgeSize = Math.max(9, Math.round(size * 0.55));

  const renderBadge = () => {
    switch (iconType) {
      case "folder-pin":
        return <Pin size={badgeSize} className="text-inherit fill-current" />;
      case "folder-star":
        return <Star size={badgeSize} className="text-inherit fill-current" />;
      case "folder-heart":
        return <Heart size={badgeSize} className="text-inherit fill-current" />;
      case "folder-lock":
        return <Lock size={badgeSize} className="text-inherit" />;
      case "folder-archive":
        return <Archive size={badgeSize} className="text-inherit" />;
      case "folder-check":
        return <Check size={badgeSize} className="text-inherit" />;
      case "folder-plus":
        return <Plus size={badgeSize} className="text-inherit" />;
      case "folder-search":
        return <Search size={badgeSize} className="text-inherit" />;
      default:
        return null;
    }
  };

  const badge = renderBadge();
  if (!badge) return <BaseFolder {...iconProps} />;

  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0 select-none", className)} style={style}>
      <BaseFolder size={size} />
      <span className="absolute -top-1 -right-1 bg-panel-bg rounded-full p-[0.5px] border border-panel-border/80 shadow-xs flex items-center justify-center pointer-events-none">
        {badge}
      </span>
    </div>
  );
};
