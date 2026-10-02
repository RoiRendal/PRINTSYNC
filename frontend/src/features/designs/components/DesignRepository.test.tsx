import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignRepository } from './DesignRepository';

// Store mocked so the test proves the URL wiring without a backend.
vi.mock('../../../app/stores/useDesignStore', () => ({
  useDesigns: () => ({
    designs: [],
    total: 0,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    addDesign: vi.fn(),
    updateDesign: vi.fn(),
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
