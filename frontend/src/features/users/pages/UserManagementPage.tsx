import React, { useMemo, useState } from 'react';
import { KeyRound, Plus, Search, Shield, Trash2, UserSquare } from 'lucide-react';

import { ADMIN_PAGE_ACCESS, NAV_ITEMS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  DeleteConfirmModal,
  SurfaceCard,
  Input,
  Modal,
  Pagination,
  Select,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
} from '../../../shared/components/ui';
import { describeApiError } from '../../../shared/api/errors';
import { useUserContext } from '../../../app/stores/useUserStore';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RbacRole, UserSummary } from '../types';
import { normalizeAccess } from '../utils/access';
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
  const [usersToDelete, setUsersToDelete] = useState<UserSummary[]>([]);
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

  /*
   * Tick state lives on the page, and the rows on offer exclude the signed-in
   * admin's own account. Withholding it here — rather than letting the table tick
   * a row the server will refuse — is what keeps "select all" and the count beside
   * the button honest: neither can ever claim a row that cannot be deleted.
   */
  const selectableUserIds = useMemo(
    () => filteredUsers.filter((user) => user.id !== firstAdminId).map((user) => user.id),
    [filteredUsers, firstAdminId],
  );
  const selection = useRowSelection(selectableUserIds);

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
      // The shared contract types `access` as `string[]` (the API may emit codes
      // this client does not know); the form works in `PageAccessKey`, so clamp
      // on the way in — the same rule the user store applies to every row.
      access: normalizeAccess(user.role, user.access),
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

  const openDeleteSelected = () => {
    const targets = filteredUsers.filter((user) => selection.selectedIds.has(user.id));
    if (targets.length === 0) return;
    setUsersToDelete(targets);
    setActionError(null);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setUsersToDelete([]);
    setIsDeleteModalOpen(false);
    setActionError(null);
  };

  const confirmDelete = async () => {
    if (usersToDelete.length === 0) return;
    const targets = usersToDelete;
    setActionError(null);
    setIsDeleting(true);

    /*
     * One row at a time: `deleteUser` is a single-row endpoint, and a bulk route
     * would be a backend change this screen does not need. A partial failure keeps
     * the dialog open and names the survivors, so the retry is one click — the rows
     * that did delete are already gone from the list, which drops their ticks with
     * them.
     */
    const failures: Array<{ user: UserSummary; error: unknown }> = [];
    for (const user of targets) {
      try {
        await deleteUser(user.id);
      } catch (error) {
        failures.push({ user, error });
      }
    }
    setIsDeleting(false);

    if (failures.length === 0) {
      selection.clear();
      closeDeleteModal();
      return;
    }
    setUsersToDelete(failures.map((failure) => failure.user));
    setActionError(
      // One refusal gets the precise reason — the refusal a manager is most likely
      // to meet here is deleting their own account, and that deserves its own
      // sentence rather than a headcount.
      failures.length === 1
        ? describeApiError(failures[0].error, 'The user could not be deleted.')
        : `${failures.length} of ${targets.length} users could not be deleted: ${failures.map((failure) => failure.user.name).join(', ')}. The rest were removed.`,
    );
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
          <Card variant="raised" padding="lg">
            <CardHeader>
              <CardTitle className="label-caps">Station Overview</CardTitle>
              <CardDescription>Current account distribution.</CardDescription>
            </CardHeader>
            <div className="space-y-2.5">
              {[
                { label: 'Admin', value: adminCount, icon: Shield, tone: 'purple' },
                { label: 'Staff', value: staffCount, icon: UserSquare, tone: 'blue' },
                { label: 'Total Users', value: users.length, icon: KeyRound, tone: 'green' },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-[var(--radius-card)] border p-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-[0.75rem]', tone === 'purple' && 'bg-[var(--app-tint-purple)] text-macos-purple', tone === 'blue' && 'bg-[var(--app-tint-blue)] text-macos-blue dark:text-macos-cyan', tone === 'green' && 'bg-[var(--app-tint-green)] text-green-700 dark:text-green-300')}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-400">{label}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-macos-text dark:text-zinc-100">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-md">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                  <Input className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." />
                </div>
                {/*
                  The table's only delete control. Icon-only and gray (the same
                  tone as Cancel) so it does not advertise itself as destructive
                  at a glance — the confirmation modal does that work.
                */}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={selection.count === 0}
                  onClick={openDeleteSelected}
                  aria-label={selection.count > 0 ? `Delete ${selection.count} selected user${selection.count === 1 ? '' : 's'}` : 'Delete selected users'}
                  title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} user${selection.count === 1 ? '' : 's'}`}
                  className="shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TableContainer className="rounded-none border-0 bg-transparent">
                <Table>
                  <colgroup>
                    <col style={{ width: '44px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '240px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '140px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableSelectHead>
                        <Checkbox
                          checked={selection.allSelected}
                          indeterminate={selection.isIndeterminate}
                          disabled={selectableUserIds.length === 0}
                          onChange={selection.toggleAll}
                          aria-label="Select all users on this page"
                        />
                      </TableSelectHead>
                      {/*
                        When rows are ticked the whole header collapses to just the
                        "# items selected" message (ERPNext item-list behaviour);
                        every column label disappears. colSpan 6 = all six data columns.
                      */}
                      {selection.count === 0 ? (
                        <>
                          <TableHead>Staff Identity</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>RBAC Role</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Date Created</TableHead>
                        </>
                      ) : (
                        <TableHead colSpan={6} className="font-semibold text-macos-text dark:text-zinc-100">
                          {formatSelectedCount(selection.count)}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="cursor-pointer" onClick={() => openEdit(user)}>
                        <TableSelectCell onClick={(event) => event.stopPropagation()}>
                          {/*
                            The signed-in admin cannot be deleted, so the row is not
                            offered for selection at all. A tick that the server
                            would refuse is worse than no tick: it would let the
                            count beside the button promise something it cannot do.
                          */}
                          <Checkbox
                            checked={selection.has(user.id)}
                            disabled={user.id === firstAdminId}
                            onChange={() => selection.toggle(user.id)}
                            aria-label={`Select ${user.name}`}
                            title={user.id === firstAdminId ? 'The first admin account cannot be deleted.' : undefined}
                          />
                        </TableSelectCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[0.8rem] text-[10px] text-macos-blue ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
                              {initials(user.name)}
                            </div>
                            <span className="leading-none text-macos-text dark:text-zinc-100">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell><StatusLabel tone={user.role === 'admin' ? 'purple' : 'blue'}>{user.role}</StatusLabel></TableCell>
                        <TableCell className="text-macos-text dark:text-zinc-200">{user.position}</TableCell>
                        <TableCell className="text-macos-text-muted dark:text-zinc-500">{user.createdAt}</TableCell>
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

          <SurfaceCard className="space-y-3 p-3">
            <p className="text-[10px] font-bold text-macos-text-muted dark:text-zinc-500">
              {form.role === 'admin' ? 'Admin Page Access' : 'Staff Page Access'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roleAccessOptions.map((key) => {
                const item = NAV_ITEMS.find((nav) => nav.key === key);
                if (!item) return null;
                return (
                  <label key={key} className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-[11px] text-macos-text dark:text-zinc-300">
                    <input type="checkbox" checked={form.access.includes(key)} disabled className="h-3.5 w-3.5 rounded border accent-macos-blue" />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{editingUserId ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        itemLabels={usersToDelete.map((user) => user.name)}
        isBusy={isDeleting}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      >
        {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}
      </DeleteConfirmModal>
    </div>
  );
}
