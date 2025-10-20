import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card } from './ui/card';
import { MoreHorizontal, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const entries = [
  {
    id: 'PRJ-001',
    name: 'Website Redesign',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Sarah Johnson',
    dueDate: 'Oct 25, 2025',
    progress: 75,
  },
  {
    id: 'PRJ-002',
    name: 'Mobile App Development',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Michael Chen',
    dueDate: 'Nov 15, 2025',
    progress: 45,
  },
  {
    id: 'PRJ-003',
    name: 'Marketing Campaign',
    status: 'Completed',
    priority: 'Medium',
    assignee: 'Emily Davis',
    dueDate: 'Oct 18, 2025',
    progress: 100,
  },
  {
    id: 'PRJ-004',
    name: 'Database Migration',
    status: 'In Progress',
    priority: 'Critical',
    assignee: 'David Wilson',
    dueDate: 'Oct 22, 2025',
    progress: 60,
  },
  {
    id: 'PRJ-005',
    name: 'API Integration',
    status: 'Pending',
    priority: 'Medium',
    assignee: 'Lisa Anderson',
    dueDate: 'Nov 5, 2025',
    progress: 20,
  },
  {
    id: 'PRJ-006',
    name: 'Security Audit',
    status: 'In Progress',
    priority: 'High',
    assignee: 'James Brown',
    dueDate: 'Oct 30, 2025',
    progress: 35,
  },
  {
    id: 'PRJ-007',
    name: 'Content Creation',
    status: 'Completed',
    priority: 'Low',
    assignee: 'Amanda White',
    dueDate: 'Oct 15, 2025',
    progress: 100,
  },
  {
    id: 'PRJ-008',
    name: 'User Testing',
    status: 'Pending',
    priority: 'Medium',
    assignee: 'Robert Taylor',
    dueDate: 'Nov 10, 2025',
    progress: 10,
  },
];

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string }> = {
    'In Progress': { variant: 'default', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
    'Completed': { variant: 'secondary', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
    'Pending': { variant: 'outline', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  };
  
  const config = variants[status] || variants['Pending'];
  return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
};

const getPriorityBadge = (priority: string) => {
  const variants: Record<string, string> = {
    'Critical': 'bg-red-100 text-red-700',
    'High': 'bg-orange-100 text-orange-700',
    'Medium': 'bg-yellow-100 text-yellow-700',
    'Low': 'bg-gray-100 text-gray-700',
  };
  
  return <Badge variant="outline" className={variants[priority] || variants['Low']}>{priority}</Badge>;
};

export function EntriesTable() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-900">Recent Projects</h2>
        <Button variant="outline">View All</Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" className="h-8 px-2">
                  ID
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" className="h-8 px-2">
                  Project Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.id}</TableCell>
                <TableCell>{entry.name}</TableCell>
                <TableCell>{getStatusBadge(entry.status)}</TableCell>
                <TableCell>{getPriorityBadge(entry.priority)}</TableCell>
                <TableCell>{entry.assignee}</TableCell>
                <TableCell>{entry.dueDate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                    <span className="text-gray-600">{entry.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Project</DropdownMenuItem>
                      <DropdownMenuItem>Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
