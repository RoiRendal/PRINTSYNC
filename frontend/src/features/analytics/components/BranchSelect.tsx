import { DropdownMenu, type DropdownOption } from '../../../shared/components/ui';
import type { Branch } from '@printsync/shared-types';

/** The token the API reads as "every branch" — mirrored from the backend's `ALL_BRANCHES`. */
export const ALL_BRANCHES = 'all';

export interface BranchSelectProps {
  /** `undefined` = the caller's own branch; `'all'` or a branch id otherwise. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  branches: readonly Branch[];
  /** The signed-in account's own branch, to label its option "… (mine)". */
  ownBranchId: string | null;
  className?: string;
}

/**
 * The head-office analytics branch picker — the ONE place in the UI a user chooses
 * which branch to look at.
 *
 * ### Why it is a dropdown and not a segmented control
 *
 * The standing rule: *"avoid this 'switcher' and use dropdowns instead exactly like
 * ERPNext. We will always avoid the switcher look from this point on."* A segmented
 * control stops working the moment a third branch opens — three labels no longer
 * fit, and each one has to be short enough to sit in a tab. A dropdown scales to
 * any number of branches with no layout change, which is the reason ERPNext uses
 * one and the reason this does.
 *
 * ### Why "All branches" is an option rather than the default
 *
 * The default is the account's **own** branch (the first, unlabeled option reads
 * "My branch"). A page that opens on a two-shop total is a number someone
 * screenshots as "this month's sales" — so the combined figure has to be a
 * deliberate pick. The backend holds the same line: an absent `?branch=` resolves
 * to the caller's own branch even for head office.
 *
 * The component itself is *unaware* of permissions. It is rendered only for an
 * account that may cross branches (the page decides), and the server refuses the
 * rest regardless — so this is a convenience, never the control.
 */
export function BranchSelect({ value, onChange, branches, ownBranchId, className }: BranchSelectProps) {
  const options: readonly DropdownOption<string>[] = [
    { value: '', label: 'My branch' },
    { value: ALL_BRANCHES, label: 'All branches' },
    ...branches.map((branch) => ({
      value: branch.id,
      label: branch.id === ownBranchId ? `${branch.name} (mine)` : branch.name,
    })),
  ];

  return (
    <DropdownMenu
      // The menu's `value` is a string; `undefined` (the prop's "my own branch")
      // maps to the empty-string sentinel so "no explicit choice" is a real option
      // in the list rather than a state the menu cannot show as selected.
      value={value ?? ''}
      options={options}
      onChange={(next) => onChange(next === '' ? undefined : next)}
      ariaLabel="Branch to report on"
      className={className}
    />
  );
}
