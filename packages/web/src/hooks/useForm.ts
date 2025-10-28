// src/hooks/useForm.ts
import { useState, useCallback } from 'react';
import { z, ZodSchema } from 'zod';

// Generic form hook for handling form state and validation
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationSchema?: ZodSchema<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string[]>>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  const handleChange = useCallback(<K extends keyof T>(
    name: K,
    value: T[K]
  ) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when it's updated
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const handleBlur = useCallback(<K extends keyof T>(name: K) => {
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  const validate = useCallback((): boolean => {
    if (!validationSchema) return true;
    
    try {
      validationSchema.parse(values);
      setErrors({} as Record<keyof T, string[]>);
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<keyof T, string[]> = {} as Record<keyof T, string[]>;
        err.errors.forEach((error) => {
          const fieldName = error.path[0] as keyof T;
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = [];
          }
          fieldErrors[fieldName].push(error.message);
        });
        setErrors(fieldErrors);
        return false;
      }
      return true;
    }
  }, [values, validationSchema]);

  const validateField = useCallback(<K extends keyof T>(
    name: K
  ): boolean => {
    if (!validationSchema) return true;
    
    try {
      const fieldValue = values[name];
      const fieldSchema = validationSchema.shape[name];
      if (fieldSchema) {
        fieldSchema.parse(fieldValue);
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
        return true;
      }
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors = err.errors.map(error => error.message);
        setErrors(prev => ({ ...prev, [name]: fieldErrors }));
        return false;
      }
      return true;
    }
  }, [values, validationSchema]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string[]>);
    setTouched({} as Record<keyof T, boolean>);
  }, [initialValues]);

  const setFieldError = useCallback(<K extends keyof T>(
    name: K,
    errorMessages: string[]
  ) => {
    setErrors(prev => ({ ...prev, [name]: errorMessages }));
  }, []);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    validateField,
    reset,
    setFieldError,
    setValues
  };
}