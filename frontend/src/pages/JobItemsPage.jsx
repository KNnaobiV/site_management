import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JobItemCard, Spinner } from '../components';
import { Filter, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const JobItemsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const workItemIdFromQuery = queryParams.get('work_item_id');
  const plotIdFromQuery = queryParams.get('plot_id');
  const projectIdFromQuery = queryParams.get('project_id');

  const { token } = useAuth();
  const [jobItems, setJobItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllJobItems();
  }, [workItemIdFromQuery, plotIdFromQuery, projectIdFromQuery]);

  const fetchAllJobItems = async () => {
    setLoading(true);
    try {
      let url = "/jobitems/";
      if (projectIdFromQuery && plotIdFromQuery && workItemIdFromQuery) {
        url = `/projects/${projectIdFromQuery}/plots/${plotIdFromQuery}/workitems/${workItemIdFromQuery}/jobitems/`;
      }
      const res = await apiFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        setJobItems(unwrapList(data));
      }
    } catch (error) {
      console.error("Fetch job items failed", error);
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
            <h1 style={{ fontSize: "48px", margin: 0 }}>Job Items</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {jobItems.length} active tasks assigned to artisans
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
                if (workItemIdFromQuery) {
                  navigate(`/work-items/${workItemIdFromQuery}/job-items/new`);
                } else {
                  navigate('/job-items/new');
                }
              }}
            >
              <Plus size={18} />
              <span>New Job Item</span>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
          {jobItems.map(job => (
            <JobItemCard 
              key={job.id} 
              job={job} 
              onClick={() => {
                console.log("Navigating to job item:", job.id);
                navigate(`/job-items/${job.id}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default JobItemsPage;
