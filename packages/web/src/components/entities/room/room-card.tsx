import React from "react";
import { Room } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  Users, 
  Edit, 
  Trash2, 
  FlaskConical,
  Computer,
  BookOpen,
  Dumbbell,
  GraduationCap,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (roomId: string) => void;
  isRTL?: boolean;
}

const getRoomIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes("lab") || lowerType.includes("آزمایشگاه")) {
    return FlaskConical;
  }
  if (lowerType.includes("computer") || lowerType.includes("کمپیوتر")) {
    return Computer;
  }
  if (lowerType.includes("library") || lowerType.includes("کتابخانه")) {
    return BookOpen;
  }
  if (lowerType.includes("gym") || lowerType.includes("ورزش")) {
    return Dumbbell;
  }
  if (lowerType.includes("hall") || lowerType.includes("سالن")) {
    return GraduationCap;
  }
  
  return Home;
};

const getRoomGradient = (type: string) => {
  const lowerType = type.toLowerCase();
  
  // Check specific lab types FIRST (before generic "lab" check)
  if (lowerType.includes("chemistry") || lowerType.includes("کیمیا")) {
    return "from-cyan-50 via-cyan-80 to-cyan-50 dark:from-cyan-900 dark:via-cyan-950 dark:to-cyan-900 border-cyan-300 dark:border-cyan-700";

    // return "from-purple-100 via-purple-50 to-purple-100 dark:from-purple-900 dark:via-purple-950 dark:to-purple-900 border-purple-300 dark:border-purple-700";
  }
  if (lowerType.includes("physics") || lowerType.includes("فزیک") || lowerType.includes("فیزیک")) {
    return "from-pink-100 via-pink-50 to-pink-100 dark:from-pink-900 dark:via-pink-950 dark:to-pink-900 border-pink-300 dark:border-pink-700";
  }
  if (lowerType.includes("biology") || lowerType.includes("بیولوژی") || lowerType.includes("احیا")) {
    return "from-emerald-100 via-emerald-50 to-emerald-100 dark:from-emerald-900 dark:via-emerald-950 dark:to-emerald-900 border-emerald-300 dark:border-emerald-700";
  }
  if (lowerType.includes("computer") || lowerType.includes("کمپیوتر")) {
    return "from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900 dark:via-blue-950 dark:to-blue-900 border-blue-300 dark:border-blue-700";
  }
  if (lowerType.includes("library") || lowerType.includes("کتابخانه")) {
    return "from-amber-100 via-amber-50 to-amber-100 dark:from-amber-900 dark:via-amber-950 dark:to-amber-900 border-amber-300 dark:border-amber-700";
  }
  if (lowerType.includes("gym") || lowerType.includes("ورزش")) {
    return "from-green-100 via-green-50 to-green-100 dark:from-green-900 dark:via-green-950 dark:to-green-900 border-green-300 dark:border-green-700";
  }
  if (lowerType.includes("hall") || lowerType.includes("سالن")) {
    return "from-indigo-100 via-indigo-50 to-indigo-100 dark:from-indigo-900 dark:via-indigo-950 dark:to-indigo-900 border-indigo-300 dark:border-indigo-700";
  }
  if (lowerType.includes("regular") || lowerType.includes("عادی")) {
    return "from-purple-100 via-purple-50 to-purple-100 dark:from-purple-900 dark:via-purple-950 dark:to-purple-900 border-purple-300 dark:border-purple-700";

  }
  
  // Generic lab fallback (for any other lab type)
  if (lowerType.includes("lab") || lowerType.includes("آزمایشگاه")) {
    return "from-violet-100 via-violet-50 to-violet-100 dark:from-violet-900 dark:via-violet-950 dark:to-violet-900 border-violet-300 dark:border-violet-700";
  }
  
  return "from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-slate-300 dark:border-slate-700";
};

export function RoomCard({ room, onEdit, onDelete, isRTL = false }: RoomCardProps) {
  const RoomIcon = getRoomIcon(room.type);
  const gradientClass = getRoomGradient(room.type);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-2",
        "bg-gradient-to-br",
        gradientClass
      )}
      onClick={() => onEdit(room)}
    >
      {/* Icon Badge in Top Right/Left */}
      <div className={cn(
        "absolute top-4 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-md",
        isRTL ? "left-4" : "right-4"
      )}>
        <RoomIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </div>

      <div className="p-6">
        {/* Room Name */}
        <h3 className={cn(
          "text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 pr-12",
          isRTL && "text-right pl-12 pr-0"
        )}>
          {room.name}
        </h3>

        {/* Room Type Badge */}
        <Badge 
          variant="secondary" 
          className="mb-4 bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300"
        >
          {room.type}
        </Badge>

        {/* Capacity */}
        <div className={cn(
          "flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-4",
          isRTL && "flex-row"
        )}>
          <Users className="h-5 w-5" />
          <span className="text-lg font-semibold">{room.capacity}</span>
          <span className="text-sm">{isRTL ? "نفر" : "students"}</span>
        </div>

        {/* Features */}
        {room.features && room.features.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mb-4", isRTL && "flex-row")}>
            {room.features.slice(0, 3).map((feature, index) => (
              <Badge
                key={index}
                variant="outline"
                className="text-xs bg-white/60 dark:bg-gray-800/60"
              >
                {feature}
              </Badge>
            ))}
            {room.features.length > 3 && (
              <Badge variant="outline" className="text-xs bg-white/60 dark:bg-gray-800/60">
                +{room.features.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Action Buttons - Shown on hover */}
        <div className={cn(
          "flex gap-2 pt-4 border-t  border-gray-300 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity",
          isRTL && "flex-row"
        )}>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(room);
            }}
            className={cn(
              "flex-1 bg-white/80 hover:bg-white text-black/60 hover:text-black/80 dark:bg-gray-800/80 dark:hover:bg-gray-800",
              isRTL && "flex-row"
            )}
          >
            <Edit className="h-4 w-4 me-1" />
            {isRTL ? "ویرایش" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(room.id);
            }}
            className={cn(
              "flex-1 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-400 border-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50",
              isRTL && "flex-row"
            )}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {isRTL ? "حذف" : "Delete"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
