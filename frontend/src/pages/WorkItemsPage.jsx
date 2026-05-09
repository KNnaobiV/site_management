import React, { useState, useEffect } from 'react';
import { WorkItemCard } from '../components';
import { Filter, SortAsc, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const WorkItemsPage = () => {
  const [workItems, setWorkItems] = useState([
    { id: 1, name: 'Foundation & Substructure', description: 'Excavation, foundations, piling and substructure works.', work_status: 'In Progress', is_approved: true },
    { id: 2, name: 'Reinforced Concrete Frame', description: 'Columns, beams, slabs and core concrete structure.', work_status: 'Planned', is_approved: true },
    { id: 3, name: 'Roofing & Waterproofing', description: 'Roof structure, insulation and waterproofing systems.', work_status: 'Completed', is_approved: true },
    { id: 4, name: 'MEP Rough-In', description: 'Mechanical, electrical and plumbing rough-in installations.', work_status: 'Delayed', is_approved: true },
    { id: 5, name: 'Plastering & Screeding', description: 'Internal plastering, wall finishes and floor screeding.', work_status: 'On Hold', is_approved: false },
    { id: 6, name: 'External Cladding', description: 'Facade cladding, insulation and external finishes.', work_status: 'Planned', is_approved: false },
  ]);

  return (
    <div className="fade-up">
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        <span>Maple Heights Tower</span>
        <ChevronRight size={14} />
        <span>Plot B-14</span>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--brand-orange)' }}>Work Items</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Work Items</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Phases of construction at this plot</p>
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
            <span>New work item</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '32px' 
      }}>
        {workItems.map(item => (
          <WorkItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

export default WorkItemsPage;
