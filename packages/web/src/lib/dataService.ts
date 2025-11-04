// During dev the Vite server proxies `/api` to the backend on :4000 (see vite.config.ts proxy).
// Use a relative `/api` base so in production the app can be served from a different host.
const API_BASE = (import.meta as any).env?.VITE_API_BASE || ""; // leave empty to allow relative `/api` paths

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export const dataService = {
  // Health check
  healthCheck: () => request("/api/health"),

  // Wizard endpoints
  getWizardData: (wizardId: string, stepKey: string) =>
    request(`/api/wizard/${wizardId}/steps/${stepKey}`),
  saveWizardData: (wizardId: string, stepKey: string, data: any) =>
    request(`/api/wizard/${wizardId}/steps/${stepKey}`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  getAllWizardData: (wizardId: string) =>
    request(`/api/wizard/${wizardId}/steps`),

  // Timetable endpoints
  getAllTimetables: () => request("/api/timetables"),
  getTimetable: (id: string) => request(`/api/timetables/${id}`),
  saveTimetable: (name: string, description: string, data: any) =>
    request("/api/timetables", {
      method: "POST",
      body: JSON.stringify({ name, description, data }),
    }),
  updateTimetable: (id: string, data: any) =>
    request(`/api/timetables/${id}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    }),
  deleteTimetable: (id: string) =>
    request(`/api/timetables/${id}`, { method: "DELETE" }),

  // Entities
  getTeachers: () => request("/api/teachers"),
  saveTeacher: (t: any) => {
    const id = t && t.id;
    // Check if id exists, is not a temp id, and is a valid number
    if (id !== undefined && id !== null && id !== "" && typeof id === 'string' && !id.startsWith("temp-") && !isNaN(parseInt(id))) {
      return request(`/api/teachers/${id}`, {
        method: "PUT",
        body: JSON.stringify(t),
      });
    }
    return request("/api/teachers", { method: "POST", body: JSON.stringify(t) });
  },
  updateTeacher: (t: any) => {
    const id = t && t.id;
    if (!id || id.startsWith("temp-") || isNaN(parseInt(id))) {
      throw new Error("Invalid teacher ID for update");
    }
    return request(`/api/teachers/${id}`, {
      method: "PUT",
      body: JSON.stringify(t),
    });
  },
  deleteTeacher: (id: any) => {
    // Ensure ID is a number for the API endpoint
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) {
      throw new Error(`Invalid teacher ID: ${id}`);
    }
    return request(`/api/teachers/${numId}`, { method: "DELETE" });
  },
  // Bulk import teachers
  bulkImportTeachers: (teachers: any[]) =>
    request(`/api/teachers/bulk`, {
      method: "POST",
      body: JSON.stringify({ teachers }),
    }),
  getSubjects: () => request("/api/subjects"),
  saveSubject: (s: any) => {
    const id = s && s.id;
    const idStr = id === undefined || id === null ? "" : String(id);
    if (idStr && !idStr.startsWith("temp-") && !isNaN(parseInt(idStr))) {
      return request(`/api/subjects/${idStr}`, {
        method: "PUT",
        body: JSON.stringify({ ...s, id: idStr }),
      });
    }
    return request("/api/subjects", { method: "POST", body: JSON.stringify(s) });
  },
  deleteSubject: (id: any) =>
    request(`/api/subjects/${id}`, { method: "DELETE" }),
  deleteSubjectsByGrade: (grade: number) =>
    request(`/api/subjects/grade/${grade}`, { method: "DELETE" }),
  clearAllSubjects: () =>
    request("/api/subjects", { method: "DELETE" }),
  insertCurriculumForGrade: (grade: number, subjects: any[]) =>
    request(`/api/subjects/grade/${grade}/insert-curriculum`, {
      method: "POST",
      body: JSON.stringify({ subjects }),
    }),
  clearAllSubjects: () =>
    request("/api/subjects", { method: "DELETE" }),
  getRooms: () => request("/api/rooms"),
  saveRoom: (r: any) => {
    const id = r && r.id;
    // Check if id exists, is not a temp id, and is a valid number
    if (id !== undefined && id !== null && id !== "" && typeof id === 'string' && !id.startsWith("temp-") && !isNaN(parseInt(id))) {
      return request(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(r) });
    }
    return request("/api/rooms", { method: "POST", body: JSON.stringify(r) });
  },
  deleteRoom: (id: any) => request(`/api/rooms/${id}`, { method: "DELETE" }),
  getClasses: () => request("/api/classes"),
  saveClass: (c: any) => {
    const id = c && c.id;
    // Check if id exists, is not a temp id, and is a valid number
    if (id !== undefined && id !== null && id !== "" && typeof id === 'string' && !id.startsWith("temp-") && !isNaN(parseInt(id))) {
      return request(`/api/classes/${id}`, {
        method: "PUT",
        body: JSON.stringify(c),
      });
    }
    return request("/api/classes", { method: "POST", body: JSON.stringify(c) });
  },
  deleteClass: (id: any) => request(`/api/classes/${id}`, { method: "DELETE" }),

  // Config
  getSchoolConfig: () => request("/api/config/school"),
  saveSchoolInfo: (info: any) =>
    request("/api/config/school", {
      method: "PUT",
      body: JSON.stringify(info),
    }),
  savePeriodConfig: (p: any) =>
    request("/api/config/periods", {
      method: "POST",
      body: JSON.stringify({ value: p }),
    }),

  // Timetable generation
  generateTimetable: (payload: any) =>
    request("/api/generate", { method: "POST", body: JSON.stringify(payload) }),
};

export default dataService;
