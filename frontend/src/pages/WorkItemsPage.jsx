import React, { useState, useEffect } from 'react';
import { WorkItemCard, Spinner, Drawer, CommentsSection, RoleBadge } from '../components';
import { Filter, SortAsc, Plus, ChevronRight, Edit2, Copy, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showSuccessMessage } from '../utils/successMessage';

const WorkItemsPage = () => {
  const { user } = useAuth();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isWorkItemModalOpen, setIsWorkItemModalOpen] = useState(false);
  const [workItemForm, setWorkItemForm] = useState({
    name: "",
    description: "",
    work_status: "Planned"
  });
  const [creatingWorkItem, setCreatingWorkItem] = useState(false);
  const [formError, setFormError] = useState(null);

  const [selectedWorkItem, setSelectedWorkItem] = useState(null);

  useEffect(() => {
    setWorkItems([
      { id: 1, name: 'Foundation & Substructure', description: 'Excavation, foundations, piling and substructure works.', work_status: 'In Progress', is_approved: true },
      { id: 2, name: 'Reinforced Concrete Frame', description: 'Columns, beams, slabs and core concrete structure.', work_status: 'Planned', is_approved: true },
      { id: 3, name: 'Roofing & Waterproofing', description: 'Roof structure, insulation and waterproofing systems.', work_status: 'Completed', is_approved: true },
      { id: 4, name: 'MEP Rough-In', description: 'Mechanical, electrical and plumbing rough-in installations.', work_status: 'Delayed', is_approved: true },
      { id: 5, name: 'Plastering & Screeding', description: 'Internal plastering, wall finishes and floor screeding.', work_status: 'On Hold', is_approved: false },
      { id: 6, name: 'External Cladding', description: 'Facade cladding, insulation and external finishes.', work_status: 'Planned', is_approved: false },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isWorkItemModalOpen || selectedWorkItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isWorkItemModalOpen, selectedWorkItem]);

  const handleCreateWorkItem = (e) => {
    e.preventDefault();
    setFormError(null);
    setCreatingWorkItem(true);
    
    setTimeout(() => {
      setWorkItems([{ id: Date.now(), name: workItemForm.name, description: workItemForm.description, work_status: workItemForm.work_status, is_approved: false }, ...workItems]);
      setIsWorkItemModalOpen(false);
      setWorkItemForm({ name: "", description: "", work_status: "Planned" });
      setCreatingWorkItem(false);
      showSuccessMessage("Work item created successfully ✅");
    }, 800);
  };

  const canEdit = user?.role === 'Project Manager' || user?.role === 'Foreman' || true;

  return (
    <div
      className="fade-up"
      style={{
        height: "100vh",
        overflow: (isWorkItemModalOpen || selectedWorkItem) ? "hidden" : "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          filter: (isWorkItemModalOpen || selectedWorkItem) ? "blur(2px)" : "none",
          pointerEvents: (isWorkItemModalOpen || selectedWorkItem) ? "none" : "auto",
          userSelect: (isWorkItemModalOpen || selectedWorkItem) ? "none" : "auto",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
          <span>Maple Heights Tower</span>
          <ChevronRight size={14} />
          <span>Plot B-14</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--brand-orange)' }}>Work Items</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Work Items</h1>
            <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Phases of construction at this plot</p>
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
            <button className="btn-primary" onClick={() => setIsWorkItemModalOpen(true)}>
              <Plus size={18} />
              <span>New work item</span>
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '32px' 
        }}>
          {workItems.map(item => (
            <WorkItemCard key={item.id} item={item} onClick={() => setSelectedWorkItem(item)} />
          ))}
        </div>
      </div>

      {/* FULLSCREEN FORM */}
      {isWorkItemModalOpen && (
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
              <h2 style={{ fontSize: "52px", marginBottom: "12px", lineHeight: 1 }}>New Work Item</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>Add a new construction phase.</p>
            </div>

            {formError && (
              <div style={{ background: "rgba(220, 38, 38, 0.12)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#f87171", padding: "16px 20px", borderRadius: "14px", marginBottom: "28px", fontSize: "14px" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateWorkItem} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Phase Name</label>
                <input
                  type="text"
                  required
                  value={workItemForm.name}
                  onChange={(e) => setWorkItemForm({ ...workItemForm, name: e.target.value })}
                  placeholder="e.g. Electrical Rough-in"
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Description</label>
                <textarea
                  value={workItemForm.description}
                  onChange={(e) => setWorkItemForm({ ...workItemForm, description: e.target.value })}
                  placeholder="Describe the scope of this phase..."
                  style={{ width: "100%", minHeight: "140px", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px", resize: "vertical" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Status</label>
                <select
                  value={workItemForm.work_status}
                  onChange={(e) => setWorkItemForm({ ...workItemForm, work_status: e.target.value })}
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "32px", borderTop: "1px solid var(--border-subtle)", marginTop: "12px" }}>
                <button type="button" className="btn-ghost" onClick={() => { setIsWorkItemModalOpen(false); setFormError(null); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  {creatingWorkItem ? <Spinner /> : <><Plus size={18} />Create Work Item</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER */}
      <Drawer
        isOpen={!!selectedWorkItem}
        onClose={() => setSelectedWorkItem(null)}
        title={selectedWorkItem?.name}
        subtitle="Plot B-14 • Maple Heights Tower"
      >
        {selectedWorkItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <RoleBadge role={selectedWorkItem.work_status} />
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Edit2 size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Copy size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px', color: 'var(--status-delayed)' }}><Archive size={16} /></button>
                </div>
              )}
            </div>
            
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {selectedWorkItem.description}
            </p>

            <CommentsSection itemId={selectedWorkItem.id} itemType="work_item" />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default WorkItemsPage;
