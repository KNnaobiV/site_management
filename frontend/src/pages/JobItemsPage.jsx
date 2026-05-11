import React, { useState, useEffect } from 'react';
import { JobItemCard, Spinner, Drawer, CommentsSection, RoleBadge, Avatar } from '../components';
import { Filter, SortAsc, Plus, ChevronRight, Edit2, Copy, Archive, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showSuccessMessage } from '../utils/successMessage';

const JobItemsPage = () => {
  const { user } = useAuth();
  const [jobItems, setJobItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isJobItemModalOpen, setIsJobItemModalOpen] = useState(false);
  const [jobItemForm, setJobItemForm] = useState({
    job_name: "",
    job_artisan: "Mason",
    job_status: "Planned",
    artisan_name: ""
  });
  const [creatingJobItem, setCreatingJobItem] = useState(false);
  const [formError, setFormError] = useState(null);

  const [selectedJobItem, setSelectedJobItem] = useState(null);

  useEffect(() => {
    setJobItems([
      { id: 1, job_artisan: 'Mason', job_name: 'Block laying ground floor', job_status: 'In Progress', progress: 65, artisan_name: 'J. Adeyemi' },
      { id: 2, job_artisan: 'Electrician', job_name: 'Conduit rough-in', job_status: 'Planned', progress: 25, artisan_name: 'M. Bello' },
      { id: 3, job_artisan: 'Plumber', job_name: 'Soil stack first fix', job_status: 'Completed', progress: 100, artisan_name: 'S. Oke' },
      { id: 4, job_artisan: 'Iron Bender', job_name: 'Column rebar tying', job_status: 'Delayed', progress: 40, artisan_name: 'A. Musa' },
      { id: 5, job_artisan: 'Carpenter', job_name: 'Slab formwork', job_status: 'Planned', progress: 30, artisan_name: 'K. John' },
      { id: 6, job_artisan: 'Painter', job_name: 'Primer coat', job_status: 'Planned', progress: 15, artisan_name: 'P. Sam' },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isJobItemModalOpen || selectedJobItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isJobItemModalOpen, selectedJobItem]);

  const handleCreateJobItem = (e) => {
    e.preventDefault();
    setFormError(null);
    setCreatingJobItem(true);
    
    setTimeout(() => {
      setJobItems([{ id: Date.now(), ...jobItemForm, progress: 0 }, ...jobItems]);
      setIsJobItemModalOpen(false);
      setJobItemForm({ job_name: "", job_artisan: "Mason", job_status: "Planned", artisan_name: "" });
      setCreatingJobItem(false);
      showSuccessMessage("Job item created successfully ✅");
    }, 800);
  };

  const canEdit = user?.role === 'Project Manager' || user?.role === 'Foreman' || true;

  return (
    <div
      className="fade-up"
      style={{
        height: "100vh",
        overflow: (isJobItemModalOpen || selectedJobItem) ? "hidden" : "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          filter: (isJobItemModalOpen || selectedJobItem) ? "blur(2px)" : "none",
          pointerEvents: (isJobItemModalOpen || selectedJobItem) ? "none" : "auto",
          userSelect: (isJobItemModalOpen || selectedJobItem) ? "none" : "auto",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
          <span>Maple Heights</span>
          <ChevronRight size={14} />
          <span>Plot B-14</span>
          <ChevronRight size={14} />
          <span>Foundation & Substructure</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--brand-orange)' }}>Jobs</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Job Items</h1>
            <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Tasks assigned to artisans</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} />
              <span>Filter</span>
            </button>
            <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SortAsc size={18} />
              <span>Sort</span>
            </button>
            <button className="btn-primary" onClick={() => setIsJobItemModalOpen(true)}>
              <Plus size={18} />
              <span>New job item</span>
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '32px' 
        }}>
          {jobItems.map(job => (
            <JobItemCard key={job.id} job={job} onClick={() => setSelectedJobItem(job)} />
          ))}
        </div>
      </div>

      {/* FULLSCREEN FORM */}
      {isJobItemModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8, 8, 8, 0.92)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "48px 24px",
          }}
        >
          <div
            className="fade-in"
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              background: "var(--bg-surface)",
              borderRadius: "28px",
              border: "1px solid var(--border-subtle)",
              padding: "56px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ marginBottom: "48px" }}>
              <h2 style={{ fontSize: "52px", marginBottom: "12px", lineHeight: 1 }}>New Job Item</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>Assign a specific task to an artisan.</p>
            </div>

            {formError && (
              <div style={{ background: "rgba(220, 38, 38, 0.12)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#f87171", padding: "16px 20px", borderRadius: "14px", marginBottom: "28px", fontSize: "14px" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateJobItem} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Job Name</label>
                <input
                  type="text"
                  required
                  value={jobItemForm.job_name}
                  onChange={(e) => setJobItemForm({ ...jobItemForm, job_name: e.target.value })}
                  placeholder="e.g. Block laying ground floor"
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Artisan Role</label>
                  <select
                    value={jobItemForm.job_artisan}
                    onChange={(e) => setJobItemForm({ ...jobItemForm, job_artisan: e.target.value })}
                    style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                  >
                    <option value="Mason">Mason</option>
                    <option value="Electrician">Electrician</option>
                    <option value="Plumber">Plumber</option>
                    <option value="Iron Bender">Iron Bender</option>
                    <option value="Carpenter">Carpenter</option>
                    <option value="Painter">Painter</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Artisan Name</label>
                  <input
                    type="text"
                    required
                    value={jobItemForm.artisan_name}
                    onChange={(e) => setJobItemForm({ ...jobItemForm, artisan_name: e.target.value })}
                    placeholder="e.g. John Doe"
                    style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Status</label>
                <select
                  value={jobItemForm.job_status}
                  onChange={(e) => setJobItemForm({ ...jobItemForm, job_status: e.target.value })}
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "32px", borderTop: "1px solid var(--border-subtle)", marginTop: "12px" }}>
                <button type="button" className="btn-ghost" onClick={() => { setIsJobItemModalOpen(false); setFormError(null); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  {creatingJobItem ? <Spinner /> : <><Plus size={18} />Create Job Item</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER */}
      <Drawer
        isOpen={!!selectedJobItem}
        onClose={() => setSelectedJobItem(null)}
        title={selectedJobItem?.job_name}
        subtitle="Foundation & Substructure • Plot B-14"
      >
        {selectedJobItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <RoleBadge role={selectedJobItem.job_status} />
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Edit2 size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Copy size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px', color: 'var(--status-delayed)' }}><Archive size={16} /></button>
                </div>
              )}
            </div>
            
            <div style={{ background: 'var(--bg-raised)', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Assigned Artisan</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name={selectedJobItem.artisan_name} size={32} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 500 }}>{selectedJobItem.artisan_name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>{selectedJobItem.job_artisan}</p>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Progress</p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--brand-orange)' }}>{selectedJobItem.progress}%</p>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                onClick={() => alert("Daily Report flow would trigger here.")}
              >
                <ClipboardList size={18} />
                New Daily Report
              </button>
            </div>

            <CommentsSection itemId={selectedJobItem.id} itemType="job_item" />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default JobItemsPage;
