import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JobItemCard, Spinner, Modal, FilterSortDropdown } from '../components';
import { Filter, SortAsc, SortDesc, Plus, HelpCircle } from 'lucide-react';
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
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterWork, setFilterWork] = useState('All');
  const [sortOrder, setSortOrder] = useState('recent');

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

  const uniqueWorks = Array.from(new Set(jobItems.map(j => j.work_item_name))).filter(Boolean);
  const workOptions = [
    { label: 'All Works', value: 'All' },
    ...uniqueWorks.map(name => ({ label: name, value: name }))
  ];

  const filteredJobItems = jobItems.filter(j => {
    const jStatus = j.status || j.job_status;
    if (filterStatus !== 'All' && jStatus !== filterStatus) return false;
    if (filterWork !== 'All' && j.work_item_name !== filterWork) return false;
    return true;
  });

  const sortedJobItems = [...filteredJobItems].sort((a, b) => {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "48px", margin: 0 }}>Jobs</h1>
            <p style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>
              {jobItems.length} active tasks assigned to artisans
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
            {!workItemIdFromQuery && workOptions.length > 1 && (
              <FilterSortDropdown
                icon={Filter}
                label="Work Item"
                options={workOptions}
                value={filterWork}
                onChange={setFilterWork}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px" }}>
            {sortedJobItems.map(item => (
              <JobItemCard 
                key={item.id} 
                job={item} 
                onClick={() => navigate(`/job-items/${item.id}`)}
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
