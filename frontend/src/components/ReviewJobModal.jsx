import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import Modal from './Modal';

const ReviewJobModal = ({ isOpen, onClose, onReview, itemType, itemName }) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = async (actionType) => {
    setIsSubmitting(true);
    await onReview(actionType, message);
    setIsSubmitting(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={!isSubmitting ? onClose : undefined} title={`Review ${itemType}`}>
      <div style={{ padding: '24px' }}>
        <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
          You are reviewing the {itemType.toLowerCase()}: <strong style={{ color: 'var(--text-primary)' }}>{itemName}</strong>
        </p>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Message for the creator <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>(Optional)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <MessageSquare size={16} color="var(--text-tertiary)" style={{ position: 'absolute', top: '12px', left: '12px' }} />
            <textarea
              className="input-field"
              placeholder={`Provide feedback on why this ${itemType.toLowerCase()} is approved or rejected...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', minHeight: '100px', paddingLeft: '36px', resize: 'vertical' }}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            className="btn-ghost" 
            onClick={() => handleAction('reject')}
            disabled={isSubmitting}
            style={{ color: '#dc2626', borderColor: '#dc2626' }}
          >
            <XCircle size={16} /> Reject
          </button>
          
          <button 
            className="btn-primary" 
            onClick={() => handleAction('approve')}
            disabled={isSubmitting}
            style={{ background: '#2d5a27', borderColor: '#2d5a27' }}
          >
            <CheckCircle2 size={16} /> Approve
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReviewJobModal;
