import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { PlotCard, StatCard, Spinner } from '../components';
import { Filter, Plus, ChevronLeft } from 'lucide-react';
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

  return (
    <div className="fade-up" style={{ height: "100vh", overflow: "auto", position: "relative" }}>
      <div style={{ paddingBottom: "100px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "48px", margin: 0 }}>Plots</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {plots.length} sites across active projects
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={18} />
              <span>Filter</span>
            </button>
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
              <Plus size={18} />
              <span>New Plot</span>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "48px" }}>
          <StatCard label="Total Plots" value={plots.length} />
          <StatCard label="Active" value={plots.filter(p => p.plot_status !== 'Completed').length} color="var(--brand-orange)" />
          <StatCard label="Completed" value={plots.filter(p => p.plot_status === 'Completed').length} color="var(--status-completed)" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "32px" }}>
          {plots.map(plot => (
            <PlotCard 
              key={plot.id} 
              plot={plot} 
              onClick={() => {
                console.log("Navigating to plot:", plot.id);
                navigate(`/plots/${plot.id}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlotsPage;
