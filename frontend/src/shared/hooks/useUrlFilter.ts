import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A single-param window into the URL query string, built on react-router's
 * `useSearchParams`.
 *
 * The page owns the *selected* value — it has to, to render the control — so the
 * URL is the one source of truth it is read from and written to. One designated
 * `clearValue` is treated as "no filter": passing it deletes the param instead of
 * storing it, so picking "All" yields a clean `/orders` rather than
 * `/orders?status=All`.
 *
 * ### Why delete on clear, rather than store the sentinel
 *
 * A staff member who deep-links `/orders?status=Ready for Pickup` expects to land
 * on that view, and clicking "All" should give them a clean `/orders` — not a URL
 * still carrying `?status=All`. Leaving the sentinel in the URL would also make a
 * shared link carry a meaningless parameter, and would make the server-side
 * filter behave inconsistently with the control's label (the backend turns the
 * filter off when the key is *absent*, not when it equals the sentinel).
 *
 * ### Why a small hook instead of calling `useSearchParams` inline
 *
 * Every filter page would otherwise repeat the "delete when cleared" dance and
 * the functional-updater boilerplate. Centralising it means the one trap (forgetting
 * to `delete` on clear) lives in exactly one place.
 */
export function useUrlFilter(paramName: string, clearValue: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName);

  const setValue = useCallback(
    (next: string) => {
      // The functional updater receives the *current* params, so a write to this
      // one key never clobbers the others on the same page.
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          if (next === clearValue) {
            nextParams.delete(paramName);
          } else {
            nextParams.set(paramName, next);
          }
          return nextParams;
        },
        { replace: false },
      );
    },
    [paramName, clearValue, setSearchParams],
  );

  return [value, setValue] as const;
}
