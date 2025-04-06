import React from 'react';
import { User } from '@supabase/supabase-js';

interface HeaderProps {
  user: User;
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-white shadow-sm">
    </header>
  );
}