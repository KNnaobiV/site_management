import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import Avatar from './Avatar';

const SearchableSelect = ({ options, value, onChange, onSearch, placeholder, label, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.id) === String(value));

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>{label} {required && "*"}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid var(--border-default)",
          background: "var(--bg-raised)",
          color: value ? "var(--text-primary)" : "var(--text-tertiary)",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
          {selectedOption && (selectedOption.avatar || selectedOption.image) && (
            <Avatar src={selectedOption.avatar || selectedOption.image} name={selectedOption.label} size={24} />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 1100,
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="var(--text-tertiary)" />
            <input 
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                width: '100%',
                outline: 'none',
                fontSize: '15px'
              }}
            />
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div 
                  key={opt.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: String(value) === String(opt.id) ? 'rgba(255,255,255,0.08)' : 'transparent',
                    transition: 'background 0.2s',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = String(value) === String(opt.id) ? 'rgba(255,255,255,0.08)' : 'transparent'}
                >
                  {(opt.avatar || opt.image) && (
                    <Avatar src={opt.avatar || opt.image} name={opt.label} size={24} />
                  )}
                  {opt.label}
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', color: 'var(--text-tertiary)', textAlign: 'center', fontSize: '14px' }}>No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
