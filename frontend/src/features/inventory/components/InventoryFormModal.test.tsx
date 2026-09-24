import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InventoryFormModal } from './InventoryFormModal';
import type { CreateInventoryItem } from '../types';

/*
 * Regression cover for the "Add New Stock" 400.
 *
 * The form used to hand its raw state to the API, so an untouched SKU travelled
 * as `sku: ''` — and the request schema rejects a blank SKU (`min(1)`), because
 * blank is what the server treats as "generate one for me". Every add therefore
 * failed with `INVALID_INVENTORY_REQUEST: The inventory details are invalid.`
 * These tests pin the contract: a blank SKU leaves the key out entirely, a typed
 * SKU is trimmed and sent, and the other fields survive intact.
 */

function renderModal(onSubmit: (data: CreateInventoryItem) => Promise<void>) {
  render(
    <InventoryFormModal
      isOpen
      editingItem={null}
      categories={['T-shirt']}
      mutationError={null}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/Premium Cotton/i), {
    target: { value: 'Premium Cotton T-shirt (Black)' },
  });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'T-shirt' } });
}

/*
 * The modal renders no SKU text input, so an "add" always submits a blank SKU —
 * the exact condition that used to fail. `sku` is set here only to exercise the
 * trimming branch.
 */
function typeSku(value: string) {
  fireEvent.change(screen.getByTestId('inventory-sku-input'), { target: { value } });
}

describe('InventoryFormModal — create payload', () => {
  it('omits `sku` entirely when the field is left blank', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(onSubmit);
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as CreateInventoryItem;
    // The regression: `sku: ''` reached the API and failed validation.
    expect(payload).not.toHaveProperty('sku');
    expect(payload.name).toBe('Premium Cotton T-shirt (Black)');
    expect(payload.category).toBe('T-shirt');
  });

  it('sends a typed SKU, trimmed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(onSubmit);
    await fillRequiredFields();

    typeSku('  COTTON-BLK  ');
    fireEvent.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0]?.[0] as CreateInventoryItem).sku).toBe('COTTON-BLK');
  });

  it('treats a whitespace-only SKU as blank, so it never ships as an empty string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(onSubmit);
    await fillRequiredFields();

    typeSku('   ');
    fireEvent.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('sku');
  });

  it('normalises an untouched image to null rather than an empty string', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(onSubmit);
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0]?.[0] as CreateInventoryItem).imageUrl).toBeNull();
  });
});
