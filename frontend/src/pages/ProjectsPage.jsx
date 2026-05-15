import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectCard, StatCard, Spinner } from '../components';
import { Filter, SortAsc, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const ProjectsPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/projects/", { token });
      if (res.ok) {
        const data = await res.json();
        const list = unwrapList(data);
        console.log("Projects list fetched:", list);
        setProjects(list);
      }
    } catch (error) {
      console.error("Fetch projects failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ height: "100vh", overflow: "auto", position: "relative" }}>
      <div style={{ transition: "all 0.2s ease", paddingBottom: '100px' }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "48px", marginBottom: "8px" }}>Projects</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {projects.length} active across your workspace
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={18} />
              <span>Filter</span>
            </button>
            <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SortAsc size={18} />
              <span>Sort: Recent</span>
            </button>
            <button className="btn-primary" onClick={() => navigate('/projects/new')}>
              <Plus size={18} />
              <span>New project</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "48px" }}>
          <StatCard label="Pending" value={projects.filter(p => p.project_status === "Planned").length} sub="+2 this month" />
          <StatCard label="In Progress" value={projects.filter(p => p.project_status === "In Progress").length} color="var(--brand-orange)" />
          <StatCard label="Completed" value={projects.filter(p => p.project_status === "Completed").length} color="var(--status-completed)" />
        </div>

        {/* Grid */}
        {projects.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "32px" }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
            ))}
          </div>
        ) : (
          <div style={{
            minHeight: '320px',
            border: '1px dashed var(--border-default)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '40px',
            color: 'var(--text-tertiary)'
          }}>
            <h2 style={{ margin: 0, fontSize: '28px' }}>No projects yet</h2>
            <p style={{ maxWidth: '420px', textAlign: 'center' }}>Create a project to start managing your site activity, teams, and daily reports.</p>
            <button className="btn-primary" onClick={() => navigate('/projects/new')} style={{ padding: '14px 40px' }}>
              Create project to start
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPage;
