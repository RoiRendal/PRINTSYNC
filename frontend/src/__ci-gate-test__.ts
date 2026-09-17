/**
 * DELIBERATE, HARMLESS MISTAKE — a one-off test of the pull-request gate on `main`.
 *
 * Nothing imports this file, and it is not part of the application. It exists
 * only to fail the `frontend` type-check so the branch-protection ruleset can be
 * seen doing its job on a real pull request.
 *
 * Worth noting what this demonstrates: `npm run build` is just `vite build`, and
 * Vite strips types without checking them. A broken build like this one would
 * therefore deploy perfectly happily. Only the CI type-check catches it — which
 * is exactly how the frontend once accumulated 16 type errors that shipped.
 *
 * Cleanup: delete this file, the branch `ci-gate-test`, and its pull request.
 */
export const deliberatelyBroken: number = 'a string where a number belongs';
