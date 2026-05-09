import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  return (
    <div className="fade-up">
      <h1>Dashboard</h1>
      <p>Welcome back, {user?.display_name || user?.username}</p>
      <div className="card mt-4">
        <h3>Overview</h3>
        <p>This is the new refactored dashboard overview.</p>
      </div>
    </div>
  );
};

export default Dashboard;