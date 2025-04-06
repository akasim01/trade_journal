import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { LayoutDashboard, BarChart2, BookOpen, Briefcase, Settings, PanelLeftClose, PanelLeft, LogOut, Import as FileImport, Bot, LineChart, Lightbulb } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Plans', href: '/plans', icon: LineChart },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'ML Insights', href: '/insights', icon: Lightbulb },
  { name: 'AI Assistant', href: '/ai', icon: Bot },
  { name: 'Reports', href: '/reports', icon: Briefcase },
  { name: 'Import Trades', href: '/import', icon: FileImport },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  user: User;
}

export default function Sidebar({ isCollapsed, onToggle, user }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState<string>('');
  const [showDropdown, setShowDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetchUsername();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsername = async () => {
    try {
      const { data, error } = await supabase
        .from('usernames')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setUsername(data.username);
      } else {
        const fallbackName = user.email?.split('@')[0] || 'User';
        setUsername(fallbackName);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      const fallbackName = user.email?.split('@')[0] || 'User';
      setUsername(fallbackName);
    }
  };

  const handleSignOut = async () => {
    try {
      // First clear any local session data
      localStorage.removeItem('supabase.auth.token');
      
      // Attempt to sign out from Supabase
      await supabase.auth.signOut().catch(error => {
        console.warn('Error during remote sign out:', error);
        // Continue with navigation even if remote sign out fails
      });
      
      // Always navigate to login page
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      // Navigate to login page even if there's an error
      navigate('/login');
    }
  };

  const getInitials = () => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <div className={cn(
      "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
      isCollapsed ? "lg:w-20" : "lg:w-72"
    )}>
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-2xl font-bold text-blue-600">Trading Journal</h1>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5 text-gray-500" />
            ) : (
              <PanelLeftClose className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={cn(
                          'group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold',
                          isActive
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                        )}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <item.icon
                          className={cn(
                            'h-6 w-6 shrink-0',
                            isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600'
                          )}
                          aria-hidden="true"
                        />
                        {!isCollapsed && item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
            <li className="mt-auto">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={cn(
                    "flex items-center w-full gap-x-3 p-2 text-sm rounded-lg hover:bg-gray-100 transition-colors",
                    isCollapsed ? "justify-center" : "justify-start"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold",
                    isCollapsed ? "w-10 h-10" : "w-8 h-8"
                  )}>
                    {getInitials()}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{username}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  )}
                </button>

                {showDropdown && (
                  <div className={cn(
                    "absolute z-50 min-w-[12rem] rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5",
                    isCollapsed 
                      ? "-right-3 top-0 translate-x-full ml-2" 
                      : "left-0 bottom-full mb-2"
                  )}>
                    <div className="py-1">
                      {isCollapsed && (
                        <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                          <p className="font-medium">{username}</p>
                          <p className="text-gray-500 text-xs truncate">{user.email}</p>
                        </div>
                      )}
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}