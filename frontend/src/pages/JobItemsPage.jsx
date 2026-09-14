import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JobItemCard, Spinner, Modal } from '../components';
import { Filter, Plus, HelpCircle } from 'lucide-react';
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
  const [showHelpModal, setShowHelpModal] = useState(false);

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
            <h1 style={{ fontSize: "48px", margin: 0 }}>Jobs</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {jobItems.length} active tasks assigned to artisans
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
                if (workItemIdFromQuery) {
                  navigate(`/work-items/${workItemIdFromQuery}/job-items/new`);
                } else {
                  navigate('/job-items/new');
                }
              }}
            >
              <Plus size={16} />
              <span>New Job</span>
            </button>
          </div>
        </div>

        {jobItems.length === 0 && !loading ? (
          <div style={{
            minHeight: '320px', border: '1px dashed var(--border-default)', borderRadius: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px', color: 'var(--text-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '28px' }}>No jobs yet</h2>
              <div 
                onClick={() => setShowHelpModal(true)} 
                style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
              >
                <HelpCircle size={20} />
              </div>
            </div>
            <p style={{ maxWidth: '420px', textAlign: 'center' }}>Create a job item to assign tasks to artisans and teams within a work item.</p>
            <button className="btn-primary" onClick={() => navigate('/job-items/new')} style={{ padding: '14px 40px', height: 'auto' }}>
              Create job to start
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
            {jobItems.map(job => (
              <JobItemCard 
                key={job.id} 
                job={job} 
                onClick={() => navigate(`/job-items/${job.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="What is a Job Item?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Jobs</strong> (or Job Items) are specific tasks assigned to artisans or teams within a Work Item.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> If the Work is "Foundation Laying", a Job could be "Trench Excavation" or "Pouring Concrete".
          <br /><br />
          Jobs are where you submit Daily Reports to update progress and track issues.
        </p>
      </Modal>
    </div>
  );
};

export default JobItemsPage;
