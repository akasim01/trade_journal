import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { AlertTriangle, UserX, RefreshCw, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '../utils/format';

interface AdminPanelProps {
  user: User;
}

interface UserDetails {
  user_id: string;
  email: string;
  username: string;
  created_at: string;
  last_sign_in_at: string;
  trade_count: number;
  total_pnl: number;
}

interface UserStats {
  user: {
    id: string;
    email: string;
    username: string;
    created_at: string;
    last_sign_in_at: string;
  };
  stats: {
    trade_count: number;
    total_pnl: number;
    strategy_count: number;
    plan_count: number;
  };
  settings: {
    timezone: string;
    currency: string;
    default_commission: number;
  };
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserDetails | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [page, isAdmin]);

  const checkAdminStatus = async () => {
    try {
      // First refresh the session to get latest metadata
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      
      const isUserAdmin = session?.user?.app_metadata?.role === 'admin';
      setIsAdmin(isUserAdmin);
      
      if (!isUserAdmin) {
        setError('Access denied. Admin privileges required.');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setError('Failed to verify admin status');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        'admin_get_users',
        { 
          page_size: pageSize,
          page_number: page
        }
      );

      if (error) throw error;

      setUsers(data || []);
      
      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalUsers(count || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        'admin_get_user_details',
        { target_user_id: userId }
      );

      if (error) throw error;
      setSelectedUser(data);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setDeleting(true);
      setError(null);

      const { error } = await supabase.rpc(
        'admin_delete_user',
        { 
          target_user_id: userId,
          admin_notes: 'Deleted by admin'
        }
      );

      if (error) throw error;

      setUsers(users.filter(u => u.user_id !== userId));
      setSelectedUser(null);
      setDeletingUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-700">
              Access denied. Admin privileges required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-2 flex items-center text-sm text-red-700 hover:text-red-900"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {totalUsers} total users
          </span>
          <button
            onClick={fetchUsers}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trades
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total P&L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr 
                    key={user.user_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleUserSelect(user.user_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.username}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.trade_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={user.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(user.total_pnl, 'USD')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingUser(user);
                        }}
                        className="text-red-600 hover:text-red-900"
                        disabled={deleting}
                      >
                        <UserX className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * pageSize >= totalUsers}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{((page - 1) * pageSize) + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium">
                    {Math.min(page * pageSize, totalUsers)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{totalUsers}</span>
                  {' '}users
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= totalUsers}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* User Details */}
        {selectedUser ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">User Details</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Account Info</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedUser.user.username}</p>
                <p className="text-sm text-gray-600">{selectedUser.user.email}</p>
                <p className="text-xs text-gray-500">
                  Joined {formatDistanceToNow(new Date(selectedUser.user.created_at), { addSuffix: true })}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Trading Stats</h4>
                <dl className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-gray-500">Total Trades</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {selectedUser.stats.trade_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Total P&L</dt>
                    <dd className={`text-sm font-medium ${
                      selectedUser.stats.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(selectedUser.stats.total_pnl, selectedUser.settings.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Strategies</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {selectedUser.stats.strategy_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Trading Plans</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {selectedUser.stats.plan_count}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Settings</h4>
                <dl className="mt-2 space-y-1">
                  <div>
                    <dt className="text-xs text-gray-500">Timezone</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.settings.timezone}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Currency</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.settings.currency}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Default Commission</dt>
                    <dd className="text-sm text-gray-900">
                      {formatCurrency(selectedUser.settings.default_commission, selectedUser.settings.currency)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setDeletingUser(users.find(u => u.user_id === selectedUser.user.id) || null)}
                  disabled={deleting}
                  className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4 mr-1.5" />
                      Delete User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center text-center">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No User Selected</h3>
            <p className="text-sm text-gray-500">
              Select a user from the list to view their details
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingUser && (
        <DeleteConfirmationDialog
          title="Delete User Account"
          message={`Are you sure you want to delete the account for ${deletingUser.username} (${deletingUser.email})? This action cannot be undone and will delete all associated data.`}
          onConfirm={() => handleDeleteUser(deletingUser.user_id)}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </div>
  );
}