import React, { useMemo, useRef, useState } from 'react';
import { Mail, Phone, Plus, Search, Pencil, Trash2, Users } from 'lucide-react';

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
} from '../../../shared/components/ui';
import { describeApiError } from '../../../shared/api/errors';
import { useCustomers } from '../../../app/stores/useCustomerStore';
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
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
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

  const openDelete = (customer: Customer) => {
    const requestId = ++orderCountRequestRef.current;
    setCustomerToDelete(customer);
    setActionError(null);
    setOrderCount(null);
    setIsDeleteModalOpen(true);
    setIsCheckingOrders(true);

    /*
     * Ask how much history this customer has, so the warning can name a number
     * instead of asking staff to accept an unquantified "this may affect orders".
     *
     * The foreign key is `on delete set null`, so the delete is never blocked —
     * the count only informs the decision. A count we cannot fetch therefore must
     * not block it either: refusing to delete because a warning could not be built
     * would be worse than the warning's absence.
     */
    void countOrders(customer.id)
      .then((count) => {
        if (orderCountRequestRef.current === requestId) setOrderCount(count);
      })
      .catch(() => {
        if (orderCountRequestRef.current === requestId) setOrderCount(null);
      })
      .finally(() => {
        if (orderCountRequestRef.current === requestId) setIsCheckingOrders(false);
      });
  };

  const closeDeleteModal = () => {
    orderCountRequestRef.current += 1;
    setCustomerToDelete(null);
    setIsDeleteModalOpen(false);
    setOrderCount(null);
    setIsCheckingOrders(false);
    setActionError(null);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    setActionError(null);
    setIsDeleting(true);
    try {
      await deleteCustomer(customerToDelete.id);
      closeDeleteModal();
    } catch (deleteError) {
      // Stays open, and says why. This used to `return` in silence, so a refused
      // delete looked exactly like a button that did nothing.
      setActionError(describeApiError(deleteError, 'The customer could not be deleted.'));
    } finally {
      setIsDeleting(false);
    }
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
              <CardTitle className="text-[11px] uppercase tracking-[0.24em]">Directory Overview</CardTitle>
              <CardDescription>Current customer database snapshot.</CardDescription>
            </CardHeader>
            <div className="space-y-2.5">
              {[
                { label: 'Total Customers', value: customers.length, icon: Users, tone: 'blue' as const },
                { label: 'With Phone', value: withPhone, icon: Phone, tone: 'green' as const },
                { label: 'With Email', value: withEmail, icon: Mail, tone: 'purple' as const },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 dark:bg-[#39393b]">
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
                <CardTitle>Customers</CardTitle>
                <CardDescription>{filtered.length} matching customers in the directory.</CardDescription>
              </div>
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
                <Input className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." />
              </div>
            </CardHeader>
            <CardContent>
              <TableContainer className="rounded-none border-0 bg-transparent">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[0.8rem] bg-[var(--app-surface-sub)] text-[10px] font-bold text-macos-blue ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
                              {initials(customer.name)}
                            </div>
                            <span className="text-[11px] font-bold uppercase leading-none text-macos-text dark:text-zinc-100">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">{customer.phone || '—'}</TableCell>
                        <TableCell className="font-mono text-[10px]">{customer.email || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-[10px] text-macos-text-muted dark:text-zinc-400">{customer.notes || '—'}</TableCell>
                        <TableCell className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">{customer.createdAt.slice(0, 10)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(customer)} className="h-8 w-8" title="Edit customer">
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => openDelete(customer)} className="h-8 w-8 text-macos-red hover:text-macos-red" title="Delete customer">
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
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
              <div className="p-3">
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

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Deletion" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-macos-text-muted dark:text-zinc-400">
            Are you sure you want to delete <strong className="text-macos-text dark:text-zinc-100">{customerToDelete?.name}</strong>? This action cannot be undone.
          </p>

          {isCheckingOrders && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-macos-text-muted dark:text-zinc-500">
              Checking this customer's order history…
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
              message={`This customer has ${orderCount} ${orderCount === 1 ? 'order' : 'orders'} on record. Those orders keep the customer's name, but will no longer be linked to this customer record.`}
            />
          )}

          {actionError && <InlineAlert message={actionError} onDismiss={() => setActionError(null)} />}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={closeDeleteModal} disabled={isDeleting}>Cancel</Button>
            <Button type="button" variant="danger" fullWidth isLoading={isDeleting} onClick={confirmDelete}>Delete Customer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
