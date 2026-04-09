import React from 'react';
import { Dashboard } from '../components/Dashboard';

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          量子密钥分发实时监控仪表盘
        </h1>
        <Dashboard />
      </div>
    </div>
  );
};

export default DashboardPage;