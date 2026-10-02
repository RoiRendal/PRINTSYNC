import { useEffect, useRef } from 'react';

/**
 * Put focus back on a control that was rebuilt out from under the user.
 *
 * ### The problem this solves
 *
 * Changing a list's view can replace the whole toolbar: the table and the grid
 * are different components, so picking the other one unmounts the trigger the
 * user was standing on. The dropdown focuses its trigger as it closes, but that
 * happens in the same tick — the node is replaced immediately afterwards, focus
 * falls back to `<body>`, and the next Tab starts from the top of the page
 * instead of from the control the user just used.
 *
 * The dropdown cannot fix this itself: by the time the new trigger exists, the
 * instance that handled the click has been unmounted. Something that SURVIVES
 * the swap has to do it, which is what this hook is for.
 *
 * ### Why a selector
 *
 * The old node is gone, so holding a ref would mean holding a detached element.
 * Looking the control up by name finds whatever now carries it — the same
 * control, rebuilt. Pass the same string that names it for assistive tech, so
 * there is one name for the control rather than two.
 *
 * The first render is skipped: on arrival the value came from the URL, and
 * stealing focus on page load is worse than the problem this solves.
 */
export function useRefocusOnChange(selector: string, value: string): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [value, selector]);
}
