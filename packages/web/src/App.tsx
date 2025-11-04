import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout";

// Page components
import DashboardPage from "@/pages/DashboardPage";
import { Wizard } from "@/pages/Wizard";
import TeachersPage from "@/pages/teachers";
import SubjectsPage from "@/pages/subjects";
import RoomsPage from "@/pages/rooms";
import ClassesPage from "@/pages/classes";
import TimetablePage from "@/pages/timetable";
import ClassSchedulePage from "@/pages/class-schedule";
import TeacherSchedulePage from "@/pages/teacher-schedule";
import SettingsPage from "@/pages/settings";
import ImportPage from "@/pages/import";
import NotFoundPage from "@/pages/NotFound";
const App = () => {
  return (
    <Routes>
      {/* All other pages - inside AppLayout */}
      <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
      <Route path="/wizard" element={<AppLayout><Wizard /></AppLayout>} />
      <Route path="/teachers" element={<AppLayout><TeachersPage /></AppLayout>} />
      <Route path="/subjects" element={<AppLayout><SubjectsPage /></AppLayout>} />
      <Route path="/rooms" element={<AppLayout><RoomsPage /></AppLayout>} />
      <Route path="/classes" element={<AppLayout><ClassesPage /></AppLayout>} />
      <Route path="/timetable" element={<AppLayout><TimetablePage /></AppLayout>} />
      <Route path="/timetable/classes" element={<AppLayout><ClassSchedulePage /></AppLayout>} />
      <Route path="/timetable/teachers" element={<AppLayout><TeacherSchedulePage /></AppLayout>} />
      <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
      <Route path="/import" element={<AppLayout><ImportPage /></AppLayout>} />
      <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
    </Routes>
  );
};

export default App;
