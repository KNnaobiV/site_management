import { useState, useEffect, useCallback } from 'react';
import Avatar from './Avatar';
import { Send, MessageCircle, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

/**
 * CommentsSection - Display and manage comments on job reports with reply support
 * @param {string} reportId - The ID of the report
 * @param {string} projectId - The ID of the project
 * @param {string} plotId - The ID of the plot
 * @param {string} workitemId - The ID of the work item
 * @param {string} jobitemId - The ID of the job item
 */
export default function CommentsSection({
  reportId,
  projectId,
  plotId,
  workitemId,
  jobitemId,
}) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});

  // Build the API URL for comments
  const commentsUrl = `/projects/${projectId}/plots/${plotId}/workitems/${workitemId}/jobitems/${jobitemId}/reports/${reportId}/comments/`;

  const fetchComments = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const res = await apiFetch(commentsUrl, { token });
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching comments', e);
    } finally {
      setLoading(false);
    }
  }, [commentsUrl, reportId, token]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch(commentsUrl, {
        method: 'POST',
        token,
        body: JSON.stringify({
          text: newComment,
          parent: null,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to post comment: ${res.status} ${errorText}`);
      }
      const comment = await res.json();
      setComments([...comments, comment]);
      setNewComment('');
    } catch (e) {
      console.error('Error posting comment', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (e, parentCommentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch(commentsUrl, {
        method: 'POST',
        token,
        body: JSON.stringify({
          text: replyText,
          parent: parentCommentId,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to post reply: ${res.status} ${errorText}`);
      }
      fetchComments();
      setReplyingTo(null);
      setReplyText('');
    } catch (e) {
      console.error('Error posting reply', e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString();
  };

  const renderComment = (comment, depth = 0) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies[comment.id];

    return (
      <div
        key={comment.id}
        style={{
          marginLeft: depth > 0 ? '16px' : '0',
          borderLeft: depth > 0 ? '2px solid var(--border-subtle)' : 'none',
          paddingLeft: depth > 0 ? '16px' : '0',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            background: depth > 0 ? 'transparent' : 'var(--bg-canvas)',
            padding: depth > 0 ? '0' : '16px',
            borderRadius: depth > 0 ? '0' : '12px',
            marginBottom: depth > 0 ? '12px' : '0',
          }}
        >
          <Avatar
            name={comment.user.display_name || comment.user.username}
            size={36}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                }}
              >
                {comment.user.display_name || comment.user.username}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                }}
              >
                {formatDate(comment.created_at)}
              </span>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {comment.text}
            </p>
            <button
              onClick={() => {
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyText('');
              }}
              style={{
                marginTop: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--brand-orange)',
                fontSize: '13px',
                fontWeight: 600,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <MessageCircle size={14} /> Reply
            </button>

            {/* Reply Form */}
            {replyingTo === comment.id && (
              <form
                onSubmit={(e) => handleSubmitReply(e, comment.id)}
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Avatar
                  name={user?.display_name || user?.username || 'User'}
                  size={32}
                />
                <div style={{ flex: 1, position: 'relative' }}>
                  <textarea
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-raised)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-sans)',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '36px',
                      maxHeight: '100px',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || submitting}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      bottom: '6px',
                      background: replyText.trim() ? 'var(--brand-orange)' : 'var(--border-strong)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                      transition: 'background 0.2s',
                    }}
                  >
                    {submitting ? (
                      <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Replies */}
            {hasReplies && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() =>
                    setExpandedReplies({
                      ...expandedReplies,
                      [comment.id]: !isExpanded,
                    })
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    fontSize: '13px',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={14} /> Hide {comment.replies.length} reply
                      {comment.replies.length !== 1 ? 'ies' : ''}
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Show {comment.replies.length} reply
                      {comment.replies.length !== 1 ? 'ies' : ''}
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {comment.replies.map((reply) =>
                      renderComment(reply, depth + 1)
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Get root-level comments only
  const rootComments = comments.filter((c) => !c.parent);

  if (loading) {
    return (
      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: '32px' }}>
      <h3
        style={{
          fontSize: '20px',
          marginBottom: '16px',
          fontFamily: 'var(--font-serif)',
        }}
      >
        Comments
      </h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {rootComments.length === 0 ? (
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '14px',
              fontStyle: 'italic',
            }}
          >
            No comments yet. Be the first to start the discussion.
          </p>
        ) : (
          rootComments.map((comment) => renderComment(comment))
        )}
      </div>

      <form onSubmit={handleSubmitComment} style={{ display: 'flex', gap: '12px' }}>
        <Avatar
          name={user?.display_name || user?.username || 'User'}
          size={40}
        />
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 48px 12px 16px',
              borderRadius: '16px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-raised)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              resize: 'vertical',
              minHeight: '40px',
              maxHeight: '120px',
            }}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            style={{
              position: 'absolute',
              right: '8px',
              bottom: '8px',
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
              transition: 'background 0.2s',
            }}
          >
            {submitting ? (
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
