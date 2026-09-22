import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Calendar,
  Download,
  Filter,
  Layers,
  Building2,
  MapPin,
  CheckSquare,
  ClipboardList,
  AlertCircle,
  Eye,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, getMediaUrl } from '../api/client';
import { Spinner } from '../components';

function formatCurrency(amount, currency = 'NGN') {
  const num = parseFloat(amount) || 0;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getSelectScopeErrorMessage(granularity) {
  if (granularity === 'plot') return 'Please select a plot to export.';
  if (granularity === 'workitem') return 'Please select a work to export.';
  if (granularity === 'jobitem') return 'Please select a job to export.';
  return 'Please select a plot, work item, or job to export.';
}

export default function ReportsPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: 'financial' | 'daily'
  const reportType = searchParams.get('type') || 'financial';
  const selectedProjectId = searchParams.get('project') || '';
  const selectedGranularity = searchParams.get('granularity') || 'project'; // 'project' | 'plot' | 'workitem' | 'jobitem'
  const selectedPlotId = searchParams.get('plot') || '';
  const selectedWorkItemId = searchParams.get('workitem') || '';
  const selectedJobItemId = searchParams.get('jobitem') || '';

  // Dates
  const startDateParam = searchParams.get('start_date') || '';
  const endDateParam = searchParams.get('end_date') || '';

  // Hierarchy Data
  const [projects, setProjects] = useState([]);
  const [plots, setPlots] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [jobItems, setJobItems] = useState([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);

  // Active Report Data
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Lightbox Modal for Figures
  const [lightboxImage, setLightboxImage] = useState(null);

  // Helper to update query params cleanly
  const updateQuery = useCallback((newParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Load Projects on initial mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await apiFetch('/projects/', { token });
        if (res.ok) {
          const list = unwrapList(await res.json());
          setProjects(list);
          if (!selectedProjectId && list.length > 0) {
            updateQuery({ project: String(list[0].id) });
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }
    loadProjects();
  }, [token]);

  // Load Plots when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) {
      setPlots([]);
      return;
    }
    async function loadPlots() {
      try {
        const res = await apiFetch(`/projects/${selectedProjectId}/plots/`, { token });
        if (res.ok) {
          const list = unwrapList(await res.json());
          setPlots(list);
        }
      } catch (err) {
        console.error('Failed to load plots:', err);
      }
    }
    loadPlots();
  }, [selectedProjectId, token]);

  // Load Work Items when selectedPlotId changes
  useEffect(() => {
    if (!selectedPlotId) {
      setWorkItems([]);
      return;
    }
    async function loadWorkItems() {
      try {
        let res = await apiFetch(`/plots/${selectedPlotId}/workitems/`, { token });
        if (!res.ok && selectedProjectId) {
          res = await apiFetch(`/projects/${selectedProjectId}/plots/${selectedPlotId}/workitems/`, { token });
        }
        if (!res.ok) {
          res = await apiFetch(`/workitems/?plot=${selectedPlotId}`, { token });
        }
        if (res.ok) {
          const list = unwrapList(await res.json());
          setWorkItems(list);
        }
      } catch (err) {
        console.error('Failed to load work items:', err);
      }
    }
    loadWorkItems();
  }, [selectedPlotId, selectedProjectId, token]);

  // Load Job Items when selectedWorkItemId changes
  useEffect(() => {
    if (!selectedWorkItemId) {
      setJobItems([]);
      return;
    }
    async function loadJobItems() {
      try {
        let res = await apiFetch(`/workitems/${selectedWorkItemId}/jobitems/`, { token });
        if (!res.ok && selectedProjectId && selectedPlotId) {
          res = await apiFetch(`/projects/${selectedProjectId}/plots/${selectedPlotId}/workitems/${selectedWorkItemId}/jobitems/`, { token });
        }
        if (!res.ok) {
          res = await apiFetch(`/jobitems/?work_item=${selectedWorkItemId}`, { token });
        }
        if (res.ok) {
          const list = unwrapList(await res.json());
          setJobItems(list);
        }
      } catch (err) {
        console.error('Failed to load job items:', err);
      }
    }
    loadJobItems();
  }, [selectedWorkItemId, selectedPlotId, selectedProjectId, token]);

  // Load Report Data whenever relevant filters change
  useEffect(() => {
    if (!selectedProjectId) {
      setReportData(null);
      return;
    }

    let isMounted = true;
    setReportData(null);
    setLoadingReport(true);
    setReportError(null);

    async function fetchReport() {
      try {
        if (reportType === 'financial') {
          await fetchFinancialReport();
        } else {
          await fetchDailyProgressReport();
        }
      } catch (err) {
        if (isMounted) {
          setReportError(err.message || 'Failed to load report data.');
        }
      } finally {
        if (isMounted) setLoadingReport(false);
      }
    }

    async function fetchFinancialReport() {
      let targetBudgetUrl = '';
      let targetExpensesUrl = '';
      let breakdownUrl = '';
      let breakdownType = '';

      if (selectedGranularity === 'project') {
        targetBudgetUrl = `/projects/${selectedProjectId}/budget/`;
        targetExpensesUrl = `/projects/${selectedProjectId}/expenses/`;
        breakdownUrl = `/projects/${selectedProjectId}/plots/`;
        breakdownType = 'plots';
      } else if (selectedGranularity === 'plot' && selectedPlotId) {
        targetBudgetUrl = `/plots/${selectedPlotId}/budget/`;
        targetExpensesUrl = `/plots/${selectedPlotId}/expenses/`;
        breakdownUrl = `/plots/${selectedPlotId}/workitems/`;
        breakdownType = 'workitems';
      } else if (selectedGranularity === 'workitem' && selectedWorkItemId) {
        targetBudgetUrl = `/workitems/${selectedWorkItemId}/budget/`;
        targetExpensesUrl = `/workitems/${selectedWorkItemId}/expenses/`;
        breakdownUrl = `/workitems/${selectedWorkItemId}/jobitems/`;
        breakdownType = 'jobitems';
      } else if (selectedGranularity === 'jobitem' && selectedJobItemId) {
        targetBudgetUrl = `/jobitems/${selectedJobItemId}/budget/`;
        targetExpensesUrl = `/jobitems/${selectedJobItemId}/expenses/`;
      }

      if (!targetBudgetUrl) {
        if (isMounted) setReportData(null);
        return;
      }

      // Parallel fetch budget, expenses, and child breakdown
      const [budgetRes, expensesRes, breakdownRes] = await Promise.all([
        apiFetch(targetBudgetUrl, { token }).catch(() => null),
        apiFetch(targetExpensesUrl, { token }).catch(() => null),
        breakdownUrl ? apiFetch(breakdownUrl, { token }).catch(() => null) : Promise.resolve(null),
      ]);

      const budgetData = budgetRes && budgetRes.ok ? await budgetRes.json() : null;
      const expensesList = expensesRes && expensesRes.ok ? unwrapList(await expensesRes.json()) : [];
      const breakdownList = breakdownRes && breakdownRes.ok ? unwrapList(await breakdownRes.json()) : [];

      // Filter expenses by date if selected
      let filteredExpenses = expensesList;
      if (startDateParam) {
        filteredExpenses = filteredExpenses.filter(e => (e.incurred_at || '').slice(0, 10) >= startDateParam);
      }
      if (endDateParam) {
        filteredExpenses = filteredExpenses.filter(e => (e.incurred_at || '').slice(0, 10) <= endDateParam);
      }

      // Sort expenses by date ascending
      filteredExpenses.sort((a, b) => {
        const dA = new Date(a.incurred_at || a.created_at || 0);
        const dB = new Date(b.incurred_at || b.created_at || 0);
        return dA - dB;
      });

      const allocated = parseFloat(budgetData?.allocated_amount || 0);
      const hasBudget = allocated > 0;
      const spent = filteredExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      const remaining = hasBudget ? allocated - spent : null;
      const currency = budgetData?.currency || 'NGN';
      const utilization = hasBudget ? Math.round((spent / allocated) * 100) : null;

      if (isMounted) {
        setReportData({
          type: 'financial',
          budget: budgetData,
          hasBudget,
          allocated,
          spent,
          remaining,
          currency,
          utilization,
          expenses: filteredExpenses,
          breakdown: breakdownList,
          breakdownType,
        });
      }
    }

    async function fetchDailyProgressReport() {
      let reportsUrl = '';
      if (selectedGranularity === 'project') {
        reportsUrl = `/projects/${selectedProjectId}/reports/`;
      } else if (selectedGranularity === 'plot' && selectedPlotId) {
        reportsUrl = `/plots/${selectedPlotId}/reports/`;
      } else if (selectedGranularity === 'workitem' && selectedWorkItemId) {
        reportsUrl = `/workitems/${selectedWorkItemId}/reports/`;
      } else if (selectedGranularity === 'jobitem' && selectedJobItemId) {
        reportsUrl = `/jobitems/${selectedJobItemId}/reports/`;
      }

      if (!reportsUrl) {
        if (isMounted) setReportData(null);
        return;
      }

      const res = await apiFetch(reportsUrl, { token });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || 'Failed to fetch progress reports.');
      }

      let reportsList = unwrapList(await res.json());

      // Filter by date range
      if (startDateParam) {
        reportsList = reportsList.filter(r => (r.report_date || '').slice(0, 10) >= startDateParam);
      }
      if (endDateParam) {
        reportsList = reportsList.filter(r => (r.report_date || '').slice(0, 10) <= endDateParam);
      }

      // Catalog all figures and cross-reference them
      const catalogedFigures = [];
      const reportsWithFigures = reportsList.map(report => {
        const pics = Array.isArray(report.photos) ? [...report.photos] : [];
        if (report.job_image && !pics.some(p => p.id === report.job_image.id)) {
          pics.unshift(report.job_image);
        }

        const figRefs = [];
        pics.forEach(pic => {
          const figNum = catalogedFigures.length + 1;
          const figLabel = `Fig. ${figNum}`;
          catalogedFigures.push({
            figNum,
            figLabel,
            pic,
            caption: `${report.job_item_name || report.job_item?.job_name || 'Job Report'} (${report.report_date})`,
            description: pic.description || report.notes || '',
            date: report.report_date,
            reportedBy: report.reported_by_name || report.reported_by?.display_name || report.reported_by?.username,
          });
          figRefs.push(figLabel);
        });

        return {
          ...report,
          figRefs,
        };
      });

      if (isMounted) {
        setReportData({
          type: 'daily',
          reports: reportsWithFigures,
          figures: catalogedFigures,
        });
      }
    }

    fetchReport();

    return () => {
      isMounted = false;
    };
  }, [
    token,
    reportType,
    selectedProjectId,
    selectedGranularity,
    selectedPlotId,
    selectedWorkItemId,
    selectedJobItemId,
    startDateParam,
    endDateParam,
  ]);

  // Export PDF Handler
  const handleExportPDF = async () => {
    setExporting(true);
    setExportError(null);

    try {
      let exportEndpoint = '';
      let defaultFileName = '';

      const isFinancial = reportType === 'financial';

      if (selectedGranularity === 'project' && selectedProjectId) {
        exportEndpoint = isFinancial
          ? `/projects/${selectedProjectId}/export-financial-report/`
          : `/projects/${selectedProjectId}/export-reports/?start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `project_${selectedProjectId}_${isFinancial ? 'financial' : 'progress'}_report.pdf`;
      } else if (selectedGranularity === 'plot' && selectedPlotId) {
        exportEndpoint = isFinancial
          ? `/plots/${selectedPlotId}/export-financial-report/`
          : `/plots/${selectedPlotId}/export-reports/?start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `plot_${selectedPlotId}_${isFinancial ? 'financial' : 'progress'}_report.pdf`;
      } else if (selectedGranularity === 'workitem' && selectedWorkItemId) {
        exportEndpoint = isFinancial
          ? `/workitems/${selectedWorkItemId}/export-financial-report/`
          : `/workitems/${selectedWorkItemId}/export-reports/?start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `workitem_${selectedWorkItemId}_${isFinancial ? 'financial' : 'progress'}_report.pdf`;
      } else if (selectedGranularity === 'jobitem' && selectedJobItemId) {
        exportEndpoint = isFinancial
          ? `/jobitems/${selectedJobItemId}/export-financial-report/`
          : `/jobitems/${selectedJobItemId}/export-reports/?start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `jobitem_${selectedJobItemId}_${isFinancial ? 'financial' : 'progress'}_report.pdf`;
      }

      if (!exportEndpoint) {
        throw new Error(getSelectScopeErrorMessage(selectedGranularity));
      }

      const res = await apiFetch(exportEndpoint, { token });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to generate PDF export.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export error occurred.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportXLSX = async () => {
    setExporting(true);
    setExportError(null);

    try {
      let exportEndpoint = '';
      let defaultFileName = '';

      const isFinancial = reportType === 'financial';

      if (selectedGranularity === 'project' && selectedProjectId) {
        exportEndpoint = isFinancial
          ? `/projects/${selectedProjectId}/export-financial-report/?format=xlsx`
          : `/projects/${selectedProjectId}/export-reports/?format=xlsx&start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `project_${selectedProjectId}_${isFinancial ? 'financial' : 'progress'}_report.xlsx`;
      } else if (selectedGranularity === 'plot' && selectedPlotId) {
        exportEndpoint = isFinancial
          ? `/plots/${selectedPlotId}/export-financial-report/?format=xlsx`
          : `/plots/${selectedPlotId}/export-reports/?format=xlsx&start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `plot_${selectedPlotId}_${isFinancial ? 'financial' : 'progress'}_report.xlsx`;
      } else if (selectedGranularity === 'workitem' && selectedWorkItemId) {
        exportEndpoint = isFinancial
          ? `/workitems/${selectedWorkItemId}/export-financial-report/?format=xlsx`
          : `/workitems/${selectedWorkItemId}/export-reports/?format=xlsx&start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `workitem_${selectedWorkItemId}_${isFinancial ? 'financial' : 'progress'}_report.xlsx`;
      } else if (selectedGranularity === 'jobitem' && selectedJobItemId) {
        exportEndpoint = isFinancial
          ? `/jobitems/${selectedJobItemId}/export-financial-report/?format=xlsx`
          : `/jobitems/${selectedJobItemId}/export-reports/?format=xlsx&start_date=${startDateParam}&end_date=${endDateParam}`;
        defaultFileName = `jobitem_${selectedJobItemId}_${isFinancial ? 'financial' : 'progress'}_report.xlsx`;
      }

      if (!exportEndpoint) {
        throw new Error(getSelectScopeErrorMessage(selectedGranularity));
      }

      const res = await apiFetch(exportEndpoint, { token });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to generate XLSX export.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export error occurred.');
    } finally {
      setExporting(false);
    }
  };

  // Preset Date Handlers
  const handlePresetDate = (preset) => {
    const today = new Date();
    const iso = (d) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      updateQuery({ start_date: '', end_date: '' });
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      updateQuery({ start_date: iso(start), end_date: iso(end) });
    } else if (preset === 'last_30') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      updateQuery({ start_date: iso(start), end_date: iso(today) });
    } else if (preset === 'ytd') {
      const start = new Date(today.getFullYear(), 0, 1);
      updateQuery({ start_date: iso(start), end_date: iso(today) });
    }
  };

  const displayProjects = useMemo(() => {
    if (reportType === 'financial') {
      return projects.filter(p => p.role === 'owner' || p.role === 'project_manager');
    }
    return projects;
  }, [projects, reportType]);

  const activeProject = useMemo(() => {
    return projects.find(p => String(p.id) === String(selectedProjectId));
  }, [projects, selectedProjectId]);

  const activePlot = useMemo(() => {
    return plots.find(p => String(p.id) === String(selectedPlotId));
  }, [plots, selectedPlotId]);

  const activeWorkItem = useMemo(() => {
    return workItems.find(w => String(w.id) === String(selectedWorkItemId));
  }, [workItems, selectedWorkItemId]);

  const activeJobItem = useMemo(() => {
    return jobItems.find(j => String(j.id) === String(selectedJobItemId));
  }, [jobItems, selectedJobItemId]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(193, 74, 30, 0.12)',
              color: 'var(--brand-orange)',
            }}>
              <FileText size={20} />
            </span>
            <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)', lineHeight: 1.1 }}>
              Reports & Analytics Hub
            </h1>
          </div>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '15px' }}>
            Generate, inspect, and export comprehensive financial summaries and daily site progress reports.
          </p>
        </div>

        {/* Global Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exporting || !selectedProjectId}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(193, 74, 30, 0.25)',
            }}
          >
            {exporting ? (
              <>
                <div style={{
                  width: 14,
                  height: 14,
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }} />
                Generating PDF...
              </>
            ) : (
              <>
                <Download size={16} />
                Export PDF
              </>
            )}
          </button>

          {reportType === 'financial' && (
            <button
              type="button"
              onClick={handleExportXLSX}
              disabled={exporting || !selectedProjectId}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#10b981', // Green for Excel
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: (exporting || !selectedProjectId) ? 'not-allowed' : 'pointer',
                opacity: (exporting || !selectedProjectId) ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              }}
            >
              {exporting ? (
                <>
                  <div style={{
                    width: 14,
                    height: 14,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Generating XLSX...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export XLSX
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: '#fee2e2',
          border: '1px solid #f87171',
          color: '#991b1b',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={18} />
          <span>{exportError}</span>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'var(--bg-card)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
        width: 'fit-content',
      }}>
        <button
          type="button"
          onClick={() => updateQuery({ type: 'financial' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: reportType === 'financial' ? 'var(--brand-orange)' : 'transparent',
            color: reportType === 'financial' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <DollarSign size={16} />
          Financial Report
        </button>

        <button
          type="button"
          onClick={() => updateQuery({ type: 'daily' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: reportType === 'daily' ? 'var(--brand-orange)' : 'transparent',
            color: reportType === 'daily' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <ClipboardList size={16} />
          Daily Progress Reports
        </button>
      </div>

      {/* Scope & Filter Configuration Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="var(--brand-orange)" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Report Scope & Granularity</h3>
          </div>

          {/* Quick presets for date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginRight: '4px' }}>Range:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_30', label: 'Last 30 Days' },
              { id: 'ytd', label: 'Year to Date' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetDate(p.id)}
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-raised)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* 1. Project Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Project <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                updateQuery({
                  project: e.target.value,
                  plot: '',
                  workitem: '',
                  jobitem: '',
                });
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              {displayProjects.length === 0 && <option value="">No projects found</option>}
              {displayProjects.map(p => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>

          {/* 2. Granularity Level */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Granularity Level <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <select
              value={selectedGranularity}
              onChange={(e) => {
                const nextGran = e.target.value;
                const updates = { granularity: nextGran };
                if (nextGran === 'project') {
                  updates.plot = '';
                  updates.workitem = '';
                  updates.jobitem = '';
                } else if (nextGran === 'plot') {
                  updates.workitem = '';
                  updates.jobitem = '';
                  if (!selectedPlotId && plots.length > 0) updates.plot = String(plots[0].id);
                } else if (nextGran === 'workitem') {
                  updates.jobitem = '';
                  if (!selectedPlotId && plots.length > 0) updates.plot = String(plots[0].id);
                } else if (nextGran === 'jobitem') {
                  if (!selectedPlotId && plots.length > 0) updates.plot = String(plots[0].id);
                }
                updateQuery(updates);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              <option value="project">Entire Project (High-level)</option>
              <option value="plot">Plot Level</option>
              <option value="workitem">Work Level</option>
              <option value="jobitem">Job Level (Detailed)</option>
            </select>
          </div>

          {/* 3. Cascading Plot Selector */}
          {selectedGranularity !== 'project' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Plot <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <select
                value={selectedPlotId}
                onChange={(e) => {
                  updateQuery({
                    plot: e.target.value,
                    workitem: '',
                    jobitem: '',
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-raised)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="">Select Plot...</option>
                {plots.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plot_name ? `${p.plot_name} (${p.address})` : p.address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Cascading Work Selector */}
          {(selectedGranularity === 'workitem' || selectedGranularity === 'jobitem') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Work <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <select
                value={selectedWorkItemId}
                onChange={(e) => {
                  updateQuery({
                    workitem: e.target.value,
                    jobitem: '',
                  });
                }}
                disabled={!selectedPlotId}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-raised)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  opacity: !selectedPlotId ? 0.6 : 1,
                }}
              >
                <option value="">Select Work...</option>
                {workItems.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Cascading Job Selector */}
          {selectedGranularity === 'jobitem' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Job <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <select
                value={selectedJobItemId}
                onChange={(e) => updateQuery({ jobitem: e.target.value })}
                disabled={!selectedWorkItemId}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-raised)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  opacity: !selectedWorkItemId ? 0.6 : 1,
                }}
              >
                <option value="">Select Job...</option>
                {jobItems.map(j => (
                  <option key={j.id} value={j.id}>{j.job_name} ({((j.job_artisan === 'Other' && j.custom_artisan) ? j.custom_artisan : j.job_artisan) || 'General'})</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Inputs */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>From Date <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input
              type="date"
              value={startDateParam}
              onChange={(e) => updateQuery({ start_date: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px' }}>To Date <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input
              type="date"
              value={endDateParam}
              onChange={(e) => updateQuery({ end_date: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Active Scope Breadcrumb / Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          background: 'var(--bg-raised)',
          padding: '10px 16px',
          borderRadius: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Active Target:</span>
          <span>{activeProject?.project_name || 'Project'}</span>
          {activePlot && (
            <>
              <ChevronRight size={14} />
              <span>Plot: {activePlot.plot_name || activePlot.address}</span>
            </>
          )}
          {activeWorkItem && (
            <>
              <ChevronRight size={14} />
              <span>Work: {activeWorkItem.name}</span>
            </>
          )}
          {activeJobItem && (
            <>
              <ChevronRight size={14} />
              <span>Job: {activeJobItem.job_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loadingReport && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spinner />
          <p style={{ marginTop: '12px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
            Compiling report data and figures...
          </p>
        </div>
      )}

      {/* Error state */}
      {reportError && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: '#fee2e2',
          border: '1px solid #f87171',
          color: '#991b1b',
        }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>Unable to Load Report</h4>
          <p style={{ margin: 0, fontSize: '14px' }}>{reportError}</p>
        </div>
      )}

      {/* REPORT CONTENT: FINANCIAL */}
      {!loadingReport && !reportError && reportData && reportData.type === 'financial' && reportType === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Allocated Budget
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData.hasBudget ? formatCurrency(reportData.allocated, reportData.currency) : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {reportData.hasBudget ? 'Target cap for target scope' : 'No budget set'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Total Expenditures
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                {formatCurrency(reportData.spent || 0, reportData.currency)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {(reportData.expenses || []).length} itemized expense records
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Remaining Balance
              </span>
              <p style={{
                margin: '8px 0 0',
                fontSize: '24px',
                fontWeight: 700,
                color: reportData.hasBudget && reportData.remaining !== null
                  ? (reportData.remaining < 0 ? '#dc2626' : '#16a34a')
                  : 'var(--text-primary)',
              }}>
                {reportData.hasBudget && reportData.remaining !== null
                  ? formatCurrency(reportData.remaining, reportData.currency)
                  : 'N/A'}
              </p>
              <p style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: reportData.hasBudget && reportData.remaining !== null
                  ? (reportData.remaining < 0 ? '#dc2626' : '#16a34a')
                  : 'var(--text-tertiary)',
              }}>
                {!reportData.hasBudget
                  ? 'No budget allocated'
                  : reportData.remaining < 0
                    ? 'Over budget limit'
                    : 'Under budget'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Budget Utilization
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {reportData.hasBudget && reportData.utilization !== null && reportData.utilization !== undefined ? `${reportData.utilization}%` : 'N/A'}
              </p>
              {reportData.hasBudget && (
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-raised)', overflow: 'hidden', marginTop: '10px' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, reportData.utilization || 0))}%`,
                    background: (reportData.utilization || 0) > 100 ? '#dc2626' : 'var(--brand-orange)',
                    borderRadius: '3px',
                  }} />
                </div>
              )}
            </div>
          </div>

          {/* Child Granular Breakdown Table */}
          {reportData.breakdown && reportData.breakdown.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  {reportData.breakdownType === 'plots' && 'Plots Budget & Spend Breakdown'}
                  {reportData.breakdownType === 'workitems' && 'Works Budget & Spend Breakdown'}
                  {reportData.breakdownType === 'jobitems' && 'Jobs Budget & Spend Breakdown'}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  Comparative allocation and actual expenditure across child components
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Item</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Spent</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.breakdown || []).map((item) => {
                      const itemBudget = item.budget || item.work_item_budget || item.plot_budget || item.job_item_budget;
                      const itemAllocated = parseFloat(itemBudget?.allocated_amount || 0);
                      const itemSpent = parseFloat(item.spent_amount ?? 0);
                      const itemHasBudget = itemAllocated > 0;
                      const itemPercent = itemHasBudget ? Math.round((itemSpent / itemAllocated) * 100) : null;
                      const itemOver = itemHasBudget && itemSpent > itemAllocated;

                      const itemName = item.plot_name
                        ? `${item.plot_name} (${item.address})`
                        : item.address || item.name || item.job_name || 'Child Item';

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {itemName}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', color: itemHasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {itemHasBudget ? formatCurrency(itemAllocated, reportData.currency) : 'N/A'}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600, color: itemOver ? '#dc2626' : 'var(--text-primary)' }}>
                            {formatCurrency(itemSpent, reportData.currency)}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            {itemHasBudget ? (
                              <span style={{ fontWeight: 600, color: itemOver ? '#dc2626' : itemPercent > 80 ? '#d97706' : '#16a34a' }}>
                                {itemPercent}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (reportData.breakdownType === 'plots') {
                                  updateQuery({ granularity: 'plot', plot: String(item.id) });
                                } else if (reportData.breakdownType === 'workitems') {
                                  updateQuery({ granularity: 'workitem', workitem: String(item.id) });
                                } else if (reportData.breakdownType === 'jobitems') {
                                  updateQuery({ granularity: 'jobitem', jobitem: String(item.id) });
                                }
                              }}
                              style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'transparent',
                                border: '1px solid var(--border-default)',
                                color: 'var(--brand-orange)',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Drill down &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itemized Expenses Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Itemized Expenditures</h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Recorded transactions for the selected scope
              </p>
            </div>

            {(reportData.expenses || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No expenses recorded for this target scope.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Date</th>
                      {(selectedGranularity === 'project' || selectedGranularity === 'plot') && <th style={{ padding: '12px 14px' }}>Work Item</th>}
                      {(selectedGranularity === 'project' || selectedGranularity === 'plot' || selectedGranularity === 'workitem') && <th style={{ padding: '12px 14px' }}>Job Item</th>}
                      <th style={{ padding: '12px 14px' }}>Artisan</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.expenses || []).map((exp) => {
                      const workItemName = exp.work_item_name || exp.work_item?.name || exp.job_item?.work_item?.name || '—';
                      const jobItemName = exp.job_item_name || exp.job_item?.job_name || '—';
                      const artisanName = exp.artisan_name || (exp.job_item?.job_artisan === 'Other' && exp.job_item?.custom_artisan ? exp.job_item.custom_artisan : exp.job_item?.job_artisan) || '—';

                      return (
                        <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                            {(exp.incurred_at || exp.created_at || '').slice(0, 10) || '—'}
                          </td>
                          {(selectedGranularity === 'project' || selectedGranularity === 'plot') && (
                            <td style={{ padding: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {workItemName}
                            </td>
                          )}
                          {(selectedGranularity === 'project' || selectedGranularity === 'plot' || selectedGranularity === 'workitem') && (
                            <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {jobItemName}
                            </td>
                          )}
                          <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                            {artisanName}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatCurrency(exp.amount, exp.currency || reportData.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORT CONTENT: DAILY PROGRESS */}
      {!loadingReport && !reportError && reportData && reportData.type === 'daily' && reportType === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Total Reports
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {(reportData.reports || []).length}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Logged daily site updates
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Attached Figures
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '28px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                {(reportData.figures || []).length}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Photographic progress evidence
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Avg Progress %
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>
                {(reportData.reports || []).length > 0
                  ? `${Math.round((reportData.reports || []).reduce((acc, r) => acc + (r.percentage_job_progress || 0), 0) / reportData.reports.length)}%`
                  : '0%'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Across logged tasks
              </p>
            </div>
          </div>

          {/* Daily Reports Log Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Site Progress Report Logs</h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Detailed activity notes, status, and linked image figures
              </p>
            </div>

            {(reportData.reports || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No daily reports logged for the selected scope/range.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Date</th>
                      <th style={{ padding: '12px 14px' }}>Job</th>
                      <th style={{ padding: '12px 14px' }}>% Compl</th>
                      <th style={{ padding: '12px 14px' }}>Notes</th>
                      <th style={{ padding: '12px 14px' }}>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.reports || []).map((report) => (
                      <tr key={report.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {report.report_date}
                        </td>
                        <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {report.job_item_name || report.job_item?.job_name || 'Job'}
                        </td>
                        <td style={{ padding: '14px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                          {report.percentage_job_progress}%
                        </td>
                        <td style={{ padding: '14px', color: 'var(--text-secondary)', maxWidth: '340px' }}>
                          <div>{report.notes || '—'}</div>
                          {report.video_link && (
                            <div style={{ marginTop: '8px' }}>
                              <a href={report.video_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--brand-orange)', textDecoration: 'none', fontWeight: 600 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                View Video
                              </a>
                            </div>
                          )}
                          {report.figRefs && report.figRefs.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Evidence:</span>
                              {report.figRefs.map((ref) => (
                                <span
                                  key={ref}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '1px 7px',
                                    borderRadius: '9999px',
                                    background: 'rgba(193, 74, 30, 0.14)',
                                    color: 'var(--brand-orange)',
                                    border: '1px solid rgba(193, 74, 30, 0.25)',
                                  }}
                                >
                                  <ImageIcon size={10} />
                                  {ref}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px', color: report.issues_encountered ? '#dc2626' : 'var(--text-tertiary)' }}>
                          {report.issues_encountered || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attached Photographic Figures Table */}
          {reportData.figures && reportData.figures.length > 0 && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={18} color="var(--brand-orange)" />
                    Attached Photographic Figures Table
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    All photo documentation cross-referenced (Fig. 1, Fig. 2...) in the report logs above
                  </p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {(reportData.figures || []).length} {(reportData.figures || []).length === 1 ? 'Figure' : 'Figures'}
                </span>
              </div>

              {/* Compact Responsive Photo Grid Table */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '16px',
              }}>
                {(reportData.figures || []).map((fig) => {
                  const rawUrl = fig.pic?.image || fig.pic?.img || fig.pic?.url;
                  const fullUrl = getMediaUrl(rawUrl);

                  return (
                    <div
                      key={fig.figNum}
                      onClick={() => setLightboxImage({ ...fig, fullUrl })}
                      style={{
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', height: '140px', background: '#e5e7eb' }}>
                        {fullUrl ? (
                          <img
                            src={fullUrl}
                            alt={fig.caption}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <ImageIcon size={32} color="var(--text-tertiary)" />
                          </div>
                        )}
                        <span style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(0,0,0,0.75)',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backdropFilter: 'blur(4px)',
                        }}>
                          {fig.figLabel}
                        </span>
                      </div>

                      <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          <strong>{fig.figLabel}</strong>: {fig.caption}
                        </p>
                        {fig.description && fig.description !== fig.caption && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {fig.description}
                          </p>
                        )}
                        <span style={{ marginTop: 'auto', fontSize: '11px', color: 'var(--text-tertiary)', paddingTop: '6px' }}>
                          By: {fig.reportedBy || 'Artisan / Foreman'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty / Unselected Scope Prompt */}
      {!loadingReport && !reportError && !reportData && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-default)',
          borderRadius: '20px',
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
            Please select a plot, work item, or job item from the filters above to compile the {reportType === 'financial' ? 'financial' : 'daily progress'} report.
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '20px',
              maxWidth: '720px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxHeight: '480px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={lightboxImage.fullUrl}
                alt={lightboxImage.caption}
                style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain' }}
              />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{
                  background: 'rgba(193, 74, 30, 0.15)',
                  color: 'var(--brand-orange)',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  {lightboxImage.figLabel}
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  {lightboxImage.caption}
                </h3>
              </div>
              {lightboxImage.description && (
                <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {lightboxImage.description}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <span>Report Date: {lightboxImage.date}</span>
                <span>Reported by: {lightboxImage.reportedBy}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
