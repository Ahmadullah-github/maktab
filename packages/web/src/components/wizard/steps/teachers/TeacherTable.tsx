import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Clock, Trash2, Users, Copy, BookOpen, Save, X, Loader2 } from "lucide-react";
import { Teacher } from "@/types";

interface TeacherTableProps {
  teachers: Teacher[];
  filteredTeachers: Teacher[];
  subjects: Array<{ id: string; name: string; code?: string }>;
  searchQuery: string;
  filterBySubject: string | null;
  sortBy: "name" | "subjects" | "periods";
  selectedTeachers: string[];
  isAddingNew: boolean;
  loadingStates: Record<string, string | null>; // teacherId -> loading field or null
  onSearchChange: (query: string) => void;
  onFilterChange: (subjectId: string | null) => void;
  onSortChange: (sortBy: "name" | "subjects" | "periods") => void;
  onSelectAll: () => void;
  onSelectTeacher: (teacherId: string) => void;
  onEditField: (teacherId: string, field: string) => void;
  onEditAvailability: (teacherId: string) => void;
  onEditSubjects: (teacherId: string) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onDuplicateTeacher: (teacherId: string) => void;
  onClearFilters: () => void;
  getSubjectName: (subjectId: string) => string;
}

export function TeacherTable({
  teachers,
  filteredTeachers,
  subjects,
  searchQuery,
  filterBySubject,
  sortBy,
  selectedTeachers,
  isAddingNew,
  loadingStates,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onSelectAll,
  onSelectTeacher,
  onEditField,
  onEditAvailability,
  onEditSubjects,
  onDeleteTeacher,
  onDuplicateTeacher,
  onClearFilters,
  getSubjectName,
}: TeacherTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teachers List ({filteredTeachers.length} of {teachers.length})</CardTitle>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <Input
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterBySubject || "all"} onValueChange={(value) => onFilterChange(value === "all" ? null : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="subjects">Sort by Subjects</SelectItem>
                <SelectItem value="periods">Sort by Periods</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">
              {teachers.length === 0 ? "No teachers added yet" : "No teachers found"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {teachers.length === 0 
                ? "Add your first teacher using the \"Add Teacher\" button above."
                : "Try adjusting your search or filter criteria."
              }
            </p>
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={selectedTeachers.length === filteredTeachers.length && filteredTeachers.length > 0}
                      onChange={onSelectAll}
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px]">Max Periods/Week</TableHead>
                  <TableHead className="w-[100px]">Time Preference</TableHead>
                  <TableHead className="w-[200px]">Primary Subjects</TableHead>
                  <TableHead className="w-[100px]">Max/Day</TableHead>
                  <TableHead className="w-[100px]">Max Consecutive</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Add New Row */}
                {isAddingNew && (
                  <TableRow className="bg-blue-50 dark:bg-blue-950/20">
                    <TableCell>
                      {/* Empty cell for checkbox column */}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Enter name"
                        className="border-0 bg-transparent p-0 h-8"
                        disabled
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max="40"
                        className="border-0 bg-transparent p-0 h-8"
                        disabled
                      />
                    </TableCell>
                    <TableCell>
                      <Select disabled>
                        <SelectTrigger className="border-0 bg-transparent p-0 h-8">
                          <SelectValue />
                        </SelectTrigger>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          Use form above
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        className="border-0 bg-transparent p-0 h-8"
                        disabled
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max="8"
                        className="border-0 bg-transparent p-0 h-8"
                        disabled
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <span className="text-xs text-muted-foreground">
                          Use form above
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Existing Teachers */}
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedTeachers.includes(teacher.id)}
                        onChange={() => onSelectTeacher(teacher.id)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{teacher.fullName}</span>
                        {teacher.timePreference !== "None" && (
                          <Badge
                            variant={teacher.timePreference === "Morning" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {teacher.timePreference}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{teacher.maxPeriodsPerWeek}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditField(teacher.id, "maxPeriodsPerWeek")}
                          className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "maxPeriodsPerWeek"}
                          title="Edit max periods per week"
                        >
                          {loadingStates[teacher.id] === "maxPeriodsPerWeek" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{teacher.timePreference}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditField(teacher.id, "timePreference")}
                          className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "timePreference"}
                          title="Edit time preference"
                        >
                          {loadingStates[teacher.id] === "timePreference" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {teacher.primarySubjectIds.map((subjectId) => (
                            <Badge key={subjectId} variant="outline" className="text-xs">
                              {getSubjectName(subjectId)}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditSubjects(teacher.id)}
                          className="h-7 w-7 p-0 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "subjects"}
                          title="Edit subjects"
                        >
                          {loadingStates[teacher.id] === "subjects" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BookOpen className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{teacher.maxPeriodsPerDay || "-"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditField(teacher.id, "maxPeriodsPerDay")}
                          className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "maxPeriodsPerDay"}
                          title="Edit max periods per day"
                        >
                          {loadingStates[teacher.id] === "maxPeriodsPerDay" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{teacher.maxConsecutivePeriods || "-"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditField(teacher.id, "maxConsecutivePeriods")}
                          className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "maxConsecutivePeriods"}
                          title="Edit max consecutive periods"
                        >
                          {loadingStates[teacher.id] === "maxConsecutivePeriods" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditAvailability(teacher.id)}
                          className="h-8 px-2 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "availability"}
                          title="Edit availability"
                        >
                          {loadingStates[teacher.id] === "availability" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDuplicateTeacher(teacher.id)}
                          className="h-8 px-2 hover:bg-green-50 hover:text-green-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "duplicate"}
                          title="Duplicate teacher"
                        >
                          {loadingStates[teacher.id] === "duplicate" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteTeacher(teacher.id)}
                          className="h-8 px-2 hover:bg-red-50 hover:text-red-600 transition-colors"
                          disabled={loadingStates[teacher.id] === "delete"}
                          title="Delete teacher"
                        >
                          {loadingStates[teacher.id] === "delete" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
