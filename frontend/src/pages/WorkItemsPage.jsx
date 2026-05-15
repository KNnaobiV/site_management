import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WorkItemCard, Spinner } from '../components';
import { Filter, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const WorkItemsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const plotIdFromQuery = queryParams.get('plot_id');
  const projectIdFromQuery = queryParams.get('project_id');

  const { token } = useAuth();
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllWorkItems();
  }, [plotIdFromQuery, projectIdFromQuery]);

  const fetchAllWorkItems = async () => {
    setLoading(true);
    try {
      let url = "/workitems/";
      if (projectIdFromQuery && plotIdFromQuery) {
        url = `/projects/${projectIdFromQuery}/plots/${plotIdFromQuery}/workitems/`;
      }
      const res = await apiFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        setWorkItems(unwrapList(data));
      }
    } catch (error) {
      console.error("Fetch work items failed", error);
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
            <h1 style={{ fontSize: "48px", margin: 0 }}>Work Items</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {workItems.length} active phases across plots
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
                if (plotIdFromQuery) {
                  navigate(`/plots/${plotIdFromQuery}/work-items/new`);
                } else {
                  navigate('/work-items/new');
                }
              }}
            >
              <Plus size={18} />
              <span>New Work Item</span>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "32px" }}>
          {workItems.map(item => (
            <WorkItemCard 
              key={item.id} 
              item={item} 
              onClick={() => {
                console.log("Navigating to work item:", item.id);
                navigate(`/work-items/${item.id}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkItemsPage;
