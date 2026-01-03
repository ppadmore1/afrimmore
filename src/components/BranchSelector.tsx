import { useState } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranch } from "@/contexts/BranchContext";
import { cn } from "@/lib/utils";

interface BranchSelectorProps {
  compact?: boolean;
}

export function BranchSelector({ compact = false }: BranchSelectorProps) {
  const { userBranches, currentBranch, setCurrentBranch, loading } = useBranch();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <Button variant="outline" size={compact ? "sm" : "default"} disabled className="gap-2">
        <Building2 className="w-4 h-4" />
        {!compact && <span className="animate-pulse">Loading...</span>}
      </Button>
    );
  }

  if (userBranches.length === 0) {
    return null;
  }

  if (userBranches.length === 1) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50",
        compact && "px-2 py-1"
      )}>
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className={cn("font-medium text-sm", compact && "hidden sm:inline")}>
          {currentBranch?.name}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? "sm" : "default"} className="gap-2">
          <Building2 className="w-4 h-4" />
          <span className={cn(compact && "hidden sm:inline")}>
            {currentBranch?.name || "Select Branch"}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        {userBranches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => {
              setCurrentBranch(branch);
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4",
                currentBranch?.id === branch.id ? "opacity-100" : "opacity-0"
              )}
            />
            <div className="flex flex-col">
              <span>{branch.name}</span>
              <span className="text-xs text-muted-foreground">{branch.code}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
