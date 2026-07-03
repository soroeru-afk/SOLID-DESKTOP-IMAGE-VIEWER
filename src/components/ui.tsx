import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  headerRight?: React.ReactNode;
  contentClassName?: string;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, contentClassName, title, headerRight, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("bg-panel-bg border border-panel-border rounded-none flex flex-col overflow-hidden", className)}
        {...props}
      >
        {(title || headerRight) && (
          <div className="flex items-center px-4 py-2 border-b border-panel-border bg-panel-header w-full">
            {title && <h3 className="font-mono text-xs uppercase text-text-secondary tracking-widest flex items-center gap-4">{title}</h3>}
            {headerRight && <div className="text-xs text-text-muted ml-auto">{headerRight}</div>}
          </div>
        )}
        <div className={cn("flex-1 p-4 overflow-y-auto", contentClassName)}>
          {children}
        </div>
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
