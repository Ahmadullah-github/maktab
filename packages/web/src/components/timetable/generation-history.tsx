import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerationMetadata } from "@/stores/useTimetableStore";
import { Clock, CheckCircle, XCircle, TrendingUp, Users, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { useLanguageCtx } from "@/i18n/provider";

interface GenerationHistoryProps {
  history: GenerationMetadata[];
  onLoadGeneration?: (metadata: GenerationMetadata) => void;
  isRTL?: boolean;
}

export function GenerationHistory({
  history,
  onLoadGeneration,
  isRTL = false,
}: GenerationHistoryProps) {
  const { t } = useLanguageCtx();

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Generation History
          </CardTitle>
          <CardDescription>No previous generations found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Generation history will appear here after you create timetables
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Generation History
        </CardTitle>
        <CardDescription>
          Recent timetable generations ({history.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {history.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 border rounded-lg transition-all hover:shadow-md cursor-pointer",
                item.success
                  ? "border-green-200 bg-green-50/50 hover:bg-green-50"
                  : "border-red-200 bg-red-50/50 hover:bg-red-50"
              )}
              onClick={() => onLoadGeneration?.(item)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {item.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    item.success
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-red-100 text-red-700 border-red-300"
                  )}
                >
                  {item.success ? "Success" : "Failed"}
                </Badge>
              </div>

              {item.success ? (
                <div className="space-y-2 mt-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-600" />
                      <span className="text-muted-foreground">Quality:</span>
                      <span className="font-semibold">{item.qualityScore}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-purple-600" />
                      <span className="text-muted-foreground">Teachers:</span>
                      <span className="font-semibold">{item.uniqueTeachers}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3 text-indigo-600" />
                      <span className="text-muted-foreground">Classes:</span>
                      <span className="font-semibold">{item.uniqueClasses}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">
                      {item.totalLessons} lessons
                    </span>
                    {item.conflictCount > 0 && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                        {item.conflictCount} conflict{item.conflictCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {item.conflictCount === 0 && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                        No conflicts
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xs text-red-700 font-medium">
                    Error: {item.error || "Generation failed"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

