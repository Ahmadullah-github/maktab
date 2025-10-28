import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface BulkUploadProps {
  onFileSelect: (file: File) => void
  onUpload: (file: File) => Promise<void>
  acceptedFileTypes?: string
  maxSize?: number // in bytes
}

export function BulkUpload({
  onFileSelect,
  onUpload,
  acceptedFileTypes = ".csv,.xlsx,.xls",
  maxSize = 5 * 1024 * 1024, // 5MB default
}: BulkUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (acceptedFileTypes && !acceptedFileTypes.split(",").some(type => selectedFile.name.endsWith(type))) {
      setError(`Invalid file type. Please upload a file with one of these extensions: ${acceptedFileTypes}`)
      return
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds limit. Maximum size is ${maxSize / (1024 * 1024)}MB`)
      return
    }

    setFile(selectedFile)
    setError(null)
    onFileSelect(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      await onUpload(file)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const event = { target: { files: [droppedFile] } } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileChange(event)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload</CardTitle>
        <CardDescription>Upload a CSV or Excel file to import data</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={handleFileChange}
            className="hidden"
          />
          
          {file ? (
            <div className="space-y-2">
              <FileText className="mx-auto h-12 w-12 text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="font-medium">Drag and drop a file here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supported formats: {acceptedFileTypes} (Max size: {maxSize / (1024 * 1024)}MB)
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center text-sm text-destructive">
            <AlertCircle className="mr-2 h-4 w-4" />
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setFile(null)
              setError(null)
              if (fileInputRef.current) {
                fileInputRef.current.value = ""
              }
            }}
            disabled={!file || isUploading}
          >
            Clear
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}