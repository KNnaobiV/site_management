import React from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import Dashboard from "./pages/Dashboard";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import PlotsPage from "./pages/PlotsPage";
import PlotDetailPage from "./pages/PlotDetailPage";
import CreatePlotPage from "./pages/CreatePlotPage";
import WorkItemsPage from "./pages/WorkItemsPage";
import WorkItemDetailPage from "./pages/WorkItemDetailPage";
import CreateWorkItemPage from "./pages/CreateWorkItemPage";
import JobItemsPage from "./pages/JobItemsPage";
import CreateJobItemPage from "./pages/CreateJobItemPage";
import JobItemDetailPage from "./pages/JobItemDetailPage";
import CreateDailyReportPage from "./pages/CreateDailyReportPage";
import NotificationsPage from "./pages/NotificationsPage";
import InvitationsPage from "./pages/InvitationsPage";
import InviteTeamMemberPage from "./pages/InviteTeamMemberPage";
import ProfilePage from "./pages/ProfilePage";
import { DashboardShell, Spinner } from "./components";

export default function App() {
    const { user, ready } = useAuth();

    if (!ready) return <BootScreen />;

    if (!user) {
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
                <Route path="/projects/new" element={<CreateProjectPage />} />
                <Route path="/projects/:projectId/edit" element={<CreateProjectPage />} />
                <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="/projects/:projectId/plots/new" element={<CreatePlotPage />} />
                <Route path="/plots/new" element={<CreatePlotPage />} />
                <Route path="/plots/:plotId/edit" element={<CreatePlotPage />} />
                
                <Route path="/plots" element={<PlotsPage />} />
                <Route path="/plots/:plotId" element={<PlotDetailPage />} />
                <Route path="/plots/:plotId/work-items/new" element={<CreateWorkItemPage />} />
                <Route path="/work-items/new" element={<CreateWorkItemPage />} />
                
                <Route path="/work-items" element={<WorkItemsPage />} />
                <Route path="/work-items/:workItemId" element={<WorkItemDetailPage />} />
                <Route path="/work-items/:workItemId/job-items/new" element={<CreateJobItemPage />} />
                <Route path="/job-items/new" element={<CreateJobItemPage />} />
                
                <Route path="/job-items" element={<JobItemsPage />} />
                <Route path="/job-items/:jobItemId" element={<JobItemDetailPage />} />
                <Route path="/job-items/:jobItemId/reports/new" element={<CreateDailyReportPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/invitations" element={<InvitationsPage />} />
                <Route path="/team/invite" element={<InviteTeamMemberPage />} />
                <Route path="/profile" element={<ProfilePage />} />
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-canvas)",
            gap: '20px'
        }}>
            <Spinner />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '20px' }}>Ironwork</p>
        </div>
    );
}