import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Shield, Trash2, UserSquare } from 'lucide-react';
import { Modal } from '../../../shared/components/ui/Modal';
import { RbacRole, UserRecord, useUserContext } from '../state/UserContext';
import { ADMIN_PAGE_ACCESS, NAV_ITEMS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';

interface FormState {
  name: string;
  email: string;
  phone: string;
  role: RbacRole;
  position: string;
  createdAt: string;
  password: string;
  access: PageAccessKey[];
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  role: 'staff',
  position: '',
  createdAt: '',
  password: '',
  access: STAFF_PAGE_ACCESS,
};

export default function UserManagement() {
  const { users, createUser, updateUser, deleteUser, getDefaultAccess, firstAdminId } = useUserContext();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const adminCount = users.filter((user) => user.role === 'admin').length;
  const staffCount = users.filter((user) => user.role === 'staff').length;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.position.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query)
      );
    });
  }, [users, search]);

  const openCreate = () => {
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      position: user.position,
      createdAt: user.createdAt,
      password: user.password,
      access: user.access,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingUserId) {
      updateUser(editingUserId, {
        ...form,
        createdAt: form.createdAt || new Date().toISOString().slice(0, 10),
      });
    } else {
      createUser(form);
    }
    closeModal();
  };

  const roleAccessOptions = form.role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;

  const toggleAccess = (key: PageAccessKey) => {
    setForm((prev) => {
      const exists = prev.access.includes(key);
      const next = exists ? prev.access.filter((entry) => entry !== key) : [...prev.access, key];
      const allowed = prev.role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;
      return { ...prev, access: next.filter((entry) => allowed.includes(entry)) };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between bg-white p-3 border border-gray-200 rounded shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-100 bg-gray-50 text-xs focus:outline-none focus:border-zinc-400 rounded dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
          />
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-zinc-900 text-white rounded hover:bg-zinc-800"
        >
          <Plus className="w-3.5 h-3.5" />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 p-4 rounded shadow-sm space-y-3 dark:bg-zinc-900 dark:border-zinc-800">
            <h2 className="text-[10px] uppercase font-bold tracking-[0.3em] mb-4 text-gray-800 dark:text-zinc-400">
              Station Overview
            </h2>
            <div className="flex justify-between items-center p-2.5 bg-gray-50 border border-gray-100 rounded dark:bg-zinc-800 dark:border-zinc-700">
              <div className="flex items-center gap-2.5">
                <Shield className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider dark:text-zinc-300">Admin</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-zinc-900 dark:text-zinc-200">{adminCount}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-gray-50 border border-gray-100 rounded dark:bg-zinc-800 dark:border-zinc-700">
              <div className="flex items-center gap-2.5">
                <UserSquare className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider dark:text-zinc-300">Staff</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-zinc-900 dark:text-zinc-200">{staffCount}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-gray-50 border border-gray-100 rounded dark:bg-zinc-800 dark:border-zinc-700">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-300">Total Users</span>
              <span className="text-[9px] font-mono font-bold text-zinc-900 dark:text-zinc-200">{users.length}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 dark:bg-zinc-900/50 dark:text-zinc-400 dark:border-zinc-800">
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">Staff Identity</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">Email</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">Phone</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">RBAC Role</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">Position</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em]">Date Created</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[9px] tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-100/20 dark:hover:bg-zinc-800/30">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center text-[9px] font-bold text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {user.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold text-gray-800 uppercase leading-none dark:text-zinc-200">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-[10px] font-mono text-gray-600 dark:text-zinc-300">{user.email}</td>
                    <td className="py-2.5 px-4 text-[10px] font-mono text-gray-600 dark:text-zinc-300">{user.phone}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[9px] px-2 py-0.5 border border-gray-100 text-gray-500 font-bold uppercase tracking-tighter bg-gray-50 rounded dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[10px] uppercase font-semibold text-gray-700 dark:text-zinc-300">{user.position}</td>
                    <td className="py-2.5 px-4 text-[10px] font-mono text-gray-500 dark:text-zinc-400">{user.createdAt}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={user.id === firstAdminId}
                          title={user.id === firstAdminId ? 'The first admin account cannot be deleted.' : 'Delete user'}
                          className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingUserId ? 'Edit User' : 'Create User'} maxWidth="max-w-lg">
        <form onSubmit={submitForm} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Staff identity"
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <input
            required
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone number"
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <select
            value={form.role}
            onChange={(e) => {
              const role = e.target.value as RbacRole;
              setForm((prev) => ({ ...prev, role, access: getDefaultAccess(role) }));
            }}
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          >
            <option value="admin">admin</option>
            <option value="staff">staff</option>
          </select>
          <input
            required
            value={form.position}
            onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
            placeholder="Position"
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <input
            type="date"
            value={form.createdAt}
            onChange={(e) => setForm((prev) => ({ ...prev, createdAt: e.target.value }))}
            className="border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Password"
            className="md:col-span-2 border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900"
          />
          <div className="md:col-span-2 border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-xs bg-white dark:bg-zinc-900 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-400">
              {form.role === 'admin' ? 'Admin Page Access' : 'Staff Page Access'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roleAccessOptions.map((key) => {
                const item = NAV_ITEMS.find((nav) => nav.key === key);
                if (!item) {
                  return null;
                }
                return (
                  <label key={key} className="inline-flex items-center gap-2 text-[11px] text-gray-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.access.includes(key)}
                      onChange={() => toggleAccess(key)}
                      className="h-3.5 w-3.5 rounded border border-gray-300 dark:border-zinc-700"
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="px-3 py-2 text-xs rounded border border-gray-200 dark:border-zinc-700">
              Cancel
            </button>
            <button type="submit" className="px-3 py-2 text-xs rounded bg-zinc-900 text-white">
              {editingUserId ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

