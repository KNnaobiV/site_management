import React from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/ProjectsPage";
import PlotsPage from "./pages/PlotsPage";
import WorkItemsPage from "./pages/WorkItemsPage";
import JobItemsPage from "./pages/JobItemsPage";
import NotificationsPage from "./pages/NotificationsPage";
import { DashboardShell } from "./components";

export default function App() {
    const auth = useAuth();
    console.log("App auth state:", auth);

    if (!auth || !auth.ready) return <BootScreen />;

    if (!auth.user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        );
    }

    return (
        <DashboardShell>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/plots" element={<PlotsPage />} />
                <Route path="/work-items" element={<WorkItemsPage />} />
                <Route path="/job-items" element={<JobItemsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </DashboardShell>
    );
}

function BootScreen() {
    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fbf8f1",
        }}>
            <p>Loading Ironwork...</p>
        </div>
    );
}