import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginRegister from './LoginRegister';
import Dashboard from './Dashboard';
import SearchHistory from './SearchHistory';
import BriefingDashboard from './BriefingDashboard';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';

const App: React.FC = () => {
  const [dark, setDark] = useState(() => {
    // Check for saved preference or default to light mode
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (dark) {
      root.classList.add('dark');
      console.log('Dark mode enabled');
    } else {
      root.classList.remove('dark');
      console.log('Light mode enabled');
    }
    // Save preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(dark));
  }, [dark]);

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginRegister />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute>
              <Layout>
                <SearchHistory />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/briefing" element={
            <ProtectedRoute>
              <Layout>
                <BriefingDashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </>
  );
};

export default App; 