import React, { useMemo, useRef, useState } from 'react';
import { Mail, Phone, Plus, Search, Trash2, Users } from 'lucide-react';

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
  Input,
  Modal,
  Pagination,
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
import { useCustomers } from '../../../app/stores/useCustomerStore';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { Customer } from '../types';
import { cn } from '../../../shared/lib/cn';

interface FormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export default function CustomersPage() {
  const { customers, total, page, limit, isLoading, error, refresh, goToPage, addCustomer, updateCustomer, deleteCustomer, countOrders } = useCustomers();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customersToDelete, setCustomersToDelete] = useState<Customer[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  /**
   * Why the last save or delete was refused. Both dialogs are mutually exclusive,
   * so one slot is enough, and it is cleared whenever either opens or closes —
   * a stale reason from a previous attempt would be worse than none.
   */
  const [actionError, setActionError] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [isCheckingOrders, setIsCheckingOrders] = useState(false);
  /** Invalidates an in-flight order count so a late reply cannot land on a newer dialog. */
  const orderCountRequestRef = useRef(0);

  const withPhone = customers.filter((c) => c.phone.trim()).length;
  const withEmail = customers.filter((c) => c.email.trim()).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.notes.toLowerCase().includes(query)
    );
  }, [customers, search]);

  /*
   * Tick state lives on the page. The rows on offer are the filtered ones, so a
   * customer hidden by the search box cannot be deleted by accident — see
   * `useRowSelection` for why that intersection is the point.
   */
  const selection = useRowSelection(useMemo(() => filtered.map((customer) => customer.id), [filtered]));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActionError(null);
  };

  const openDeleteSelected = () => {
    const targets = filtered.filter((customer) => selection.selectedIds.has(customer.id));
    if (targets.length === 0) return;
    const requestId = ++orderCountRequestRef.current;
    setCustomersToDelete(targets);
    setActionError(null);
    setOrderCount(null);
    setIsDeleteModalOpen(true);
    setIsCheckingOrders(true);

    /*
     * Ask how much history these customers have, so the warning can name a number
     * instead of asking staff to accept an unquantified "this may affect orders".
     *
     * The foreign key is `on delete set null`, so the delete is never blocked —
     * the count only informs the decision. A count we cannot fetch therefore must
     * not block it either: refusing to delete because a warning could not be built
     * would be worse than the warning's absence.
     *
     * One request per customer, resolved together. If *any* of them fails the total
     * is withheld rather than shown short — a partial sum would understate the
     * history at risk, and understating it is worse than saying nothing.
     */
    void Promise.allSettled(targets.map((customer) => countOrders(customer.id)))
      .then((results) => {
        if (orderCountRequestRef.current !== requestId) return;
        const known = results.every((result) => result.status === 'fulfilled');
        setOrderCount(
          known
            ? results.reduce((sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0), 0)
            : null,
        );
      })
      .finally(() => {
        if (orderCountRequestRef.current === requestId) setIsCheckingOrders(false);
      });
  };

  const closeDeleteModal = () => {
    orderCountRequestRef.current += 1;
    setCustomersToDelete([]);
    setIsDeleteModalOpen(false);
    setOrderCount(null);
    setIsCheckingOrders(false);
    setActionError(null);
  };

  const confirmDelete = async () => {
    if (customersToDelete.length === 0) return;
    const targets = customersToDelete;
    setActionError(null);
    setIsDeleting(true);

    /*
     * One row at a time: `deleteCustomer` is a single-row endpoint, and a bulk
     * route would be a backend change this screen does not need. A partial failure
     * keeps the dialog open and names the survivors, so the retry is one click —
     * the rows that did delete are already gone from the list, which drops their
     * ticks with them.
     */
    const failures: Array<{ customer: Customer; error: unknown }> = [];
    for (const customer of targets) {
      try {
        await deleteCustomer(customer.id);
      } catch (error) {
        failures.push({ customer, error });
      }
    }
    setIsDeleting(false);

    if (failures.length === 0) {
      selection.clear();
      closeDeleteModal();
      return;
    }
    setCustomersToDelete(failures.map((failure) => failure.customer));
    setActionError(
      // One refusal gets the precise reason — including the session and
      // permission cases only `describeApiError` knows how to phrase. A mixed
      // batch cannot carry one reason per row, so it names the survivors instead.
      failures.length === 1
        ? describeApiError(failures[0].error, 'The customer could not be deleted.')
        : `${failures.length} of ${targets.length} customers could not be deleted: ${failures.map((failure) => failure.customer.name).join(', ')}. The rest were removed.`,
    );
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateCustomer(editingId, form);
      } else {
        await addCustomer(form);
      }
      closeModal();
    } catch (saveError) {
      // Deliberately does not close: closing would discard everything typed, on
      // top of hiding the reason it was rejected.
      setActionError(describeApiError(saveError, 'The customer could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading customers" className="min-h-64" />;
  if (error) return <ErrorState message={error} onRetry={refresh} className="min-h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Customer Directory</h1>
          <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">Manage customer records, contact details, and order history links.</p>
        </div>
        <Button onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}>Add Customer</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-1">
          <Card variant="raised" padding="lg">
            <CardHeader>
              <CardTitle className="label-caps">Directory Overview</CardTitle>
              <CardDescription>Current customer database snapshot.</CardDescription>
            </CardHeader>
            <div className="space-y-2.5">
              {[
                { label: 'Total Customers', value: customers.length, icon: Users, tone: 'blue' as const },
                { label: 'With Phone', value: withPhone, icon: Phone, tone: 'green' as const },
                { label: 'With Email', value: withEmail, icon: Mail, tone: 'purple' as const },
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
                  <Input className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." />
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
                  aria-label={selection.count > 0 ? `Delete ${selection.count} selected customer${selection.count === 1 ? '' : 's'}` : 'Delete selected customers'}
                  title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} customer${selection.count === 1 ? '' : 's'}`}
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
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '240px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '140px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableSelectHead>
                        <Checkbox
                          checked={selection.allSelected}
                          indeterminate={selection.isIndeterminate}
                          disabled={filtered.length === 0}
                          onChange={selection.toggleAll}
                          aria-label="Select all customers on this page"
                        />
                      </TableSelectHead>
                      {/*
                        When rows are ticked the whole header collapses to just the
                        "# items selected" message (ERPNext item-list behaviour);
                        every column label disappears. colSpan 5 = all five data columns.
                      */}
                      {selection.count === 0 ? (
                        <>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Date Created</TableHead>
                        </>
                      ) : (
                        <TableHead colSpan={5} className="font-semibold text-macos-text dark:text-zinc-100">
                          {formatSelectedCount(selection.count)}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer" onClick={() => openEdit(customer)}>
                        <TableSelectCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selection.has(customer.id)}
                            onChange={() => selection.toggle(customer.id)}
                            aria-label={`Select ${customer.name}`}
                          />
                        </TableSelectCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[0.8rem] text-[10px] text-macos-blue ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
                              {initials(customer.name)}
                            </div>
                            <span className="leading-none text-macos-text dark:text-zinc-100">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{customer.phone || '—'}</TableCell>
                        <TableCell>{customer.email || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-macos-text-muted dark:text-zinc-400">{customer.notes || '—'}</TableCell>
                        <TableCell className="text-macos-text-muted dark:text-zinc-500">{customer.createdAt.slice(0, 10)}</TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-macos-text-muted dark:text-zinc-500">No customers match your search.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <div className="border-t px-4 py-3">
                <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Edit Customer' : 'Add Customer'} maxWidth="max-w-lg">
        <form onSubmit={submitForm} className="space-y-4">
          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Full name" />
            <Input type="tel" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" />
            <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email address" />
            <Input value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={isSaving}>Cancel</Button>
            <Button type="submit" isLoading={isSaving}>{editingId ? 'Save Changes' : 'Add Customer'}</Button>
          </div>
        </form>
      </Modal>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        itemLabels={customersToDelete.map((customer) => customer.name)}
        isBusy={isDeleting}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      >
        {isCheckingOrders && (
          <p className="text-[10px] font-semibold text-macos-text-muted dark:text-zinc-500">
            Checking {customersToDelete.length > 1 ? 'these customers’' : "this customer's"} order history…
          </p>
        )}

        {/*
          The delete is never blocked by history — the foreign key is `on delete
          set null`, so it succeeds and unlinks the orders. That is exactly why
          the number has to be said out loud: the consequence is invisible
          afterwards, and nobody notices until they try to find the order.
        */}
        {orderCount !== null && orderCount > 0 && (
          <InlineAlert
            tone="warning"
            message={`${customersToDelete.length > 1 ? 'These customers have' : 'This customer has'} ${orderCount} ${orderCount === 1 ? 'order' : 'orders'} on record. Those orders keep the customer's name, but will no longer be linked to ${customersToDelete.length > 1 ? 'these customer records' : 'this customer record'}.`}
          />
        )}

        {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}
      </DeleteConfirmModal>
    </div>
  );
}
