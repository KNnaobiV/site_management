import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './api/components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import SiteDetailPage from './pages/sites/SiteDetailPage'
import WorkItemDetailPage from './pages/workitems/WorkItemDetailPage'
import JobItemDetailPage from './pages/jobitems/JobItemDetailPage'
import InvitationsPage from './pages/invitations/InvitationsPage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    // <AuthProvider>
    //   <Routes>
    //     <Route path="/login"    element={<LoginPage />} />
    //     <Route path="/register" element={<RegisterPage />} />
    //     <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
    //       <Route index element={<Navigate to="/projects" replace />} />
    //       <Route path="dashboard" element={<DashboardPage />} />
    //       <Route path="projects"  element={<ProjectsPage />} />
    //       <Route path="projects/:projectId" element={<ProjectDetailPage />} />
    //       <Route path="projects/:projectId/sites/:siteId" element={<SiteDetailPage />} />
    //       <Route path="projects/:projectId/sites/:siteId/workitems/:workItemId" element={<WorkItemDetailPage />} />
    //       <Route path="projects/:projectId/sites/:siteId/workitems/:workItemId/jobitems/:jobItemId" element={<JobItemDetailPage />} />
    //       <Route path="invitations" element={<InvitationsPage />} />
    //     </Route>
    //   </Routes>
    // </AuthProvider>
    <Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
    <Route index element={<Navigate to="/app/projects" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="projects" element={<ProjectsPage />} />
    {/* ... other protected routes */}
  </Route>
</Routes>
  )
}