import React, { useState } from 'react';
import Avatar from './Avatar';
import { Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CommentsSection({ itemId, itemType }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj = {
      id: Date.now(),
      text: newComment,
      author: user?.display_name || user?.username || 'User',
      timestamp: new Date().toISOString(),
    };

    setComments([...comments, commentObj]);
    setNewComment("");
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ marginTop: '32px' }}>
      <h3 style={{ fontSize: '20px', marginBottom: '16px', fontFamily: 'var(--font-serif)' }}>Comments</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {comments.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', fontStyle: 'italic' }}>No comments yet. Be the first to start the discussion.</p>
        ) : (
          comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '12px', background: 'var(--bg-canvas)', padding: '16px', borderRadius: '12px' }}>
              <Avatar name={c.author} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{c.author}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatDate(c.timestamp)}</span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {c.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
        <Avatar name={user?.display_name || user?.username || 'User'} size={40} />
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 48px 12px 16px',
              borderRadius: '24px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-raised)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: newComment.trim() ? 'var(--brand-orange)' : 'var(--border-strong)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
