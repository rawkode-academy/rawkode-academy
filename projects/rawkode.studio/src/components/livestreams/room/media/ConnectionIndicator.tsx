import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { cn } from "@/lib/utils";

interface ConnectionIndicatorProps {
  status: string;
}

export function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
  const getStatusInfo = () => {
    switch (status) {
      case "connected":
        return {
          color: "bg-green-500",
          label: "Connected",
        };
      case "connecting":
        return {
          color: "bg-gray-500",
          label: "Connecting...",
        };
      case "reconnecting":
        return {
          color: "bg-yellow-500",
          label: "Reconnecting...",
        };
      case "disconnected":
        return {
          color: "bg-red-500",
          label: "Disconnected",
        };
      default:
        return {
          color: "bg-gray-500",
          label: "Unknown",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("h-2 w-2 rounded-full", statusInfo.color)} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{statusInfo.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
