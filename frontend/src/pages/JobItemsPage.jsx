import React, { useState, useEffect } from 'react';
import { JobItemCard } from '../components';
import { Filter, SortAsc, Plus, ChevronRight } from 'lucide-react';

const JobItemsPage = () => {
  const [jobItems, setJobItems] = useState([
    { id: 1, job_artisan: 'Mason', job_name: 'Block laying ground floor', job_status: 'In Progress', progress: 65, artisan_name: 'J. Adeyemi' },
    { id: 2, job_artisan: 'Electrician', job_name: 'Conduit rough-in', job_status: 'Planned', progress: 25, artisan_name: 'M. Bello' },
    { id: 3, job_artisan: 'Plumber', job_name: 'Soil stack first fix', job_status: 'Completed', progress: 100, artisan_name: 'S. Oke' },
    { id: 4, job_artisan: 'Iron Bender', job_name: 'Column rebar tying', job_status: 'Delayed', progress: 40, artisan_name: 'A. Musa' },
    { id: 5, job_artisan: 'Carpenter', job_name: 'Slab formwork', job_status: 'Planned', progress: 30, artisan_name: 'K. John' },
    { id: 6, job_artisan: 'Painter', job_name: 'Primer coat', job_status: 'Planned', progress: 15, artisan_name: 'P. Sam' },
  ]);

  return (
    <div className="fade-up">
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        <span>Maple Heights</span>
        <ChevronRight size={14} />
        <span>Plot B-14</span>
        <ChevronRight size={14} />
        <span>Foundation & Substructure</span>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--brand-orange)' }}>Jobs</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Job Items</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Tasks assigned to artisans</p>
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
            <span>New job item</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '32px' 
      }}>
        {jobItems.map(job => (
          <JobItemCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
};

export default JobItemsPage;
