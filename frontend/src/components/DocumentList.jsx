import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Plus, Trash2, UploadCloud, Upload, X } from 'lucide-react';
import { apiFetch, unwrapList, formatApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './index';
import { showSuccessMessage } from '../utils/successMessage';

const FormOverlay = ({ children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)' };
const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

const UploadDocumentModal = ({ projectId, plotId, token, onSuccess, onClose }) => {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [visibleToForemen, setVisibleToForemen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    if (!name.trim()) {
      setError('Document display name is required.');
      return;
    }
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (plotId) formData.append('plot', plotId);
    formData.append('visible_to_foremen', visibleToForemen);

    try {
      const res = await apiFetch(`/projects/${projectId}/documents/`, {
        method: 'POST',
        token,
        body: formData,
      });

      if (res.ok) {
        showSuccessMessage('Document added successfully ✅');
        onSuccess();
        onClose();
      } else {
        const d = await res.json().catch(() => ({ detail: 'Upload failed' }));
        setError(formatApiError(d, 'Upload failed'));
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '36px', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <h2 style={{ fontSize: '26px', margin: 0 }}>Add Document</h2>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={20} />
        </button>
      </div>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '28px', fontSize: '14px' }}>Select a document file to attach to this {plotId ? 'plot' : 'project'}.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>File <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-default)',
                borderRadius: '16px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg-raised)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-orange)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            >
              <UploadCloud size={36} color="var(--brand-orange)" style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Click to select a document</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>PDF, DOCX, XLSX, images, or any file</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '16px 18px',
              background: 'var(--bg-raised)',
              borderRadius: '14px',
              border: '1px solid var(--brand-orange)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ background: 'rgba(239, 108, 0, 0.1)', color: 'var(--brand-orange)', padding: '10px', borderRadius: '10px', flexShrink: 0 }}>
                  <FileText size={24} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Remove selected file"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Document Name <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter a display name"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input
              type="checkbox"
              checked={visibleToForemen}
              onChange={e => setVisibleToForemen(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Visible to Foremen</span> <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
        </div>

        <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', marginTop: '8px' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button
            type="submit"
            disabled={uploading || !file || !name.trim()}
            className="btn-primary"
            style={{ flex: 2, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {uploading ? <Spinner size={16} /> : <Upload size={15} />}
            <span>{uploading ? 'Uploading...' : 'Upload'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const DocumentList = ({ projectId, plotId, role }) => {
  const { token, user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canManage = ['owner', 'project_manager', 'consultant'].includes(role);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const url = plotId ? `/projects/${projectId}/documents/?plot_id=${plotId}` : `/projects/${projectId}/documents/`;
      const res = await apiFetch(url, { token });
      if (res.ok) {
        setDocuments(unwrapList(await res.json()));
      }
    } catch (e) {
      console.error('Error fetching documents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [projectId, plotId]);

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(docId);
    try {
      const res = await apiFetch(`/projects/${projectId}/documents/${docId}/`, {
        method: 'DELETE',
        token,
      });
      if (res.ok) {
        showSuccessMessage('Document deleted');
        setDocuments(docs => docs.filter(d => d.id !== docId));
      } else {
        const data = await res.json().catch(() => null);
        alert(formatApiError(data, 'Error deleting document'));
      }
    } catch (e) {
      alert('Connection error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '20px', margin: 0 }}>Documents ({documents.length})</h2>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={15} /> Add Document
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
          <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>No documents available</p>
          <p style={{ fontSize: '14px' }}>Documents uploaded to this {plotId ? 'plot' : 'project'} will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ background: 'rgba(239, 108, 0, 0.1)', color: 'var(--brand-orange)', padding: '12px', borderRadius: '12px' }}>
                  <FileText size={24} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name || doc.file.split('/').pop()}>
                    {doc.name || doc.file.split('/').pop()}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    Uploaded by: {doc.uploaded_by?.display_name || doc.uploaded_by?.username || doc.uploaded_by_display_name || doc.uploaded_by_details?.display_name || doc.uploaded_by_details?.username || 'Unknown'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a href={doc.file} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '10px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                  <Download size={14} /> Download
                </a>

                {/* Show delete button only if current user is the uploader */}
                {Boolean(user?.id && (user.id === doc.uploaded_by?.id || user.id === doc.uploaded_by)) && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', background: 'transparent', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '10px', color: '#dc2626', cursor: deletingId === doc.id ? 'not-allowed' : 'pointer' }}
                    title="Delete document"
                  >
                    {deletingId === doc.id ? <Spinner /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <FormOverlay onClose={() => setShowModal(false)}>
          <UploadDocumentModal
            projectId={projectId}
            plotId={plotId}
            token={token}
            onSuccess={fetchDocuments}
            onClose={() => setShowModal(false)}
          />
        </FormOverlay>
      )}
    </div>
  );
};
