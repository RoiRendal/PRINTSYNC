-- Remove design tagging.
--
-- DEPLOY ORDER MATTERS, and it is the reason this is a separate migration from
-- the code that stopped using the column. `listDesigns` named `tags` explicitly
-- in its select list, so dropping the column while the old API was still running
-- would have failed every design read — the list, the repository, and anything
-- else that loads a design. The API must be deployed first; this runs second.
--
-- The GIN index `designs_tags_idx` was built on this column, so it goes with it
-- and does not need dropping by name. Nothing else references the column: the
-- seed scripts, the request schema, the shared `Design` type and the repository
-- UI were all cleared in the same commit as this file.

alter table public.designs drop column tags;
