import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PlotCard, StatCard, Spinner, Modal, FilterSortDropdown } from '../components';
import { Filter, SortAsc, SortDesc, Plus, HelpCircle, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const PlotsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const projectIdFromQuery = queryParams.get('project_id');

  const { token } = useAuth();
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterProject, setFilterProject] = useState('All');
  const [sortOrder, setSortOrder] = useState('recent');

  useEffect(() => {
    fetchAllPlots();
  }, [projectIdFromQuery]);

  const fetchAllPlots = async () => {
    setLoading(true);
    try {
      const url = projectIdFromQuery ? `/projects/${projectIdFromQuery}/plots/` : "/plots/";
      const res = await apiFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        setPlots(unwrapList(data));
      }
    } catch (error) {
      console.error("Fetch plots failed", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const uniqueProjects = Array.from(new Set(plots.map(p => p.project_name))).filter(Boolean);
  const projectOptions = [
    { label: 'All Projects', value: 'All' },
    ...uniqueProjects.map(name => ({ label: name, value: name }))
  ];

  const filteredPlots = plots.filter(p => {
    const pStatus = p.status || p.plot_status;
    if (filterStatus !== 'All' && pStatus !== filterStatus) return false;
    if (filterProject !== 'All' && p.project_name !== filterProject) return false;
    return true;
  });

  const sortedPlots = [...filteredPlots].sort((a, b) => {
    if (sortOrder === 'recent') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortOrder === 'target_end_date') {
      const dateA = a.target_end_date ? new Date(a.target_end_date).getTime() : Infinity;
      const dateB = b.target_end_date ? new Date(b.target_end_date).getTime() : Infinity;
      return dateA - dateB;
    }
    return 0;
  });

  return (
    <div className="fade-up" style={{ height: "100vh", overflow: "auto", position: "relative" }}>
      <div style={{ paddingBottom: "100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ fontSize: "48px", margin: 0 }}>Plots</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {plots.length} sites across active projects
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <FilterSortDropdown
              icon={Filter}
              label="Status"
              options={[
                { label: 'All Statuses', value: 'All' },
                { label: 'Planned', value: 'Planned' },
                { label: 'In Progress', value: 'In Progress' },
                { label: 'Completed', value: 'Completed' },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
            />
            {!projectIdFromQuery && projectOptions.length > 1 && (
              <FilterSortDropdown
                icon={Filter}
                label="Project"
                options={projectOptions}
                value={filterProject}
                onChange={setFilterProject}
              />
            )}
            <FilterSortDropdown
              icon={sortOrder === 'oldest' ? SortAsc : SortDesc}
              label="Sort"
              options={[
                { label: 'Recent First', value: 'recent' },
                { label: 'Oldest First', value: 'oldest' },
                { label: 'Target End Date', value: 'target_end_date' }
              ]}
              value={sortOrder}
              onChange={setSortOrder}
            />
            <button
              className="btn-primary"
              onClick={() => {
                if (projectIdFromQuery) {
                  console.log("Navigating to new plot in project:", projectIdFromQuery);
                  navigate(`/projects/${projectIdFromQuery}/plots/new`);
                } else {
                  console.log("Navigating to new plot");
                  navigate('/plots/new');
                }
              }}
            >
              <Plus size={16} />
              <span>New Plot</span>
            </button>
          </div>
        </div>

        <ul className="horizontal-list-mobile stat-cards-row" style={{ marginBottom: "48px" }}>
          <li><StatCard label="Total Plots" value={plots.length} /></li>
          <li><StatCard label="Active" value={plots.filter(p => p.plot_status !== 'Completed').length} color="var(--brand-orange)" /></li>
          <li><StatCard label="Completed" value={plots.filter(p => p.plot_status === 'Completed').length} color="var(--status-completed)" /></li>
        </ul>

        {plots.length === 0 && !loading ? (
          <div style={{
            minHeight: '320px', border: '1px dashed var(--border-default)', borderRadius: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px', color: 'var(--text-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '28px' }}>No plots yet</h2>
              <div 
                onClick={() => setShowHelpModal(true)} 
                style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
              >
                <HelpCircle size={20} />
              </div>
            </div>
            <p style={{ maxWidth: '420px', textAlign: 'center' }}>Create a plot to start tracking works and progress for a specific area.</p>
            <button className="btn-primary" onClick={() => navigate('/plots/new')} style={{ padding: '14px 40px', height: 'auto' }}>
              Create plot to start
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px" }}>
            {sortedPlots.map((plot) => (
              <PlotCard
                key={plot.id}
                plot={plot}
                onClick={() => {
                  if (projectIdFromQuery) {
                    navigate(`/projects/${projectIdFromQuery}/plots/${plot.id}`);
                  } else {
                    navigate(`/plots/${plot.id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="What is a Plot?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Plots</strong> represent physical subdivisions or logical phases of a Project.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> If your project is a housing estate, a Plot could be "Block A" or "Plot 12". If your project is a highway, a Plot could be "Kilometer 1-5".
          <br /><br />
          Inside a Plot, you will track specific Work Items (e.g., Foundation, Plumbing).
        </p>
      </Modal>
    </div>
  );
};

export default PlotsPage;
