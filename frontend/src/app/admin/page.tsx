'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalMarkets: number;
  totalVolume: number;
}

interface ChartData {
  name: string;
  users: number;
  volume: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalMarkets: 0,
    totalVolume: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data from Firebase Firestore
    const fetchData = async () => {
      try {
        // In production, import and use Firebase Admin SDK or client SDK
        // For now, using mock data - replace with actual Firestore queries
        
        // Example Firestore query structure:
        // const usersSnapshot = await getDocs(collection(db, 'users'));
        // const marketsSnapshot = await getDocs(collection(db, 'markets'));
        
        setStats({
          totalUsers: 1250,
          activeUsers: 342,
          totalMarkets: 48,
          totalVolume: 2500000,
        });
        setChartData([
          { name: 'Mon', users: 120, volume: 45000 },
          { name: 'Tue', users: 145, volume: 52000 },
          { name: 'Wed', users: 132, volume: 48000 },
          { name: 'Thu', users: 168, volume: 61000 },
          { name: 'Fri', users: 195, volume: 75000 },
          { name: 'Sat', users: 210, volume: 82000 },
          { name: 'Sun', users: 188, volume: 69000 },
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers.toLocaleString()} 
          icon={Users} 
          color="bg-blue-500"
        />
        <StatCard 
          title="Active Users" 
          value={stats.activeUsers.toLocaleString()} 
          icon={Activity} 
          color="bg-green-500"
        />
        <StatCard 
          title="Total Markets" 
          value={stats.totalMarkets.toString()} 
          icon={TrendingUp} 
          color="bg-purple-500"
        />
        <StatCard 
          title="Total Volume" 
          value={`$${(stats.totalVolume / 1000000).toFixed(2)}M`} 
          icon={DollarSign} 
          color="bg-indigo-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Users</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="users" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trading Volume</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="volume" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-full`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </div>
  );
}
