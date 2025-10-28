import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Teacher } from "@/types";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useWizardStore } from "@/stores/useWizardStore";
import {
  TeacherForm,
  BulkTeacherForm,
  TeacherRow,
  ExpandedPanel,
} from "./teachers";

interface TeachersStepProps {
  onDataChange?: () => void;
}

export function TeachersStep({ onDataChange }: TeachersStepProps) {
  // Refactored with direct API calls for better reliability
  const {
    teachers,
    isLoading,
    error,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    fetchTeachers,
  } = useTeacherStore();
  const { subjects, fetchSubjects } = useSubjectStore();
  const { schoolInfo, periodsInfo } = useWizardStore();

  // Debug: Log when teachers array changes
  React.useEffect(() => {
    console.log("Teachers array updated:", teachers.length, "teachers");
  }, [teachers]);

  // Simplified state management for new inline editing approach
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBySubject, setFilterBySubject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "subjects" | "periods">("name");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState<Record<string, string | null>>({});

  // Load data on component mount - empty deps to only run once
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchTeachers(), fetchSubjects()]);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load teachers and subjects");
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Keyboard shortcuts for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N to add new teacher
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!isAddingNew && !isBulkAdding) {
          setIsAddingNew(true);
        }
      }
      
      // Escape to cancel adding or collapse expanded row
      if (e.key === 'Escape') {
        if (isAddingNew) {
          setIsAddingNew(false);
        }
        if (isBulkAdding) {
          setIsBulkAdding(false);
        }
        if (expandedRowId) {
          setExpandedRowId(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAddingNew, isBulkAdding, expandedRowId]);

  // Generate empty availability matrix
  const generateEmptyAvailability = (): Record<string, boolean[]> => {
    const days = schoolInfo.workingDays || [
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ];
    const periodsPerDay = periodsInfo.periodsPerDay || 8;
    
    const availability: Record<string, boolean[]> = {};
    days.forEach(day => {
      availability[day] = new Array(periodsPerDay).fill(false);
    });
    
    return availability;
  };

  // Filter and sort teachers
  const filteredAndSortedTeachers = useMemo(() => {
    let filtered = teachers;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(teacher =>
        teacher.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by subject
    if (filterBySubject) {
      filtered = filtered.filter(teacher =>
        teacher.primarySubjectIds.includes(filterBySubject)
      );
    }

    // Sort teachers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.fullName.localeCompare(b.fullName);
        case "subjects":
          return b.primarySubjectIds.length - a.primarySubjectIds.length;
        case "periods":
          return b.maxPeriodsPerWeek - a.maxPeriodsPerWeek;
        default:
          return 0;
      }
    });

    return filtered;
  }, [teachers, searchQuery, filterBySubject, sortBy]);

  // Helper functions
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || "Unknown Subject";
  };

  // Event handlers
  const handleAddTeacher = async (teacherData: Omit<Teacher, "id" | "createdAt" | "updatedAt">) => {
    try {
      const teacherToAdd = {
        ...teacherData,
        availability: teacherData.availability || generateEmptyAvailability(),
      };

      const result = await addTeacher(teacherToAdd);
      
      if (result) {
        setIsAddingNew(false);
        onDataChange?.();
        toast.success("Teacher added successfully");
        return true;
      } else {
        toast.error("Failed to add teacher");
        return false;
      }
    } catch (error) {
      console.error("Failed to add teacher:", error);
      toast.error("Failed to add teacher");
      return false;
    }
  };

  const handleBulkAddTeachers = async (teachersData: Omit<Teacher, "id" | "createdAt" | "updatedAt">[]) => {
    try {
      let successCount = 0;
      let failedTeachers: string[] = [];
      
      // Process teachers in batches to prevent overwhelming the API
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < teachersData.length; i += batchSize) {
        batches.push(teachersData.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (teacherData, index) => {
          try {
            const teacherToAdd = {
              ...teacherData,
              availability: teacherData.availability || generateEmptyAvailability(),
            };

            const result = await addTeacher(teacherToAdd);
            if (result) {
              return { success: true, name: teacherData.fullName || `Teacher ${index + 1}` };
            } else {
              return { success: false, name: teacherData.fullName || `Teacher ${index + 1}` };
            }
          } catch (error) {
            console.error(`Failed to add teacher ${teacherData.fullName}:`, error);
            return { success: false, name: teacherData.fullName || `Teacher ${index + 1}` };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
          } else {
            failedTeachers.push(result.name);
          }
        });
        
        // Small delay between batches to prevent API overload
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (successCount > 0) {
        setIsBulkAdding(false);
        onDataChange?.();
        toast.success(`Successfully added ${successCount} teacher${successCount !== 1 ? 's' : ''}`);
      }
      
      if (failedTeachers.length > 0) {
        toast.error(`Failed to add ${failedTeachers.length} teacher(s): ${failedTeachers.join(', ')}`);
      }
      
      if (successCount === 0) {
        toast.error("Failed to add teachers");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Failed to add teachers:", error);
      toast.error("Failed to add teachers");
      return false;
    }
  };

  const handleUpdateTeacher = async (teacherId: string, field: string, value: any) => {
    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: field }));
      
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher) {
        toast.error("Teacher not found");
        return false;
      }

      // Validate field exists on Teacher type
      if (!(field in teacher)) {
        toast.error(`Invalid field: ${field}`);
        return false;
      }

      // Create updated teacher object
      const updatedTeacher = { ...teacher, [field]: value };
      
      // Use store method for consistent state management
      const result = await updateTeacher(updatedTeacher);
      
      if (result) {
        onDataChange?.();
        toast.success("Updated successfully");
        return true;
      } else {
        toast.error("Failed to update teacher");
        return false;
      }
    } catch (error) {
      console.error("Failed to update teacher:", error);
      toast.error("Failed to update teacher");
      return false;
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) {
      toast.error("Teacher not found");
      return;
    }

    const confirmed = window.confirm(`Delete ${teacher.fullName}?`);
    if (!confirmed) return;

    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: "delete" }));
      
      // Use store method for consistent state management
      const success = await deleteTeacher(teacherId);
      
      if (success) {
        onDataChange?.();
        toast.success("Teacher deleted successfully");
      } else {
        toast.error("Failed to delete teacher");
      }
    } catch (error) {
      console.error("Failed to delete teacher:", error);
      toast.error("Failed to delete teacher");
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTeachers.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedTeachers.length} teacher(s)? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      // Set loading state for all selected teachers
      const loadingState: Record<string, string | null> = {};
      selectedTeachers.forEach(id => {
        loadingState[id] = "delete";
      });
      setLoadingStates(prev => ({ ...prev, ...loadingState }));

      let successCount = 0;
      let failedTeachers: string[] = [];
      
      // Process deletions in batches to prevent overwhelming the API
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < selectedTeachers.length; i += batchSize) {
        batches.push(selectedTeachers.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(async (teacherId) => {
          try {
            const success = await deleteTeacher(teacherId);
            return { success, teacherId };
          } catch (error) {
            console.error(`Failed to delete teacher ${teacherId}:`, error);
            return { success: false, teacherId };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
          } else {
            failedTeachers.push(result.teacherId);
          }
        });
        
        // Small delay between batches to prevent API overload
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Clear loading states
      setLoadingStates(prev => {
        const newState = { ...prev };
        selectedTeachers.forEach(id => {
          delete newState[id];
        });
        return newState;
      });
      
      if (successCount > 0) {
        await onDataChange?.();
        toast.success(`Successfully deleted ${successCount} teacher(s)`);
        setSelectedTeachers([]);
      }
      
      if (failedTeachers.length > 0) {
        toast.error(`Failed to delete ${failedTeachers.length} teacher(s)`);
      }
      
      if (successCount === 0) {
        toast.error("Failed to delete teachers");
      }
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast.error("Failed to delete teachers");
      
      // Clear loading states on error
      setLoadingStates(prev => {
        const newState = { ...prev };
        selectedTeachers.forEach(id => {
          delete newState[id];
        });
        return newState;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedTeachers.length === filteredAndSortedTeachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(filteredAndSortedTeachers.map(t => t.id));
    }
  };

  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeachers(prev => 
      prev.includes(teacherId) 
        ? prev.filter(id => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  const handleSaveAvailability = async (teacherId: string, availability: Record<string, boolean[]>) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) {
      toast.error("Teacher not found");
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: "availability" }));
      
      // Create updated teacher with new availability
      const updatedTeacher = { ...teacher, availability };
      
      // Use store method for consistent state management
      const result = await updateTeacher(updatedTeacher);
      
      if (result) {
        onDataChange?.();
        toast.success("Availability updated successfully");
      } else {
        toast.error("Failed to update availability");
      }
    } catch (error) {
      console.error("Failed to update availability:", error);
      toast.error("Failed to update availability");
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  const handleSubjectToggle = async (teacherId: string, subjectId: string, isPrimary: boolean) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) {
      toast.error("Teacher not found");
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: "subjects" }));
      
      let updatedTeacher;
      
      if (isPrimary) {
        const newPrimarySubjects = teacher.primarySubjectIds.includes(subjectId)
          ? teacher.primarySubjectIds.filter(id => id !== subjectId)
          : [...teacher.primarySubjectIds, subjectId];

        updatedTeacher = { ...teacher, primarySubjectIds: newPrimarySubjects };
      } else {
        const newAllowedSubjects = teacher.allowedSubjectIds?.includes(subjectId)
          ? teacher.allowedSubjectIds.filter(id => id !== subjectId)
          : [...(teacher.allowedSubjectIds || []), subjectId];

        updatedTeacher = { ...teacher, allowedSubjectIds: newAllowedSubjects };
      }

      // Use store method for consistent state management
      const result = await updateTeacher(updatedTeacher);
      
      if (result) {
        onDataChange?.();
        toast.success(isPrimary ? "Primary subjects updated" : "Allowed subjects updated");
      } else {
        toast.error("Failed to update subjects");
      }
    } catch (error) {
      console.error("Failed to update subjects:", error);
      toast.error("Failed to update subjects");
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  const handleRestrictToggle = async (teacherId: string, restricted: boolean) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) {
      toast.error("Teacher not found");
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: "subjects" }));
      
      const updatedTeacher = {
        ...teacher,
        restrictToPrimarySubjects: restricted,
        allowedSubjectIds: restricted ? [] : teacher.allowedSubjectIds,
      };

      // Use store method for consistent state management
      const result = await updateTeacher(updatedTeacher);
      
      if (result) {
        onDataChange?.();
        toast.success("Subject restrictions updated");
      } else {
        toast.error("Failed to update subject restrictions");
      }
    } catch (error) {
      console.error("Failed to update subject restrictions:", error);
      toast.error("Failed to update subject restrictions");
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterBySubject(null);
  };

  const handleDuplicateTeacher = async (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    try {
      setLoadingStates(prev => ({ ...prev, [teacherId]: "duplicate" }));

    const duplicatedTeacher = {
      ...teacher,
      fullName: `${teacher.fullName} (Copy)`,
      id: `temp-${Date.now()}-${Math.random()}`,
    };

      const result = await addTeacher(duplicatedTeacher);
      if (result) {
        onDataChange?.();
        toast.success("Teacher duplicated successfully");
      } else {
        toast.error("Failed to duplicate teacher");
      }
    } catch (error) {
      console.error("Failed to duplicate teacher:", error);
      toast.error("Failed to duplicate teacher");
    } finally {
      setLoadingStates(prev => ({ ...prev, [teacherId]: null }));
    }
  };

  // Loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading teachers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Teachers</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          </div>
          <Button onClick={() => fetchTeachers()} className="w-full">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Loading
        </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[500px]">
      {/* Add New Teacher Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Teachers Management
            {teachers.length > 0 && (
              <span className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 text-xs px-2 py-1 rounded-full">
                {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add and manage your teaching staff with inline editing
            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 px-2 py-1 rounded">
              Press Ctrl+N to add new teacher
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTeachers.length > 0 && (
            <div className="flex items-center gap-2 mr-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-red-800 dark:text-red-400">
                {selectedTeachers.length} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 hover:bg-red-700"
                disabled={selectedTeachers.some(id => loadingStates[id] === "delete")}
              >
                {selectedTeachers.some(id => loadingStates[id] === "delete") ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                <Trash2 className="h-4 w-4" />
                Delete Selected
                  </>
                )}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-2"
              disabled={isAddingNew || isBulkAdding}
            >
              <Plus className="h-4 w-4" />
              Add Single
            </Button>
            <Button
              onClick={() => setIsBulkAdding(true)}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isAddingNew || isBulkAdding}
            >
              <Plus className="h-4 w-4" />
              Add Multiple
            </Button>
          </div>
        </div>
      </div>

      {/* Add Teacher Form */}
      {isAddingNew && (
        <TeacherForm
          subjects={subjects}
          onSave={handleAddTeacher}
          onCancel={() => setIsAddingNew(false)}
          generateEmptyAvailability={generateEmptyAvailability}
        />
      )}

      {/* Bulk Add Teachers Form */}
      {isBulkAdding && (
        <BulkTeacherForm
          subjects={subjects}
          onSave={handleBulkAddTeachers}
          onCancel={() => setIsBulkAdding(false)}
          generateEmptyAvailability={generateEmptyAvailability}
        />
      )}

      {/* Teachers Table with Inline Editing */}
      <Card>
        <CardHeader>
          <CardTitle>Teachers List ({filteredAndSortedTeachers.length} of {teachers.length})</CardTitle>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterBySubject || "all"} onValueChange={(value) => setFilterBySubject(value === "all" ? null : value)}>
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
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
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
          {filteredAndSortedTeachers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">
                {teachers.length === 0 ? "No teachers added yet" : "No teachers found"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {teachers.length === 0 
                  ? "Add your first teacher using the \"Add Single\" button above."
                  : "Try adjusting your search or filter criteria."
                }
              </p>
              {teachers.length > 0 && filteredAndSortedTeachers.length === 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
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
                        checked={selectedTeachers.length === filteredAndSortedTeachers.length && filteredAndSortedTeachers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[150px]">Max Periods/Week</TableHead>
                    <TableHead className="w-[150px]">Time Preference</TableHead>
                    <TableHead className="w-[200px]">Primary Subjects</TableHead>
                    <TableHead className="w-[120px]">Max/Day</TableHead>
                    <TableHead className="w-[120px]">Max Consecutive</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedTeachers.map((teacher) => (
                    <React.Fragment key={teacher.id}>
                      <TeacherRow
                        teacher={teacher}
                        subjects={subjects}
                        isSelected={selectedTeachers.includes(teacher.id)}
                        isExpanded={expandedRowId === teacher.id}
                        loadingStates={loadingStates}
                        onSelect={() => handleSelectTeacher(teacher.id)}
                        onExpand={() => setExpandedRowId(expandedRowId === teacher.id ? null : teacher.id)}
                        onUpdateField={(field, value) => handleUpdateTeacher(teacher.id, field, value)}
                        onDelete={() => handleDeleteTeacher(teacher.id)}
                        onDuplicate={() => handleDuplicateTeacher(teacher.id)}
                        getSubjectName={getSubjectName}
                      />
                      {expandedRowId === teacher.id && (
                        <ExpandedPanel
                          teacher={teacher}
                          subjects={subjects}
                          schoolInfo={schoolInfo}
                          periodsInfo={periodsInfo}
                          loadingStates={loadingStates}
                          onSaveAvailability={async (availability) => await handleSaveAvailability(teacher.id, availability)}
                          onSubjectToggle={(subjectId, isPrimary) => handleSubjectToggle(teacher.id, subjectId, isPrimary)}
                          onRestrictToggle={(restricted) => handleRestrictToggle(teacher.id, restricted)}
                          columnCount={9}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
