import { Search, Plus, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AnimatedAvatar } from './AnimatedAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function TopNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-16 items-center px-6 gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg"></div>
          <span className="font-semibold">Dashboard</span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#" className="text-gray-900 hover:text-gray-600 transition-colors">
            Overview
          </a>
          <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
            Projects
          </a>
          <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
            Analytics
          </a>
          <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
            Team
          </a>
        </div>

        {/* Search Field */}
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="search"
              placeholder="Search projects..."
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* New Project Button */}
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          New Project
        </Button>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
            <AnimatedAvatar
              src="https://images.unsplash.com/photo-1758518727984-17b37f2f0562?w=100&h=100&fit=crop"
              fallback="JD"
              progress={85}
              animationType="glow"
              className="w-9 h-9"
              size={36}
            />
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Team</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
