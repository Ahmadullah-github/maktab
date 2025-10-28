// src/hooks/useApi.ts
import { useState, useEffect } from 'react';
import { dataService } from '../lib/dataService';

// Generic API hook for handling API requests
export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async <P extends any[]>(
    apiFunction: (...args: P) => Promise<T>,
    ...params: P
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiFunction(...params);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
}

// Specific hooks for common API operations
export function useHealthCheck() {
  const { data, loading, error, execute } = useApi<{ status: string; message: string }>();
  
  const checkHealth = () => execute(dataService.healthCheck);
  
  return { health: data, loading, error, checkHealth };
}

export function useTimetables() {
  const { data, loading, error, execute } = useApi<any[]>();
  
  const fetchTimetables = () => execute(dataService.getAllTimetables);
  const saveTimetable = (name: string, description: string, data: any) => 
    execute(dataService.saveTimetable, name, description, data);
  
  return { timetables: data || [], loading, error, fetchTimetables, saveTimetable };
}