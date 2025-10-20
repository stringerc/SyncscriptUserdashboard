import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';

const summaryData = [
  {
    title: 'Active Projects',
    value: '12',
    icon: CheckCircle2,
    color: 'bg-blue-500',
    progress: 75,
    description: '9 of 12 on track',
  },
  {
    title: 'Pending Tasks',
    value: '48',
    icon: Clock,
    color: 'bg-orange-500',
    progress: 60,
    description: '28 due this week',
  },
  {
    title: 'Issues',
    value: '8',
    icon: AlertCircle,
    color: 'bg-red-500',
    progress: 35,
    description: '3 critical',
  },
  {
    title: 'Team Members',
    value: '24',
    icon: Users,
    color: 'bg-green-500',
    progress: 90,
    description: '22 active today',
  },
];

export function SummaryCards() {
  return (
    <div>
      <h2 className="text-gray-900 mb-4">Project Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryData.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-gray-600 mb-2">{item.title}</p>
                  <p className="text-gray-900">{item.value}</p>
                </div>
                <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <Progress value={item.progress} className="h-2 mb-2" />
              <p className="text-gray-500">{item.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
