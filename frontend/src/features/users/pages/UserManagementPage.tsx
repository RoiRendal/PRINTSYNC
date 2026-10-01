import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from '../../../shared/components/ui/icons';

import { ADMIN_PAGE_ACCESS, NAV_ITEMS, PageAccessKey, STAFF_PAGE_ACCESS } from '../../../shared/constants/navigation';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  DeleteConfirmModal,
  SurfaceCard,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  StatTile,
  StatTileRow,
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
  cellTitle,
} from '../../../shared/components/ui';
import { describeApiError } from '../../../shared/api/errors';
import { useUserContext } from '../../../app/stores/useUserStore';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RbacRole, UserSummary } from '../types';
import { normalizeAccess } from '../utils/access';
import { useAuth } from '../../../app/stores/useAuthStore';

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

  if (isUsersLoading) return <TableSkeleton columns={6} className="min-h-64" />;
  if (userError) return <ErrorState message={userError} onRetry={refreshUsers} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <StatTileRow columns={1}>
        <StatTile label="Total Users" value={users.length} />
      </StatTileRow>

      <Card padding="none" className="overflow-hidden">
            <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-md">
                <SearchInput className="flex-1" value={search} onChange={(e) => setSearch(e.target.value)} />
                {/*
                  Re-reads the list. To the LEFT of delete — the rule for every
                  table that has one — so the toolbar reads search, refresh,
                  delete, add.
                */}
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => refreshUsers()}
                  aria-label="Refresh"
                  title="Refresh"
                  className="shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
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
                {/*
                  "Add User" as a bare plus, to the right of delete — the same pair
                  the Inventory table shows. The words live in the accessible name
                  now; the primary fill stays, because adding a user is still this
                  screen's one dominant action (R23).
                */}
                <Button
                  type="button"
                  variant="primary"
                  size="icon"
                  onClick={openCreate}
                  aria-label="Add User"
                  title="Add User"
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
                        <TableHead colSpan={6} className="font-semibold text-app-ink dark:text-zinc-100">
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
                        {/*
                          The name alone. The 32px ringed initials tile that sat
                          beside it was the same rounded box the icon frames were;
                          a table row is identified by its text, not by a badge.
                        */}
                        <TableCell title={cellTitle('Staff Identity', user.name)}>
                          <span className="leading-none text-app-ink dark:text-zinc-100">{user.name}</span>
                        </TableCell>
                        <TableCell title={cellTitle('Email', user.email)}>{user.email}</TableCell>
                        <TableCell title={cellTitle('Phone', user.phone)}>{user.phone}</TableCell>
                        <TableCell title={cellTitle('RBAC Role', user.role)}><StatusLabel tone={user.role === 'admin' ? 'purple' : 'accent'}>{user.role}</StatusLabel></TableCell>
                        <TableCell className="text-app-ink dark:text-zinc-200" title={cellTitle('Position', user.position)}>{user.position}</TableCell>
                        <TableCell className="text-app-text-muted dark:text-zinc-500" title={cellTitle('Date Created', user.createdAt)}>{user.createdAt}</TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="whitespace-normal py-10 text-center text-sm text-app-text-muted dark:text-zinc-500">No users match your search.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {/*
                Only when there is more than one page. The band exists to frame the
                pager, so an empty pager would leave a stray strip under the last
                row — which is why the two tables that take a `footer` prop are
                handed one only when it has something in it.
              */}
              {total > limit && (
                <div className="border-t px-4 py-3">
                  <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
                </div>
              )}
            </CardContent>
          </Card>

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
            <p className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">
              {form.role === 'admin' ? 'Admin Page Access' : 'Staff Page Access'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roleAccessOptions.map((key) => {
                const item = NAV_ITEMS.find((nav) => nav.key === key);
                if (!item) return null;
                return (
                  <label key={key} className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-xs text-app-ink dark:text-zinc-300">
                    {/*
                      The shared Checkbox, not a bare input. This was the last
                      hand-rolled box in the app — it had drifted to `rounded
                      border accent-app-accent`, a mix of Tailwind's default
                      radius and a native accent, so it was already a different
                      shape from every other box on screen. Read-only: the page
                      access grid is derived from the role, not ticked by hand.
                    */}
                    <Checkbox checked={form.access.includes(key)} disabled readOnly />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>{editingUserId ? 'Save Changes' : 'Create User'}</Button>
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
