import React from "react"
import { Breadcrumb } from "@/components/layout/breadcrumb"

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Import" }
        ]}
      />
      
      <div>
        <h1 className="text-3xl font-bold">Bulk Import</h1>
        <p className="text-muted-foreground">
          Import data from CSV or Excel files
        </p>
      </div>
      
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Import Data</h2>
        <p className="text-muted-foreground mb-6">
          Upload CSV or Excel files to import teachers, subjects, rooms, or classes.
        </p>
        <div className="max-w-md mx-auto">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Drag and drop files here or click to browse</p>
          </div>
        </div>
      </div>
    </div>
  )
}