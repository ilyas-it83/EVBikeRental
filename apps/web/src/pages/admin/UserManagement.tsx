import { Fragment, useEffect, useState } from 'react';
import { adminApi } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isSuspended?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const fetchUsers = (page = 1) => {
    setIsLoading(true);
    adminApi
      .listUsers(page, 20)
      .then((data) => {
        setUsers(data.users || []);
        if (data.pagination) setPagination(data.pagination);
      })
      .catch(() => toast('Failed to load users', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleRole = async (user: UserRecord) => {
    const newRole = user.role === 'admin' ? 'rider' : 'admin';
    if (!window.confirm(`Change ${user.name}'s role to ${newRole}?`)) return;

    setActionLoadingId(user.id);
    try {
      const data = await adminApi.updateUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      toast(`Role updated to ${newRole}`, 'success');
    } catch {
      toast('Failed to update role', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSuspend = async (user: UserRecord) => {
    if (!window.confirm(`Suspend user "${user.name}"?`)) return;

    setActionLoadingId(user.id);
    try {
      const data = await adminApi.suspendUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      toast('User suspended', 'success');
    } catch {
      toast('Failed to suspend user', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:outline-none sm:w-64"
          aria-label="Search users"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="hidden px-4 py-3 text-left font-medium text-gray-600 sm:table-cell">Email</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Role</th>
              <th className="hidden px-4 py-3 text-left font-medium text-gray-600 md:table-cell">Joined</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <Fragment key={user.id}>
                <tr
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500 sm:hidden">{user.email}</p>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {user.role}
                    </span>
                    {user.isSuspended && (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleRole(user); }}
                        disabled={actionLoadingId === user.id}
                        className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {user.role === 'admin' ? '→ Rider' : '→ Admin'}
                      </button>
                      {!user.isSuspended && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSuspend(user); }}
                          disabled={actionLoadingId === user.id}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedUserId === user.id && (
                  <tr>
                    <td colSpan={5} className="bg-gray-50 px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="text-xs font-medium text-gray-500">🚲 Ride Summary</p>
                          <p className="mt-1 text-sm text-gray-700">View full ride history in user profile</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="text-xs font-medium text-gray-500">💳 Payment Status</p>
                          <p className="mt-1 text-sm text-gray-700">
                            {user.isSuspended ? 'Account suspended' : 'Active'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <p className="text-xs font-medium text-gray-500">⭐ Subscription</p>
                          <p className="mt-1 text-sm text-gray-700">Details available in user profile</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages} ({pagination.total} users)
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchUsers(pagination.page - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchUsers(pagination.page + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
