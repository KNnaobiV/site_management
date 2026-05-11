import React, { useState, useEffect } from 'react';
import { PlotCard, StatCard, Spinner, Drawer, RoleBadge, Avatar } from '../components';
import { Filter, SortAsc, Plus, Edit2, Archive, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const PlotsPage = () => {
  const { user, token } = useAuth();
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
  const [plotForm, setPlotForm] = useState({
    address: "",
    plot_status: "Planned",
  });
  const [formError, setFormError] = useState(null);
  const [creatingPlot, setCreatingPlot] = useState(false);

  // Drawer State
  const [selectedPlot, setSelectedPlot] = useState(null);

  useEffect(() => {
    fetchAllPlots();
  }, []);

  useEffect(() => {
    if (isPlotModalOpen || selectedPlot) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isPlotModalOpen, selectedPlot]);

  const fetchAllPlots = async () => {
    setPlots([
      { id: 1, address: 'Plot B-14', project_name: 'Maple Heights Tower', plot_status: 'In Progress' },
      { id: 2, address: 'Plot C-07', project_name: 'Maple Heights Tower', plot_status: 'Planned' },
      { id: 3, address: 'Plot A-03', project_name: 'Maple Heights Tower', plot_status: 'Completed' },
      { id: 4, address: 'Plot D-21', project_name: 'Maple Heights Tower', plot_status: 'In Progress' },
      { id: 5, address: 'Plot E-11', project_name: 'Maple Heights Tower', plot_status: 'Planned' },
      { id: 6, address: 'Plot F-05', project_name: 'Maple Heights Tower', plot_status: 'In Progress' },
    ]);
    setLoading(false);
  };

  const handleCreatePlot = async (e) => {
    e.preventDefault();
    setFormError(null);
    setCreatingPlot(true);
    
    // MOCK API CALL
    setTimeout(() => {
      setPlots([{ id: Date.now(), address: plotForm.address, project_name: 'New Project', plot_status: plotForm.plot_status }, ...plots]);
      setIsPlotModalOpen(false);
      setPlotForm({ address: "", plot_status: "Planned" });
      setCreatingPlot(false);
      showSuccessMessage("Plot created successfully ✅");
    }, 800);
  };

  const canEdit = user?.role === 'Project Manager' || user?.role === 'Foreman' || true; // MOCK true for now if role missing

  return (
    <div
      className="fade-up"
      style={{
        height: "100vh",
        overflow: (isPlotModalOpen || selectedPlot) ? "hidden" : "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          filter: (isPlotModalOpen || selectedPlot) ? "blur(2px)" : "none",
          pointerEvents: (isPlotModalOpen || selectedPlot) ? "none" : "auto",
          userSelect: (isPlotModalOpen || selectedPlot) ? "none" : "auto",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Plots</h1>
            <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>{plots.length} active site allocations</p>
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
            <button className="btn-primary" onClick={() => setIsPlotModalOpen(true)}>
              <Plus size={18} />
              <span>New plot</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
          <StatCard label="Pending" value={plots.filter(p => p.plot_status === 'Planned').length} />
          <StatCard label="In Progress" value={plots.filter(p => p.plot_status === 'In Progress').length} color="var(--brand-orange)" />
          <StatCard label="Completed" value={plots.filter(p => p.plot_status === 'Completed').length} color="var(--status-completed)" />
        </div>

        {/* Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '32px' 
        }}>
          {plots.map(plot => (
            <PlotCard key={plot.id} plot={plot} onClick={() => setSelectedPlot(plot)} />
          ))}
        </div>
      </div>

      {/* FULLSCREEN FORM */}
      {isPlotModalOpen && (
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
              <h2 style={{ fontSize: "52px", marginBottom: "12px", lineHeight: 1 }}>New Plot</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>Define a new site allocation.</p>
            </div>

            {formError && (
              <div style={{ background: "rgba(220, 38, 38, 0.12)", border: "1px solid rgba(220, 38, 38, 0.3)", color: "#f87171", padding: "16px 20px", borderRadius: "14px", marginBottom: "28px", fontSize: "14px" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePlot} style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>Plot Address/Identifier</label>
                <input
                  type="text"
                  required
                  value={plotForm.address}
                  onChange={(e) => setPlotForm({ ...plotForm, address: e.target.value })}
                  placeholder="e.g. Plot B-14"
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Status</label>
                <select
                  value={plotForm.plot_status}
                  onChange={(e) => setPlotForm({ ...plotForm, plot_status: e.target.value })}
                  style={{ width: "100%", padding: "18px", borderRadius: "16px", border: "1px solid var(--border-default)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: "15px" }}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "32px", borderTop: "1px solid var(--border-subtle)", marginTop: "12px" }}>
                <button type="button" className="btn-ghost" onClick={() => { setIsPlotModalOpen(false); setFormError(null); }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  {creatingPlot ? <Spinner /> : <><Plus size={18} />Create Plot</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER */}
      <Drawer
        isOpen={!!selectedPlot}
        onClose={() => setSelectedPlot(null)}
        title={selectedPlot?.address}
        subtitle={`Parent Project: ${selectedPlot?.project_name}`}
      >
        {selectedPlot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <RoleBadge role={selectedPlot.plot_status} />
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Edit2 size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px' }}><Copy size={16} /></button>
                  <button className="btn-ghost" style={{ padding: '8px', color: 'var(--status-delayed)' }}><Archive size={16} /></button>
                </div>
              )}
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Assigned Team</h3>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name="Foreman" size={32} />
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>J. Adeyemi</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Foreman</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Avatar name="Storekeeper" size={32} />
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>M. Bello</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Storekeeper</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Quick Stats</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-raised)', borderRadius: '12px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Active Work Items</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>4</p>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-raised)', borderRadius: '12px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Recent Reports</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>12</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PlotsPage;
