import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TimetableGridProps {
  days: string[]
  periods: { index: number; startTime?: string; endTime?: string }[]
  data: Record<string, Record<string, string>>
}

export function TimetableGrid({ days, periods, data }: TimetableGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2 bg-muted"></th>
            {days.map((day) => (
              <th key={day} className="border p-2 bg-muted">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <tr key={period.index}>
              <td className="border p-2 bg-muted text-center">
                {period.startTime && period.endTime
                  ? `${period.startTime}-${period.endTime}`
                  : `Period ${period.index + 1}`}
              </td>
              {days.map((day) => (
                <td key={`${day}-${period.index}`} className="border p-2 min-w-32">
                  <div className="text-sm">
                    {data[day]?.[period.index] || ""}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}