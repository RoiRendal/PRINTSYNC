import React, { useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Shield, Trash2, UserSquare } from 'lucide-react';

import { ADMIN_PAGE_ACCESS, NAV_ITEMS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassCard,
  Input,
  Modal,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../shared/components/ui';
import { describeApiError } from '../../../shared/api/errors';
import { useUserContext } from '../../../app/stores/useUserStore';
import type { RbacRole, UserSummary } from '../types';
import { useAuth } from '../../../app/stores/useAuthStore';
import { cn } from '../../../shared/lib/cn';

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

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function UserManagement() {
  const { users, total, page, limit, isUsersLoading, userError, refreshUsers, goToPage, createUser, updateUser, deleteUser } = useUserContext();
  const { currentUser, getDefaultAccess } = useAuth();
  const firstAdminId = currentUser?.id ?? '';
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [userToDelete, setUserToDelete] = useState<UserSummary | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  /**
   * Why the last save or delete was refused. The two dialogs are mutually
   * exclusive, so one slot is enough, and it is cleared whenever either opens or
   * closes — a reason left over from an earlier attempt would be worse than none.
   */
  const [actionError, setActionError] = useState<string | null>(null);

  const adminCount = users.filter((user) => user.role === 'admin').length;
  const staffCount = users.filter((user) => user.role === 'staff').length;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
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
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserSummary) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      position: user.position,
      createdAt: user.createdAt,
      password: '',
      access: user.access,
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setActionError(null);
  };

  const openDelete = (user: UserSummary) => {
    setUserToDelete(user);
    setActionError(null);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setUserToDelete(null);
    setIsDeleteModalOpen(false);
    setActionError(null);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      closeDeleteModal();
    } catch (deleteError) {
      // Stays open, and says why. This used to `return` in silence, so a refused
      // delete looked exactly like a button that did nothing — and the refusal a
      // manager is most likely to hit here is deleting their own account.
      setActionError(describeApiError(deleteError, 'The user could not be deleted.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setIsSaving(true);
    try {
      if (editingUserId) {
        await updateUser(editingUserId, {
          ...form,
          createdAt: form.createdAt || new Date().toISOString().slice(0, 10),
        });
      } else {
        await createUser(form);
      }
      closeModal();
    } catch (saveError) {
      /*
       * Deliberately does not close: closing would discard everything typed, on
       * top of hiding the reason. The failure a manager meets most often is an
       * email that already has an account, and that is worth saying plainly —
       * "the user could not be created" would send them re-checking the password.
       */
      setActionError(describeApiError(saveError, 'The user could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const roleAccessOptions = form.role === 'admin' ? ADMIN_PAGE_ACCESS : STAFF_PAGE_ACCESS;

  if (isUsersLoading) return <LoadingState label="Loading users" className="min-h-64" />;
  if (userError) return <ErrorState message={userError} onRetry={refreshUsers} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>

          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">User Management</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">Manage staff profiles, RBAC roles, and default page access groups.</p>
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>Add User</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-1">
          <Card variant="glass" padding="lg">
            <CardHeader>
              <CardTitle className="text-[11px] uppercase tracking-[0.24em]">Station Overview</CardTitle>
              <CardDescription>Current account distribution.</CardDescription>
            </CardHeader>
            <div className="space-y-2.5">
              {[
                { label: 'Admin', value: adminCount, icon: Shield, tone: 'purple' },
                { label: 'Staff', value: staffCount, icon: UserSquare, tone: 'blue' },
                { label: 'Total Users', value: users.length, icon: KeyRound, tone: 'green' },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 shadow-[var(--shadow-card)] dark:bg-[#39393b]">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-[0.75rem]', tone === 'purple' && 'bg-[var(--app-tint-purple)] text-macos-purple', tone === 'blue' && 'bg-[var(--app-tint-blue)] text-macos-blue dark:text-macos-cyan', tone === 'green' && 'bg-[var(--app-tint-green)] text-green-700 dark:text-green-300')}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-macos-text-muted dark:text-zinc-400">{label}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-macos-text dark:text-zinc-100">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <Card variant="elevated" padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Team Directory</CardTitle>
                <CardDescription>{filteredUsers.length} matching users across administrators and staff.</CardDescription>
              </div>
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                <Input className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." />
              </div>
            </CardHeader>
            <CardContent>
              <TableContainer className="rounded-none border-0 bg-transparent shadow-none">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Staff Identity</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>RBAC Role</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[0.8rem] bg-[var(--app-surface-sub)] text-[10px] font-bold text-macos-blue ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
                              {initials(user.name)}
                            </div>
                            <span className="text-[11px] font-bold uppercase leading-none text-macos-text dark:text-zinc-100">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">{user.email}</TableCell>
                        <TableCell className="font-mono text-[10px]">{user.phone}</TableCell>
                        <TableCell><Badge variant={user.role === 'admin' ? 'purple' : 'blue'}>{user.role}</Badge></TableCell>
                        <TableCell className="text-[10px] font-semibold uppercase text-macos-text dark:text-zinc-200">{user.position}</TableCell>
                        <TableCell className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">{user.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(user)} className="h-8 w-8" title="Edit user">
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => openDelete(user)} disabled={user.id === firstAdminId} title={user.id === firstAdminId ? 'The first admin account cannot be deleted.' : 'Delete user'} className="h-8 w-8 text-macos-red hover:text-macos-red">
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-macos-text-muted dark:text-zinc-500">No users match your search.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <div className="p-3">
                <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingUserId ? 'Edit User' : 'Create User'} maxWidth="max-w-2xl">
        <form onSubmit={submitForm} className="space-y-4">
          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Staff identity" />
            <Input required type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
            <Input required value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" />
            <Select value={form.role} onChange={(e) => { const role = e.target.value as RbacRole; setForm((prev) => ({ ...prev, role, access: getDefaultAccess(role) })); }}>
              <option value="admin">admin</option>
              <option value="staff">staff</option>
            </Select>
            <Input required value={form.position} onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))} placeholder="Position" />
            <Input type="date" value={form.createdAt} onChange={(e) => setForm((prev) => ({ ...prev, createdAt: e.target.value }))} />
            <Input className="md:col-span-2" required={!editingUserId} type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Password" />
          </div>

          <GlassCard className="space-y-3 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">
              {form.role === 'admin' ? 'Admin Page Access' : 'Staff Page Access'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roleAccessOptions.map((key) => {
                const item = NAV_ITEMS.find((nav) => nav.key === key);
                if (!item) return null;
                return (
                  <label key={key} className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border bg-[var(--app-surface-raised)] px-3 py-2 text-[11px] text-macos-text dark:bg-[#39393b] dark:text-zinc-300">
                    <input type="checkbox" checked={form.access.includes(key)} disabled className="h-3.5 w-3.5 rounded border accent-macos-blue" />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </GlassCard>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{editingUserId ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Deletion" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-macos-text-muted dark:text-zinc-400">
            Are you sure you want to delete <strong className="text-macos-text dark:text-zinc-100">{userToDelete?.name}</strong>? This action cannot be undone.
          </p>

          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={closeDeleteModal} disabled={isDeleting}>Cancel</Button>
            <Button type="button" variant="danger" fullWidth isLoading={isDeleting} onClick={confirmDelete}>Delete User</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
