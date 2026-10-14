import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "hover" | "glow";
}

export function GlassCard({ children, className, variant = "default" }: GlassCardProps) {
  const variants = {
    default: "bg-glass-bg backdrop-blur-md border border-glass-border shadow-glass",
    hover: "bg-glass-bg backdrop-blur-md border border-glass-border shadow-glass hover:shadow-glass-lg hover:bg-card-glass transition-all duration-300",
    glow: "bg-glass-bg backdrop-blur-md border border-glass-border shadow-glass-lg hover:shadow-glow transition-all duration-300"
  };

  return (
    <div className={cn(
      "rounded-2xl p-6",
      variants[variant],
      className
    )}>
      {children}
    </div>
  );
}