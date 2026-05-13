import React, { useState, useEffect } from 'react';
import { Modal, ProjectCard, StatCard, Spinner, Drawer, RoleBadge, Avatar } from '../components';
import { Filter, SortAsc, Plus, Edit2, Copy, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const ProjectsPage = () => {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const { user } = useAuth();
  const canEdit = user?.role === 'Project Manager' || true;

  // useEffect(() => {
  //   if (isProjectModalOpen || selectedProject) {
  //     document.body.style.overflow = "hidden";
  //   } else {
  //     document.body.style.overflow = "auto";
  //   }
  //   return () => {
  //     document.body.style.overflow = "auto";
  //   };
  // }, [isProjectModalOpen, selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await apiFetch("/projects/", { token });
      if (res.ok) {
        const data = await res.json();
        setProjects(unwrapList(data));
      }
    } catch (error) {
      console.error("Fetch projects failed", error);
    } finally {
      setLoading(false);
    }
  };


  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    project_name: "",
    project_description: "",
    project_status: "Planned",
    project_end_date: "",
    actual_start_date: "",
  });

  const handleCreateProject = async (e) => {
    e.preventDefault();

    setFormError(null);
    setCreatingProject(true);

    const payload = {
      project_name: projectForm.project_name,
      project_description: projectForm.project_description,
      project_status: projectForm.project_status,
    };

    if (projectForm.project_end_date) {
      payload.project_end_date = projectForm.project_end_date;
    }

    if (projectForm.actual_start_date) {
      payload.actual_start_date = projectForm.actual_start_date;
    }

    try {
      const res = await apiFetch("/projects/", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        // Close modal
        setIsProjectModalOpen(false);

        // Reset form
        setProjectForm({
          project_name: "",
          project_description: "",
          project_status: "Planned",
          project_end_date: "",
          actual_start_date: "",
        });

        // Refresh projects
        await fetchProjects();

        // Global success message
        showSuccessMessage("Project created successfully ✅");

      } else {
        const messages = Object.entries(data)
          .map(([field, msgs]) =>
            `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`
          )
          .join(" | ");

        setFormError(messages);
      }

    } catch (error) {
      console.error(error);
      setFormError("A connection error occurred.");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedProject) return;
    setProjectForm({
      project_name: selectedProject.project_name || "",
      project_description: selectedProject.project_description || "",
      project_status: selectedProject.project_status || "Planned",
      project_end_date: selectedProject.project_end_date || "",
      actual_start_date: selectedProject.actual_start_date || "",
    });
    setIsEditMode(true);
    setIsProjectModalOpen(true);
    setSelectedProject(null); // Close drawer
  };

  return (
    <div
      className="fade-up"
      style={{
        height: "100vh",
        overflow: (isProjectModalOpen || selectedProject) ? "hidden" : "auto",
        position: "relative",
      }}
    >
      {/* PAGE CONTENT */}
      <div
        style={{
          filter: (isProjectModalOpen || selectedProject) ? "blur(2px)" : "none",
          pointerEvents: (isProjectModalOpen || selectedProject) ? "none" : "auto",
          userSelect: (isProjectModalOpen || selectedProject) ? "none" : "auto",
          transition: "all 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "40px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "48px", marginBottom: "8px" }}>
              Projects
            </h1>

            <p
              style={{
                fontSize: "16px",
                color: "var(--text-tertiary)",
              }}
            >
              {projects.length} active across your workspace
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Filter size={18} />
              <span>Filter</span>
            </button>

            <button
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <SortAsc size={18} />
              <span>Sort: Recent</span>
            </button>

            <button
              className="btn-primary"
              onClick={() => {
                setIsEditMode(false);
                setProjectForm({
                  project_name: "",
                  project_description: "",
                  project_status: "Planned",
                  project_end_date: "",
                  actual_start_date: "",
                });
                setIsProjectModalOpen(true);
              }}
            >
              <Plus size={18} />
              <span>New project</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "24px",
            marginBottom: "48px",
          }}
        >
          <StatCard
            label="Pending"
            value={
              projects.filter(
                (p) => p.project_status === "Planned"
              ).length
            }
            sub="+2 this month"
          />

          <StatCard
            label="In Progress"
            value={
              projects.filter(
                (p) => p.project_status === "In Progress"
              ).length
            }
            color="var(--brand-orange)"
          />

          <StatCard
            label="Completed"
            value={
              projects.filter(
                (p) => p.project_status === "Completed"
              ).length
            }
            color="var(--status-completed)"
          />
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "32px",
          }}
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      </div>

      {/* FULLSCREEN FORM */}
      {isProjectModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--sand-dark)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "48px 24px",
          }}
        >
          <div
            className="fade-in"
            style={{
              maxWidth: "980px",
              margin: "0 auto",
              background: "var(--bg-surface)",
              borderRadius: "28px",
              border: "1px solid var(--border-subtle)",
              padding: "56px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "48px" }}>
              <h2
                style={{
                  fontSize: "52px",
                  marginBottom: "12px",
                  lineHeight: 1,
                }}
              >
                {isEditMode ? "Edit Project" : "New Project"}
              </h2>

              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                }}
              >
                {isEditMode ? "Update the details for this project." : "Create and organize a new construction project workspace."}
              </p>
            </div>

            {/* Error */}
            {formError && (
              <div
                style={{
                  background: "rgba(220, 38, 38, 0.12)",
                  border:
                    "1px solid rgba(220, 38, 38, 0.3)",
                  color: "#f87171",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  marginBottom: "28px",
                  fontSize: "14px",
                }}
              >
                {formError}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleCreateProject}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "32px",
              }}
            >
              {/* Name */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "12px",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  Project Name
                </label>

                <input
                  type="text"
                  required
                  value={projectForm.project_name}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      project_name: e.target.value,
                    })
                  }
                  placeholder="e.g. Abuja Civic Centre"
                  style={{
                    width: "100%",
                    padding: "18px",
                    borderRadius: "16px",
                    border:
                      "1px solid var(--border-default)",
                    background: "var(--bg-raised)",
                    color: "var(--text-primary)",
                    fontSize: "15px",
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "12px",
                    fontWeight: 600,
                    fontSize: "15px",
                  }}
                >
                  Description
                </label>

                <textarea
                  required
                  value={projectForm.project_description}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      project_description:
                        e.target.value,
                    })
                  }
                  placeholder="Describe the project scope..."
                  style={{
                    width: "100%",
                    minHeight: "180px",
                    padding: "18px",
                    borderRadius: "16px",
                    border:
                      "1px solid var(--border-default)",
                    background: "var(--bg-raised)",
                    color: "var(--text-primary)",
                    resize: "vertical",
                    fontSize: "15px",
                  }}
                />
              </div>

              {/* Dates */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Actual Start Date
                  </label>

                  <input
                    type="date"
                    value={projectForm.actual_start_date}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        actual_start_date:
                          e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "18px",
                      borderRadius: "16px",
                      border:
                        "1px solid var(--border-default)",
                      background: "var(--bg-raised)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Estimated End Date
                  </label>

                  <input
                    type="date"
                    value={projectForm.project_end_date}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        project_end_date:
                          e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "18px",
                      borderRadius: "16px",
                      border:
                        "1px solid var(--border-default)",
                      background: "var(--bg-raised)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "12px",
                    fontWeight: 600,
                  }}
                >
                  Status
                </label>

                <select
                  value={projectForm.project_status}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      project_status: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "18px",
                    borderRadius: "16px",
                    border:
                      "1px solid var(--border-default)",
                    background: "var(--bg-raised)",
                    color: "var(--text-primary)",
                    fontSize: "15px",
                  }}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">
                    In Progress
                  </option>
                  <option value="Completed">
                    Completed
                  </option>
                  <option value="On Hold">On Hold</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Cancelled">
                    Cancelled
                  </option>
                </select>
              </div>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "32px",
                  borderTop:
                    "1px solid var(--border-subtle)",
                  marginTop: "12px",
                }}
              >
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setIsProjectModalOpen(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    minWidth: "220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  {creatingProject ? (
                    <Spinner />
                  ) : (
                    <>
                      {isEditMode ? <Edit2 size={18} /> : <Plus size={18} />}
                      {isEditMode ? "Save Changes" : "Create Project"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      DRAWER
      <Drawer
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
        title={selectedProject?.project_name}
        subtitle={`Client: ${selectedProject?.client_name || 'N/A'}`}
      >
        {selectedProject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <RoleBadge role={selectedProject.project_status} />
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ padding: '8px', color: '#fff' }} onClick={handleEditClick}><Edit2 size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px', color: '#fff' }}><Copy size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px', color: 'var(--status-delayed)' }}><Archive size={16} /></button>
                </div>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Project Overview</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
                {selectedProject.project_description || 'No detailed description provided for this project yet.'}
              </p>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Key Metrics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Overall Progress</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>{selectedProject.progress || 0}%</p>
                </div>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Active Plots</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>8</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ProjectsPage;
