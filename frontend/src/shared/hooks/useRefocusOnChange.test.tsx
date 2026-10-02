import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { useRefocusOnChange } from './useRefocusOnChange';

/*
 * The hook exists for one behaviour, and it is the first-render guard that is
 * easy to get wrong: focusing on arrival would steal focus on page load, which
 * is worse than the problem the hook solves.
 */

function Harness({ selector }: { selector: string }) {
  const [value, setValue] = useState('list');
  useRefocusOnChange(selector, value);
  return (
    <div>
      <button type="button" aria-label="Stock view" onClick={() => setValue('image')}>
        Stock view
      </button>
      <button type="button" data-testid="outside">
        outside
      </button>
    </div>
  );
}

describe('useRefocusOnChange', () => {
  it('does not steal focus on the first render', () => {
    const { getByTestId } = render(<Harness selector="[aria-label='Stock view']" />);
    getByTestId('outside').focus();
    expect(document.activeElement).toBe(getByTestId('outside'));
  });

  it('focuses the named control once the value changes', () => {
    const { getByTestId, getByLabelText } = render(<Harness selector="[aria-label='Stock view']" />);
    getByTestId('outside').focus();
    // `fireEvent`, not a raw `.click()`: a raw DOM click bypasses React's `act`,
    // so the effect that does the focusing has not flushed when the assertion
    // runs and the test fails on correct code.
    fireEvent.click(getByLabelText('Stock view'));
    expect(document.activeElement).toBe(getByLabelText('Stock view'));
  });

  it('does nothing when the control is not on the page', () => {
    // The design repository's picker is absent while the stock list is showing,
    // so a missing node must be a no-op rather than a crash.
    const { getByTestId, getByLabelText } = render(<Harness selector="[aria-label='Design view']" />);
    getByTestId('outside').focus();
    fireEvent.click(getByLabelText('Stock view'));
    expect(document.activeElement).toBe(getByTestId('outside'));
  });
});
