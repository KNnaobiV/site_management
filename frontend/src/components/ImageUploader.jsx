import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

/**
 * ImageUploader — drag-and-drop or click to select images.
 * @param {File[]} files - controlled file list
 * @param {function} onChange - (files: File[]) => void
 * @param {number} max - max number of images (default 10)
 * @param {string} label - optional label text
 */
const ImageUploader = ({ files = [], onChange, max = 10, label = 'Photos' }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    const merged = [...files, ...valid].slice(0, max);
    onChange(merged);
  };

  const removeFile = (index) => {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const previews = files.map(f => URL.createObjectURL(f));

  return (
    <div>
      {label && (
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: files.length ? '10px' : 0 }}>
        {files.map((file, i) => (
          <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <img src={previews[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => removeFile(i)}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                background: 'rgba(0,0,0,0.65)', border: 'none',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0
              }}
            >
              <X size={11} color="#fff" />
            </button>
          </div>
        ))}

        {files.length < max && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              width: '80px', height: '80px',
              borderRadius: '10px',
              border: `2px dashed ${dragging ? 'var(--brand-orange)' : 'var(--border-default)'}`,
              background: dragging ? 'var(--brand-orange-subtle)' : 'var(--bg-raised)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', gap: '4px', transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            <ImageIcon size={18} color={dragging ? 'var(--brand-orange)' : 'var(--text-tertiary)'} />
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {files.length === 0 ? 'Add photo' : '+'}
            </span>
          </div>
        )}
      </div>

      {files.length < max && (
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
          {files.length}/{max} photos — drag and drop or click to select
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default ImageUploader;
