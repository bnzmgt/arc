import { AlertCircle, CheckCircle2, Circle, Clock, ArrowRightCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function BoxStatusBadge({ status, className }: StatusBadgeProps) {
  switch (status) {
    case "received":
      return (
        <Badge variant="outline" className={cn("bg-slate-100 text-slate-700 border-slate-200", className)}>
          <Circle className="w-3 h-3 mr-1" />
          Received
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="outline" className={cn("bg-orange-50 text-orange-700 border-orange-200", className)}>
          <Clock className="w-3 h-3 mr-1" />
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className={cn("bg-emerald-50 text-emerald-700 border-emerald-200", className)}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case "returned":
      return (
        <Badge variant="outline" className={cn("bg-blue-50 text-blue-700 border-blue-200", className)}>
          <ArrowRightCircle className="w-3 h-3 mr-1" />
          Returned
        </Badge>
      );
    default:
      return <Badge variant="outline" className={className}>{status}</Badge>;
  }
}

export function WorkflowStatusBadge({ status, className }: StatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className={cn("bg-slate-100 text-slate-600 border-slate-200", className)}>
          Pending
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="outline" className={cn("bg-orange-100 text-orange-800 border-orange-200", className)}>
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className={cn("bg-emerald-100 text-emerald-800 border-emerald-200", className)}>
          Completed
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className={cn("bg-gray-100 text-gray-500 border-gray-200 line-through", className)}>
          Skipped
        </Badge>
      );
    default:
      return <Badge variant="outline" className={className}>{status}</Badge>;
  }
}
