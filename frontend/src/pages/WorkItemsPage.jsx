import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WorkItemCard, Spinner, Modal } from '../components';
import { Filter, Plus, HelpCircle } from 'lucide-react';
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
  const [showHelpModal, setShowHelpModal] = useState(false);

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
            <h1 style={{ fontSize: "48px", margin: 0 }}>Works</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {workItems.length} active phases across plots
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn-ghost">
              <Filter size={16} />
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
              <Plus size={16} />
              <span>New Work</span>
            </button>
          </div>
        </div>

        {workItems.length === 0 && !loading ? (
          <div style={{
            minHeight: '320px', border: '1px dashed var(--border-default)', borderRadius: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px', color: 'var(--text-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '28px' }}>No works yet</h2>
              <div 
                onClick={() => setShowHelpModal(true)} 
                style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
              >
                <HelpCircle size={20} />
              </div>
            </div>
            <p style={{ maxWidth: '420px', textAlign: 'center' }}>Create a work item to represent a major phase of construction within a plot.</p>
            <button className="btn-primary" onClick={() => navigate('/work-items/new')} style={{ padding: '14px 40px', height: 'auto' }}>
              Create work to start
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "32px" }}>
            {workItems.map(item => (
              <WorkItemCard 
                key={item.id} 
                item={item} 
                onClick={() => navigate(`/work-items/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="What is a Work Item?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Works</strong> (or Work Items) represent major activities, tasks, or components that need to be completed within a Plot.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> "Foundation Laying", "Roofing", "Electrical First Fix", or "Plumbing".
          <br /><br />
          Inside a Work Item, you create Job Items (the day-to-day tasks).
        </p>
      </Modal>
    </div>
  );
};

export default WorkItemsPage;
