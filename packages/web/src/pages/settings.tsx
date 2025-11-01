import React, { useState, useEffect } from "react"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Button } from "@/components/ui/button"
import { useWizardStore } from "@/stores/useWizardStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const { 
    schoolInfo, 
    periodsInfo, 
    setSchoolInfo, 
    setPeriodsInfo, 
    saveSchoolInfo, 
    savePeriodsInfo, 
    isLoading, 
    error 
  } = useWizardStore()
  
  useEffect(() => {
    // Settings page would typically load existing configuration
    // For now, we're using the wizard store which already has this data
  }, [])
  
  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      // Save both school info and periods info
      const schoolSuccess = await saveSchoolInfo()
      const periodsSuccess = await savePeriodsInfo()
      
      if (schoolSuccess && periodsSuccess) {
        setSaveSuccess(true)
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (err) {
      console.error("Failed to save settings:", err)
    } finally {
      setIsSaving(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }
  
  if (error) {
    return (
      <ErrorDisplay 
        title="Error Loading Settings"
        message={error}
        onRetry={() => window.location.reload()}
      />
    )
  }
  
  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Settings" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your application settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
      
      {saveSuccess && (
        <div className="rounded-lg bg-green-100 border border-green-400 text-green-700 px-4 py-3">
          Settings saved successfully!
        </div>
      )}
      
      <div className="grid gap-6">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">School Information</h2>
          <div className="grid gap-4">
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium mb-1">School Name</label>
              <input
                id="schoolName"
                type="text"
                value={schoolInfo.schoolName}
                onChange={(e) => setSchoolInfo({ ...schoolInfo, schoolName: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter school name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Timezone</label>
              <div className="text-sm text-muted-foreground">Afghanistan time is enforced (Asia/Kabul)</div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="daysPerWeek" className="block text-sm font-medium mb-1">Days per Week</label>
                <select id="daysPerWeek" value={schoolInfo.daysPerWeek as any} onChange={(e)=> setSchoolInfo({...schoolInfo, daysPerWeek: Number(e.target.value)})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {[5,6,7].map(d=> <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="periodsPerDay" className="block text-sm font-medium mb-1">Periods per Day</label>
                <select id="periodsPerDay" value={schoolInfo.periodsPerDay as any} onChange={(e)=> setSchoolInfo({...schoolInfo, periodsPerDay: Number(e.target.value)})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Array.from({length:12},(_,i)=>i+1).map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            <div>
                <label className="block text-sm font-medium mb-1">Break Periods</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({length: schoolInfo.periodsPerDay||0}, (_,i)=>i+1).map(p=>{
                    const selected = schoolInfo.breakPeriods.includes(p)
                    return (
                      <button key={p} type="button" onClick={()=>{
                        const set = new Set(schoolInfo.breakPeriods); if(set.has(p)) set.delete(p); else set.add(p);
                        setSchoolInfo({...schoolInfo, breakPeriods: Array.from(set).sort((a,b)=>a-b)})
                      }} className={`px-3 py-2 rounded-md border text-sm ${selected? 'bg-amber-100 border-amber-300':'bg-white'}`}>
                        P{p}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sections</label>
              <div className="flex gap-6">
                {[
                  { key: 'enablePrimary', label: 'Primary (1–6)' },
                  { key: 'enableMiddle', label: 'Middle (7–9)' },
                  { key: 'enableHigh', label: 'High (10–12)' },
                ].map(({key,label})=> (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={(schoolInfo as any)[key]} onChange={(e)=> setSchoolInfo({ ...schoolInfo, [key]: e.target.checked } as any)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Period Configuration</h2>
          <div className="grid gap-4">
            <div>
              <label htmlFor="periodsPerDay" className="block text-sm font-medium mb-1">Periods Per Day</label>
              <input
                id="periodsPerDay"
                type="number"
                value={periodsInfo.periodsPerDay}
                onChange={(e) => setPeriodsInfo({ ...periodsInfo, periodsPerDay: parseInt(e.target.value) || 0 })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter number of periods per day"
              />
            </div>
            
            <div>
              <label htmlFor="periodDuration" className="block text-sm font-medium mb-1">Period Duration (minutes)</label>
              <input
                id="periodDuration"
                type="number"
                value={periodsInfo.periodDuration}
                onChange={(e) => setPeriodsInfo({ ...periodsInfo, periodDuration: parseInt(e.target.value) || 0 })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter period duration in minutes"
              />
            </div>
            
            <div>
              <label htmlFor="schoolStartTime" className="block text-sm font-medium mb-1">School Start Time</label>
              <input
                id="schoolStartTime"
                type="time"
                value={periodsInfo.schoolStartTime}
                onChange={(e) => setPeriodsInfo({ ...periodsInfo, schoolStartTime: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}