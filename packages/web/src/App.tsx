import React from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout";

// Page components
import DashboardPage from "@/pages/ProductionDashboard";
import { Wizard } from "@/pages/Wizard";
import TeachersPage from "@/pages/teachers";
import SubjectsPage from "@/pages/subjects";
import RoomsPage from "@/pages/rooms";
import ClassesPage from "@/pages/classes";
import TimetablePage from "@/pages/timetable";
import SettingsPage from "@/pages/settings";
import ImportPage from "@/pages/import";
import NotFoundPage from "@/pages/NotFound";

const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/wizard" element={<Wizard />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/timetable" element={<TimetablePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
