import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignRepository } from './DesignRepository';
import type { Design } from '../types';

/*
 * Store mocked so the tests prove the form's wiring without a backend.
 *
 * The two lists and the two mutators are mutable because these cases render a
 * real design and then assert on what the edit form did with it; the view-shape
 * cases above only ever wanted an empty, inert store.
 */
const store = vi.hoisted(() => ({
  designs: [] as Design[],
  addDesign: vi.fn(),
  updateDesign: vi.fn(),
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
    deleteDesign: vi.fn(),
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
});

/*
 * Where the design repository's chosen shape is kept.
 *
 * The grid is the DEFAULT here — the opposite of the stock surface, which
 * defaults to the table — so these assertions exist to stop that asymmetry
 * being quietly "fixed" into sameness by a later edit. It is deliberate (D4):
 * the repository has always been a wall of artwork.
 *
 * The picker itself is scaffolding and is replaced by the ERPNext-style dropdown
 * in P5; these tests name the buttons by label so that swap lands under them.
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

describe('DesignRepository — the list view column set', () => {
  it('renders Name, Category, Added and Actions headers', () => {
    renderAt('/inventory?designView=list');
    for (const label of ['Name', 'Category', 'Added', 'Actions']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe('DesignRepository — the edit form never shows the stored image URL', () => {
  function openEditModal() {
    store.designs = [makeDesign()];
    renderAt('/inventory');
    fireEvent.click(screen.getByTitle('Edit design'));
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

  it('the Storage URL never reaches the page as text at all', () => {
    openEditModal();

    // A document-level check as well as a control-level one: the point is that
    // the link is not displayed, so it must not appear anywhere at all.
    expect(document.body.textContent).not.toContain('supabase.co');
  });

  it('shows the current artwork and a control that replaces it', () => {
    const dialog = openEditModal();

    expect(dialog.getByAltText('Logo Design')).toHaveAttribute('src', STORAGE_IMAGE_URL);
    expect(dialog.getByText(/Choose a file to replace the artwork/)).toBeInTheDocument();
  });
});

describe('DesignRepository — what an edit submits', () => {
  function openEditModal() {
    store.designs = [makeDesign()];
    renderAt('/inventory');
    fireEvent.click(screen.getByTitle('Edit design'));
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
    fireEvent.click(screen.getByTitle('Edit design'));

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
