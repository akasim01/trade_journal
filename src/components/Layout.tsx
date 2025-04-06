import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import { cn } from '../utils/cn';

interface LayoutProps {
  user: User;
  children: React.ReactNode;
}

export default function Layout({ user, children }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        user={user}
      />
      <div className={cn(
        "transition-all duration-300",
        isSidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
      )}>
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}