import React, { useState, useEffect } from 'react';
import { PlotCard, StatCard } from '../components';
import { Filter, SortAsc, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const PlotsPage = () => {
  const { token } = useAuth();
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, we might need a way to fetch all plots across all projects
    // or just handle the current context. Assuming an "all-plots" endpoint exists or fetching per project.
    // Dashboard.jsx had fetchPlots(projectId).
    fetchAllPlots();
  }, []);

  const fetchAllPlots = async () => {
    // Mocking for now as we don't have a cross-project plots endpoint yet in the provided code
    // In a real refactor, we'd either create one or fetch sequentially.
    setPlots([
      { id: 1, address: 'Plot B-14', project_name: 'Maple Heights Tower' },
      { id: 2, address: 'Plot C-07', project_name: 'Maple Heights Tower' },
      { id: 3, address: 'Plot A-03', project_name: 'Maple Heights Tower' },
      { id: 4, address: 'Plot D-21', project_name: 'Maple Heights Tower' },
      { id: 5, address: 'Plot E-11', project_name: 'Maple Heights Tower' },
      { id: 6, address: 'Plot F-05', project_name: 'Maple Heights Tower' },
    ]);
    setLoading(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Plots</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Site allocations across all projects</p>
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
          <button className="btn-primary">
            <Plus size={18} />
            <span>New plot</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
        <StatCard label="Pending" value="3" />
        <StatCard label="In Progress" value="7" color="var(--brand-orange)" />
        <StatCard label="Completed" value="5" color="var(--status-completed)" />
      </div>

      {/* Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '32px' 
      }}>
        {plots.map(plot => (
          <PlotCard key={plot.id} plot={plot} />
        ))}
      </div>
    </div>
  );
};

export default PlotsPage;
