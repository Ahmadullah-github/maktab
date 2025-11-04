import React, { useMemo } from "react";
import { Room } from "@/types";
import { Building, Users, BarChart3, Layers } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface RoomStatisticsProps {
  rooms: Room[];
  isRTL?: boolean;
}

export function RoomStatistics({ rooms, isRTL = false }: RoomStatisticsProps) {
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0;
    const uniqueTypes = new Set(rooms.map(room => room.type)).size;

    return {
      totalRooms,
      totalCapacity,
      avgCapacity,
      uniqueTypes,
    };
  }, [rooms]);

  const statCards = [
    {
      icon: Building,
      label: isRTL ? "کل کلاس‌ها" : "Total Rooms",
      value: stats.totalRooms,
      gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
      border: "border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Users,
      label: isRTL ? "ظرفیت کل" : "Total Capacity",
      value: stats.totalCapacity,
      gradient: "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
      border: "border-green-200 dark:border-green-800",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      icon: BarChart3,
      label: isRTL ? "میانگین ظرفیت" : "Average Capacity",
      value: stats.avgCapacity,
      gradient: "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
      border: "border-purple-200 dark:border-purple-800",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      icon: Layers,
      label: isRTL ? "انواع مختلف" : "Room Types",
      value: stats.uniqueTypes,
      gradient: "from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900",
      border: "border-orange-200 dark:border-orange-800",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={cn(
              "bg-gradient-to-br p-5 rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow",
              stat.gradient,
              stat.border
            )}
          >
            <div className={cn(
              "flex items-center gap-3 mb-2",
              isRTL && "flex-row"
            )}>
              <Icon className={cn("h-5 w-5", stat.iconColor)} />
              <span className={cn(
                "text-sm font-medium",
                stat.iconColor.replace("text-", "text-").replace("-600", "-700").replace("-400", "-300")
              )}>
                {stat.label}
              </span>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              stat.iconColor.replace("text-", "text-").replace("-600", "-900").replace("-400", "-100"),
              isRTL && "text-right"
            )}>
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

