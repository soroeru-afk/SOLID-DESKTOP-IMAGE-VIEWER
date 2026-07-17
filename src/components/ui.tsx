import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Plus, Minus, GripVertical } from 'lucide-react';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  headerRight?: React.ReactNode;
  contentClassName?: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  dragHandle?: boolean;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, contentClassName, title, headerRight, isCollapsible, isExpanded, onToggle, dragHandle, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          "bg-panel-bg border border-panel-border rounded-none flex flex-col overflow-hidden transition-all duration-300", 
          className
        )}
        {...props}
      >
        {(title || headerRight || dragHandle) && (
          <div 
            className={cn(
              "flex items-center px-4 py-2 bg-panel-header w-full select-none",
              (!isCollapsible || isExpanded) && "border-b border-panel-border",
              isCollapsible && "cursor-pointer hover:bg-white/5"
            )}
            onClick={(e) => {
              if (isCollapsible) {
                // Ignore clicks from buttons, icons or interactive elements if they manage their own click
                onToggle?.();
              }
            }}
          >
            {title && (
              <h3 className="font-mono text-xs uppercase text-text-secondary tracking-widest flex items-center gap-2 flex-1">
                {title}
              </h3>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {headerRight && <div className="text-xs text-text-muted">{headerRight}</div>}
              {isCollapsible && (
                <div 
                  className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle?.();
                  }}
                >
                  {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                </div>
              )}
              {dragHandle && (
                <div 
                  className="text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing sidebar-drag-handle ml-1 p-0.5" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical size={14} />
                </div>
              )}
            </div>
          </div>
        )}
        {(!isCollapsible || isExpanded) && (
          <div className={cn("flex-1 p-4 overflow-y-auto", contentClassName)}>
            {children}
          </div>
        )}
      </div>
    );
  }
);
Panel.displayName = "Panel";

interface SolidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const SolidButton = React.forwardRef<HTMLButtonElement, SolidButtonProps>(
  ({ className, active, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98, y: 1 }}
        className={cn(
          "relative px-4 py-2 text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-2 transition-colors",
          "border outline-none rounded-none shadow-[0_2px_4px_rgba(0,0,0,0.2)]",
          active 
            ? "bg-btn-active-bg border-btn-active-border border-b-btn-active-border-b border-r-btn-active-border-r text-btn-active-text" 
            : "bg-btn-bg border-btn-border border-b-btn-border-b border-r-btn-border-r text-btn-text hover:text-btn-hover-text hover:bg-btn-hover-bg hover:border-t-btn-hover-border-t",
          className
        )}
        {...props}
      />
    );
  }
);
SolidButton.displayName = "SolidButton";
