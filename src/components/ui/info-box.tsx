import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface InfoBoxProps {
  label: string;
  value: ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning";
}

export function InfoBox({ label, value, className, variant = "default" }: InfoBoxProps) {
  const variants = {
    default: "bg-card-glass border-card-border",
    success: "bg-green-500/10 border-green-500/30 text-green-400",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
  };

  return (
    <div className={cn(
      "rounded-xl border backdrop-blur-sm p-4 transition-all duration-300 hover:bg-secondary-glass",
      variants[variant],
      className
    )}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}