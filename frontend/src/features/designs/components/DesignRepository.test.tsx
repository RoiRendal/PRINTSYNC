import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignRepository } from './DesignRepository';
import type { Design } from '../types';

/*
 * Store mocked so the tests prove the screen's wiring without a backend.
 *
 * The two lists and the mutators are mutable because these cases render real
 * designs and then assert on what the toolbar, the row and the edit form did
 * with them; the view-shape cases only ever wanted an empty, inert store.
 */
const store = vi.hoisted(() => ({
  designs: [] as Design[],
  addDesign: vi.fn(),
  updateDesign: vi.fn(),
  deleteDesign: vi.fn(),
}));

vi.mock('../../../app/stores/useDesignStore', () => ({
  useDesigns: () => ({
    designs: store.designs,
    total: store.designs.length,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    addDesign: store.addDesign,
    updateDesign: store.updateDesign,
    deleteDesign: store.deleteDesign,
  }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DesignRepository />
    </MemoryRouter>,
  );
}

/*
 * A design whose `imageUrl` is deliberately a full Supabase Storage link — the
 * exact shape the app stores for an uploaded asset, and the exact string that
 * used to be printed into a text box for a staff member to read and retype.
 */
const STORAGE_IMAGE_URL =
  'https://ucpkqamnoizfpyhxywnv.supabase.co/storage/v1/object/public/design-assets/actor-1/asset.png';

function makeDesign(overrides: Partial<Design> = {}): Design {
  return {
    id: 'design-1',
    name: 'Logo Design',
    category: 'Logo',
    imageUrl: STORAGE_IMAGE_URL,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01T00:00:00.000Z',
    assetType: 'image/png',
    assetSizeBytes: 2048,
    ...overrides,
  };
}

beforeEach(() => {
  store.designs = [];
  store.addDesign.mockClear();
  store.updateDesign.mockClear();
  store.deleteDesign.mockReset();
});

/*
 * Where the design repository's chosen shape is kept.
 *
 * The grid is the DEFAULT here — the opposite of the stock surface, which
 * defaults to the table — so these assertions exist to stop that asymmetry
 * being quietly "fixed" into sameness by a later edit. It is deliberate (D4):
 * the repository has always been a wall of artwork.
 */
describe('DesignRepository — view in the URL', () => {
  const trigger = () => screen.getByRole('button', { name: 'Design view' });

  it('shows the image view as current by default', () => {
    renderAt('/inventory');
    expect(trigger()).toHaveTextContent('Image View');
  });

  it('shows the list view as current when the URL asks for it', () => {
    renderAt('/inventory?designView=list');
    expect(trigger()).toHaveTextContent('List View');
  });

  it('falls back to the grid for a value it does not recognise', () => {
    renderAt('/inventory?designView=table');
    expect(trigger()).toHaveTextContent('Image View');
  });

  it('the menu lists both views, in order, marking the current one', () => {
    renderAt('/inventory?designView=list');
    fireEvent.click(trigger());
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual(['List View', 'Image View']);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('choosing the other view makes it current', () => {
    renderAt('/inventory');
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List View' }));
    expect(trigger()).toHaveTextContent('List View');
  });

  it('the repository keeps its own default even when the stock param is set', () => {
    // The two surfaces keep independent defaults, and the stock param must not
    // be read by the repository.
    renderAt('/inventory?stockView=image');
    expect(trigger()).toHaveTextContent('Image View');
  });
});

/*
 * The toolbar row, and where each control sits in it.
 *
 * The order is the convention every list page follows — view, search, refresh,
 * delete, add — and it is the kind of thing that survives review while being
 * wrong: every control still works in any order, so nothing fails. What breaks
 * is the muscle memory, and the delete square is only findable if it stays where
 * the other tables put it. Asserted on DOM order, because jsdom applies no
 * stylesheet and every `getBoundingClientRect()` here is zeroes.
 */
describe('DesignRepository — the toolbar row', () => {
  /** The labels of the toolbar's direct children, left to right. */
  function toolbarOrder(): string[] {
    const search = screen.getByPlaceholderText('Search...');
    const row = search.parentElement;
    if (!row) throw new Error('the search box has no toolbar row');
    return Array.from(row.children).map((child) => {
      if (child.tagName === 'INPUT') return 'search';
      if (child.tagName === 'BUTTON') return child.getAttribute('aria-label') ?? 'button';
      const inner = child.querySelector('button');
      return inner?.getAttribute('aria-label') ?? child.tagName;
    });
  }

  it('leads with the view picker, then search, refresh, delete, add', () => {
    renderAt('/inventory?designView=list');
    const order = toolbarOrder();
    expect(order).toHaveLength(5);
    expect(order[0]).toBe('Design view');
    expect(order[1]).toBe('search');
    expect(order[2]).toBe('Refresh');
    expect(order[3]).toMatch(/^Delete/);
    expect(order[4]).toBe('Upload Design');
  });

  it('renders exactly one delete control, disabled until a row is ticked', () => {
    store.designs = [makeDesign()];
    renderAt('/inventory?designView=list');
    const deleteButton = screen.getByRole('button', { name: /delete selected designs/i });
    expect(deleteButton).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1);
  });

  it('reports how many designs are on offer, and swaps to the selection count', () => {
    store.designs = [makeDesign(), makeDesign({ id: 'design-2', name: 'Second Design' })];
    renderAt('/inventory?designView=list');
    expect(screen.getByText('2 designs')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Logo Design' }));
    // Two places say it once a row is ticked, and that is deliberate: the count
    // line follows the stock page's, and the table header collapses to the same
    // message (ERPNext item-list behaviour). The stock page shows both too.
    expect(screen.getAllByText('1 item selected')).toHaveLength(2);
    expect(screen.queryByText('2 designs')).toBeNull();
  });

  it('says nothing at all when there is nothing to count', () => {
    renderAt('/inventory?designView=list');
    // "0 designs" beside "No designs found" states the same fact twice.
    expect(screen.queryByText('0 designs')).toBeNull();
  });
});

/*
 * Bulk delete. The dialog names every design it will take, the deletes run one
 * row at a time, and the ticks are only cleared once the whole batch succeeded.
 */describe('DesignRepository — deleting ticked designs', () => {
  function openDeleteDialog() {
    store.designs = [
      makeDesign(),
      makeDesign({ id: 'design-2', name: 'Second Design' }),
    ];
    const { container } = renderAt('/inventory?designView=list');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Logo Design' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Second Design' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 selected designs' }));
    return container;
  }

  it('names every design the delete is about to take', () => {
    openDeleteDialog();
    const dialog = within(screen.getByRole('dialog', { name: 'Confirm Deletion' }));
    expect(dialog.getByText('Logo Design')).toBeInTheDocument();
    expect(dialog.getByText('Second Design')).toBeInTheDocument();
  });

  it('deletes each ticked design and closes the dialog', async () => {
    store.deleteDesign = vi.fn().mockResolvedValue(undefined);
    openDeleteDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(store.deleteDesign).toHaveBeenCalledTimes(2));
    expect(store.deleteDesign.mock.calls.map((call) => call[0])).toEqual(['design-1', 'design-2']);
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm Deletion' })).toBeNull());
  });

  it('keeps the dialog open and names the survivors when one delete fails', async () => {
    store.deleteDesign = vi.fn().mockImplementation((id: string) =>
      id === 'design-2' ? Promise.reject(new Error('nope')) : Promise.resolve(undefined),
    );
    openDeleteDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await vi.waitFor(() => expect(store.deleteDesign).toHaveBeenCalledTimes(2));
    // The dialog stays open, still holding only the design that survived.
    const dialog = within(screen.getByRole('dialog', { name: 'Confirm Deletion' }));
    await vi.waitFor(() => expect(dialog.getByText('Second Design')).toBeInTheDocument());
    expect(dialog.queryByText('Logo Design')).toBeNull();
  });
});

describe('DesignRepository — the repository has no view modal', () => {
  it('never renders a design view dialog from a row click', async () => {
    store.designs = [makeDesign()];
    renderAt('/inventory?designView=list');
    fireEvent.click(screen.getByText('Logo Design'));

    // The click opens the EDIT form, and nothing else. There is no second
    // read-only screen showing the same record.
    expect(screen.getByRole('dialog', { name: 'Edit Design' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Design View' })).toBeNull();
  });

  it('never renders the Reference ID anywhere', () => {
    store.designs = [makeDesign()];
    renderAt('/inventory');
    fireEvent.click(screen.getByText(/Logo Design/));
    expect(screen.queryByText('Reference ID')).toBeNull();
    expect(document.body.textContent).not.toContain('design-1');
  });
});

describe('DesignRepository — the edit form never shows the stored image URL', () => {
  function openEditModal() {
    store.designs = [makeDesign()];
    renderAt('/inventory');
    fireEvent.click(screen.getByTitle('Logo Design — click to edit'));
    return within(screen.getByRole('dialog', { name: 'Edit Design' }));
  }

  it('there is no text field holding the Storage link', () => {
    const dialog = openEditModal();

    // The artwork is a FILE picker, the way the Stock List does it — not a box
    // with the Supabase host in it.
    expect(dialog.getByLabelText('Design Image')).toHaveAttribute('type', 'file');

    for (const field of dialog.getAllByRole('textbox')) {
      expect(field).not.toHaveValue(STORAGE_IMAGE_URL);
    }
  });

  it('shows the current artwork and a control that replaces it', () => {
    const dialog = openEditModal();

    expect(dialog.getByAltText('Logo Design')).toHaveAttribute('src', STORAGE_IMAGE_URL);
    expect(dialog.getByText(/Choose a file to replace the artwork/)).toBeInTheDocument();
  });

  /*
   * What the removed View modal used to be the only place to see: when the
   * design was added and the download that hands over the stored original.
   */
  it('carries the created date the View modal used to show', () => {
    const dialog = openEditModal();
    expect(dialog.getByText('Created Date')).toBeInTheDocument();
    expect(dialog.getByText('2026-09-01')).toBeInTheDocument();
  });

  it('carries the Download Assets button the View modal used to show', () => {
    const openSpy = vi.fn();
    const original = window.open;
    window.open = openSpy;
    try {
      const dialog = openEditModal();
      fireEvent.click(dialog.getByRole('button', { name: 'Download Assets' }));
    } finally {
      window.open = original;
    }
    expect(openSpy).toHaveBeenCalledWith(STORAGE_IMAGE_URL, '_blank', 'noopener,noreferrer');
  });
});

describe('DesignRepository — what an edit submits', () => {
  function openEditModal() {
    store.designs = [makeDesign()];
    renderAt('/inventory');
    fireEvent.click(screen.getByTitle('Logo Design — click to edit'));
    return within(screen.getByRole('dialog', { name: 'Edit Design' }));
  }

  it('a rename sends no artwork column at all', async () => {
    const dialog = openEditModal();

    fireEvent.change(dialog.getByDisplayValue('Logo Design'), { target: { value: 'Horse Emblem' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => expect(store.updateDesign).toHaveBeenCalledTimes(1));
    const call = store.updateDesign.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(call[0]).toBe('design-1');
    expect(call[1]).toEqual({ name: 'Horse Emblem', category: 'Logo' });
    expect(call[1]).not.toHaveProperty('imageUrl');
  });

  it('a design whose category is not one of the five can still be saved', async () => {
    // A `<select required>` whose value matches no option is an invalid control
    // and the browser refuses to submit the form — which silently made every
    // seeded design (Branding, Apparel, Patterns, Stationery) uneditable.
    store.designs = [makeDesign({ category: 'Branding' })];
    renderAt('/inventory');
    fireEvent.click(screen.getByTitle('Logo Design — click to edit'));

    const dialog = within(screen.getByRole('dialog', { name: 'Edit Design' }));
    expect(dialog.getByRole('combobox')).toHaveValue('Branding');

    fireEvent.change(dialog.getByDisplayValue('Logo Design'), { target: { value: 'Horse Emblem' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await vi.waitFor(() => expect(store.updateDesign).toHaveBeenCalledTimes(1));
    const call = store.updateDesign.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(call[1]).toEqual({ name: 'Horse Emblem', category: 'Branding' });
  });

  it('a design cannot be saved without artwork', async () => {
    renderAt('/inventory');
    fireEvent.click(screen.getByRole('button', { name: 'Upload Design' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Upload New Design' }));
    fireEvent.change(dialog.getByPlaceholderText('Modern Minimalist Logo'), { target: { value: 'No Art' } });
    fireEvent.change(dialog.getByRole('combobox'), { target: { value: 'Logo' } });
    // The header's own "+" carries the same accessible name, so the modal's
    // submit is the last of the two.
    fireEvent.click(dialog.getByRole('button', { name: 'Upload Design' }));

    // The backend column is `not null`, and the placeholder URL this form used
    // to fall back on pointed at a file that was never shipped.
    await vi.waitFor(() => expect(screen.getByText('Choose an image to upload.')).toBeInTheDocument());
    expect(store.addDesign).not.toHaveBeenCalled();
  });
});
