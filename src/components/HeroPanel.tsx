import { TrendingUp, Users, Target, Award } from 'lucide-react';
import { Card } from './ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const performanceData = [
  { month: 'Jan', value: 4000, target: 3800 },
  { month: 'Feb', value: 3000, target: 3200 },
  { month: 'Mar', value: 5000, target: 4500 },
  { month: 'Apr', value: 4500, target: 4800 },
  { month: 'May', value: 6000, target: 5500 },
  { month: 'Jun', value: 7500, target: 6800 },
];

const activityData = [
  { day: 'Mon', active: 120 },
  { day: 'Tue', active: 150 },
  { day: 'Wed', active: 180 },
  { day: 'Thu', active: 140 },
  { day: 'Fri', active: 200 },
  { day: 'Sat', active: 90 },
  { day: 'Sun', active: 70 },
];

export function HeroPanel() {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-gray-900 mb-2">Welcome back, John!</h1>
        <p className="text-gray-600">Here's what's happening with your projects today.</p>
      </div>

      {/* Achievement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 mb-1">Total Revenue</p>
              <p className="text-gray-900 mb-1">$45,231</p>
              <p className="text-green-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>+20.1%</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 mb-1">Active Users</p>
              <p className="text-gray-900 mb-1">2,450</p>
              <p className="text-green-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>+12.5%</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 mb-1">Completion Rate</p>
              <p className="text-gray-900 mb-1">87.5%</p>
              <p className="text-green-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>+5.2%</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 mb-1">Achievements</p>
              <p className="text-gray-900 mb-1">24</p>
              <p className="text-green-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>+3 this week</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-gray-900 mb-6">Performance Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorValue)"
                name="Actual"
              />
              <Line 
                type="monotone" 
                dataKey="target" 
                stroke="#9ca3af" 
                strokeDasharray="5 5"
                name="Target"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-gray-900 mb-6">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="active" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Active Users" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
