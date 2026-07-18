import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StatCard, ProjectCard, NotificationItem, Spinner } from '../components';
import { apiFetch, unwrapList } from '../api/client';
import { LayoutDashboard, TrendingUp, AlertCircle, Clock } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [stats, setStats] = useState({
    activeProjects: 0
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, nRes] = await Promise.all([
          apiFetch("/projects/", { token }),
          apiFetch("/notifications/", { token })
        ]);

        if (pRes.ok) {
          const projects = unwrapList(await pRes.json());
          setRecentProjects(projects.slice(0, 3));
          setStats(prev => ({ ...prev, activeProjects: projects.filter(p => p.project_status === 'In Progress').length }));
        }

        if (nRes.ok) {
          setNotifications(unwrapList(await nRes.json()).slice(0, 4));
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) return <Spinner />;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Welcome back, {user?.display_name || user?.username}</h1>
        <p style={{ fontSize: '18px', color: 'var(--text-tertiary)' }}>Here's what's happening across your sites today.</p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '48px' }}>
        <StatCard label="Active Projects" value={stats.activeProjects} sub="+1 since last week" />
      </div>

      <div className="mobile-stack" style={{ display: 'flex', gap: '40px' }}>
        {/* Recent Projects */}
        <div style={{ flex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '24px' }}>Recent Projects</h3>
            <button className="btn-ghost" style={{ fontSize: '14px' }}>View all</button>
          </div>
          <div style={{ display: 'grid', gap: '24px' }}>
            {recentProjects.map(p => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                onClick={() => navigate(`/projects/${p.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '24px', marginBottom: '24px' }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {notifications.length > 0 ? (
              notifications.map(n => (
                <NotificationItem key={n.id} notification={n} />
              ))
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;