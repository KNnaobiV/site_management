import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import Avatar from './Avatar';

const SearchableSelect = ({ options, value, onChange, onSearch, placeholder, label, required, disabled, isMulti }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const selectedOption = !isMulti ? options.find(opt => String(opt.id) === String(value)) : null;
  const selectedOptions = isMulti ? options.filter(opt => (value || []).map(String).includes(String(opt.id))) : [];

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
      {label && <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>{label} {required && ""} <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid var(--border-default)",
          background: disabled ? "var(--bg-raised)" : "var(--bg-raised)",
          color: (isMulti ? selectedOptions.length > 0 : value) ? "var(--text-primary)" : "var(--text-tertiary)",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          transition: 'opacity 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
          {!isMulti && selectedOption && (selectedOption.avatar || selectedOption.image) && (
            <Avatar src={selectedOption.avatar || selectedOption.image} name={selectedOption.label} size={24} />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isMulti 
              ? (selectedOptions.length > 0 ? selectedOptions.map(o => o.label).join(', ') : placeholder)
              : (selectedOption ? selectedOption.label : placeholder)}
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
              filteredOptions.map(opt => {
                const isSelected = isMulti 
                  ? (Array.isArray(value) ? value.map(String).includes(String(opt.id)) : false)
                  : String(value) === String(opt.id);

                return (
                  <div
                    key={opt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMulti) {
                        const currentValues = Array.isArray(value) ? value : [];
                        const valStr = String(opt.id);
                        if (isSelected) {
                          onChange(currentValues.filter(v => String(v) !== valStr));
                        } else {
                          onChange([...currentValues, opt.id]);
                        }
                      } else {
                        onChange(opt.id);
                        setIsOpen(false);
                        setSearch("");
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                      transition: 'background 0.2s',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.08)' : 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {(opt.avatar || opt.image) && (
                        <Avatar src={opt.avatar || opt.image} name={opt.label} size={24} />
                      )}
                      {opt.label}
                    </div>
                    {isSelected && isMulti && <Check size={16} color="var(--brand-orange)" />}
                  </div>
                );
              })
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
