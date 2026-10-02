import React, { useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Plus, RefreshCw, Trash2 } from '../../../shared/components/ui/icons';

import { designsApi } from '../api/designsApi';
import { useDesigns } from '../../../app/stores/useDesignStore';
import type { Design } from '../types';
import { readFileAsDataUrl } from '../../../shared/lib/readFileAsDataUrl';
import { ApiError } from '../../../shared/api/errors';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import { useUrlFilter } from '../../../shared/hooks/useUrlFilter';
import { useRefocusOnChange } from '../../../shared/hooks/useRefocusOnChange';
import { useRowSelection } from '../../../shared/hooks/useRowSelection';
import { Button, Card, CardContent, CardHeader, CardDescription, CardTitle, Checkbox, DeleteConfirmModal, ImageGrid, ImageGridCard, Input, Modal, Pagination, SearchInput, Skeleton, StatTile, StatusLabel, SurfaceCard, ViewSelect, parseViewShape, Select } from '../../../shared/components/ui';
import type { ViewShape } from '../../../shared/components/ui';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import { DesignTable } from './DesignTable';

const DESIGN_CATEGORIES = ['Logo', 'Abstract', 'Typography', 'Graphic', 'Pattern'];

/**
 * The categories the EDIT form offers.
 *
 * A `<select required>` whose value matches none of its options is an invalid
 * control, and the browser refuses to submit an invalid form — so a design whose
 * category is not one of the five (every seeded one: Branding, Apparel,
 * Patterns, Stationery) could not be saved at all, from any field. Its own
 * category is therefore listed too, rather than silently rewritten to one of the
 * five the moment the dialog is opened.
 */
function editCategories(current: string): string[] {
  if (!current || DESIGN_CATEGORIES.includes(current)) return DESIGN_CATEGORIES;
  return [current, ...DESIGN_CATEGORIES];
}

/** Mirrors `MAX_ASSET_BYTES` in `backend/src/services/designAssetService.ts`. */
const MAX_DESIGN_IMAGE_BYTES = 5 * 1024 * 1024;
/** Mirrors `ALLOWED_IMAGE_CONTENT_TYPES` in `backend/src/services/imageAssetService.ts`. */
const ALLOWED_DESIGN_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** The reason a picked file cannot be used, or `null` when it can. */
function rejectAsset(file: File): string | null {
  if (!ALLOWED_DESIGN_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPG, WebP, or SVG image.';
  if (file.size > MAX_DESIGN_IMAGE_BYTES) return 'Keep the image under 5 MB.';
  return null;
}

/** How many placeholder cards the grid shows while the designs load. */
const DESIGN_SKELETON_COUNT = 10;

/**
 * Which shape the repository is drawn in.
 *
 * The default here is `image`, the opposite of the stock surface's `list` —
 * the repository has always been a wall of artwork, and that is what the people
 * using it expect to land on. `?designView=list` asks for the table; an absent
 * param means the grid, so the common case stays a clean `/inventory`.
 */
const DEFAULT_DESIGN_VIEW: ViewShape = 'image';

/**
 * The loading form of this component's own card grid.
 *
 * It lives here, next to the markup it mirrors, rather than in
 * `shared/components/feedback` with the other skeletons: the shape — a square
 * thumbnail over a name bar, a date bar and a tag row — is `DesignRepository`'s
 * private layout, not a primitive anything else draws. `SectionCard` is kept
 * analytics-only for the same reason. The track is the shared `ImageGrid`, not a
 * copy of its breakpoints, so the placeholder cards cannot drift to a different
 * column count from the real ones they are standing in for.
 */
function DesignGridSkeleton() {
  return (
    <ImageGrid role="status" aria-busy="true" aria-label="Loading designs">
      {Array.from({ length: DESIGN_SKELETON_COUNT }, (_, index) => (
        <SurfaceCard key={index} className="overflow-hidden p-0">
          {/* `aspect-square` matches the thumbnail box, so the cards are the
              height they will be rather than a guessed one. Below it, the bars
              follow the real card's own grouping — a name line and a date line
              inside one block, then the tag row — because that is what sets the
              card's height. Measured: 313px real, 313px placeholder. */}
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-3 p-3">
            <div className="min-w-0">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-1 h-4 w-1/2" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          </div>
        </SurfaceCard>
      ))}
    </ImageGrid>
  );
}

export function DesignRepository() {
  const { designs, total, page, limit, isLoading, error, refresh, goToPage, addDesign, deleteDesign, updateDesign } = useDesigns();
  /*
   * The chosen view lives in the URL (D3), the same way the stock surface's
   * does: it survives a refresh, Back returns to the previous shape, and a link
   * can open the repository as a table. Picking the default CLEARS the param
   * rather than storing `?designView=image`.
   *
   * An unrecognised value falls back to the grid instead of rendering an empty
   * screen — a stale bookmark must still show the artwork.
   */
  // The clear value IS the default (see the stock surface): choosing the grid
  // removes the param rather than storing `?designView=image`.
  const [designViewParam, setDesignViewParam] = useUrlFilter('designView', DEFAULT_DESIGN_VIEW);
  const designView = parseViewShape(designViewParam, DEFAULT_DESIGN_VIEW);

  // Switching shape rebuilds the header that holds the picker, so focus is put
  // back on the rebuilt one. Same reason as the stock surface.
  useRefocusOnChange('button[aria-label="Design view"]', designView);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editDesignData, setEditDesignData] = useState<Design | null>(null);
  /** The designs the confirmed delete is about to take, named in full in the dialog. */
  const [designsToDelete, setDesignsToDelete] = useState<Design[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDesign, setNewDesign] = useState({ name: '', category: '' });
  /*
   * The chosen file for each form, held until submit. It is never read into the
   * form's own state: the upload runs on submit and only the Storage URL it
   * returns is persisted. The preview beside it is a local object URL, which is
   * why it is revoked below rather than kept.
   *
   * Neither form holds an editable image URL. The stored value is a Supabase
   * Storage link — an infrastructure detail with no meaning to an operator, and
   * one that used to be typeable, so any URL at all could be written into a
   * column this app renders as an image and hands to `window.open`.
   */
  const [addAsset, setAddAsset] = useState<File | null>(null);
  const [addPreviewUrl, setAddPreviewUrl] = useState<string | null>(null);
  const [editAsset, setEditAsset] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [assetError, setAssetError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // An object URL pins the whole file in memory until it is released, so each
  // one is revoked when it is replaced and when this component goes away.
  React.useEffect(() => () => { if (addPreviewUrl) URL.revokeObjectURL(addPreviewUrl); }, [addPreviewUrl]);
  React.useEffect(() => () => { if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl); }, [editPreviewUrl]);

  const filteredDesigns = designs.filter((design) =>
    design.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  /*
   * Tick state lives here. The rows on offer are the FILTERED ones, so a design
   * hidden by the search box cannot be deleted by accident — and because the
   * repository has no pager-less second list, the filtered set is also what the
   * header box means by "all".
   */
  const selection = useRowSelection(useMemo(() => filteredDesigns.map((design) => design.id), [filteredDesigns]));

  const openAddModal = () => {
    setNewDesign({ name: '', category: '' });
    setAddAsset(null);
    setAddPreviewUrl(null);
    setAssetError('');
    setIsAddModalOpen(true);
  };

  const handleAddAssetSelected = (file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    const rejection = rejectAsset(file);
    if (rejection) {
      setAssetError(rejection);
      return;
    }
    setAddAsset(file);
    setAddPreviewUrl(URL.createObjectURL(file));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetError('');
    setMutationError(null);

    /*
     * A design is artwork, and `designs.image_url` is `not null` — there is no
     * such thing as a design without one. There used to be a default placeholder
     * URL behind this field, but the file it points at was never shipped, so
     * submitting without a file produced a record whose image 404s.
     */
    if (!addAsset) {
      setAssetError('Choose an image to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(addAsset);
      const uploaded = await designsApi.uploadAsset({
        dataUrl,
        fileName: addAsset.name,
        contentType: addAsset.type,
        sizeBytes: addAsset.size,
      });
      await addDesign({
        name: newDesign.name,
        category: newDesign.category,
        imageUrl: uploaded.imageUrl,
        assetType: uploaded.assetType,
        assetSizeBytes: uploaded.assetSizeBytes,
      });
      setNewDesign({ name: '', category: '' });
      setAddAsset(null);
      setAddPreviewUrl(null);
      setIsAddModalOpen(false);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setMutationError(error.message);
      } else if (error instanceof Error) {
        setAssetError(error.message);
      } else {
        setAssetError('The image could not be uploaded.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const openEditModal = (design: Design) => {
    setEditDesignData({ ...design });
    // A file picked for a previous design must not be uploaded into this one.
    setEditAsset(null);
    setEditPreviewUrl(null);
    setAssetError('');
    setIsEditModalOpen(true);
  };

  const handleEditAssetSelected = (file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    const rejection = rejectAsset(file);
    if (rejection) {
      setAssetError(rejection);
      return;
    }
    setEditAsset(file);
    setEditPreviewUrl(URL.createObjectURL(file));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDesignData) return;
    setAssetError('');
    setMutationError(null);
    setIsUploading(true);
    try {
      /*
       * The artwork columns reach the server ONLY when a replacement was picked.
       * A rename omits them, so the stored Storage URL is never read back into
       * the browser to be echoed — which is what put it on screen before.
       */
      let image: { imageUrl: string; assetType: string; assetSizeBytes: number } | null = null;
      if (editAsset) {
        const dataUrl = await readFileAsDataUrl(editAsset);
        image = await designsApi.uploadAsset({
          dataUrl,
          fileName: editAsset.name,
          contentType: editAsset.type,
          sizeBytes: editAsset.size,
        });
      }
      await updateDesign(editDesignData.id, {
        name: editDesignData.name,
        category: editDesignData.category,
        ...(image
          ? { imageUrl: image.imageUrl, assetType: image.assetType, assetSizeBytes: image.assetSizeBytes }
          : {}),
      });
      setEditAsset(null);
      setEditPreviewUrl(null);
      setIsEditModalOpen(false);
      setEditDesignData(null);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setMutationError(error.message);
      } else if (error instanceof Error) {
        setAssetError(error.message);
      } else {
        setAssetError('The design could not be updated.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  /*
   * The toolbar's one delete control. It acts on whatever is ticked, exactly as
   * the stock table's does, so the confirmation names every design it is about
   * to take rather than a count.
   */
  const openDeleteSelected = () => {
    const targets = filteredDesigns.filter((design) => selection.selectedIds.has(design.id));
    if (targets.length === 0) return;
    setMutationError(null);
    setDesignsToDelete(targets);
    setIsDeleteConfirmOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteConfirmOpen(false);
    setDesignsToDelete([]);
  };

  const handleDelete = async () => {
    if (designsToDelete.length === 0 || isDeleting) return;
    const targets = designsToDelete;
    setMutationError(null);
    setIsDeleting(true);
    /*
     * One row at a time: `deleteDesign` is a single-row endpoint, and a bulk
     * route would be a backend change this screen does not need. Whatever fails
     * is reported by name, and the dialog keeps the survivors so the retry is one
     * click — the designs that did delete have already left the list, which drops
     * their ticks with them.
     */
    const failures: Design[] = [];
    try {
      for (const design of targets) {
        try {
          await deleteDesign(design.id);
        } catch {
          failures.push(design);
        }
      }
    } finally {
      // A throw between here and the close below would otherwise leave Confirm
      // spinning on a dialog that never goes away.
      setIsDeleting(false);
    }

    if (failures.length === 0) {
      selection.clear();
      closeDeleteModal();
      return;
    }
    setDesignsToDelete(failures);
    setMutationError(
      `${failures.length} of ${targets.length} designs could not be deleted: ${failures.map((design) => design.name).join(', ')}. The rest were removed.`,
    );
  };

  /*
   * The pager the repository has never rendered. The backend has paginated
   * designs all along (`listDesigns` uses `range` with an exact count), and the
   * store has always held one page of 20 — so the grid has been quietly showing
   * only the first 20 designs with no way to reach the rest. Both shapes get it
   * now, because hiding rows is not a property of how they are drawn.
   */
  const pager = total > limit
    ? <Pagination page={page} limit={limit} total={total} onPageChange={goToPage} />
    : undefined;

  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} onRetry={refresh} />}
      {mutationError && (
        <InlineAlert message={mutationError} onDismiss={() => setMutationError(null)} />
      )}

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Design Repository</CardTitle>
            <CardDescription>Search, upload, and manage reusable artwork assets for custom production.</CardDescription>
            {/*
              The count line, the same one the stock gallery carries: how many
              designs are on offer, replaced by "# items selected" while rows are
              ticked (ERPNext collapses the header to that message). Omitted
              entirely when there is nothing to count — "0 designs" beside "No
              designs found" states the same fact twice, and the empty state says
              it better.
            */}
            {selection.count === 0 && filteredDesigns.length === 0 ? null : (
              <p className="mt-2 text-2xs font-bold text-app-text-muted dark:text-zinc-500">
                {selection.count > 0
                  ? formatSelectedCount(selection.count)
                  : `${filteredDesigns.length} design${filteredDesigns.length === 1 ? '' : 's'}`}
              </p>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-2xl">
            {/*
              The same order every other list toolbar uses — view, search,
              refresh, delete, add — because it is the same row of controls. The
              delete square is only findable if it stays where the tables put it,
              and it now leads the pair of action squares rather than sitting
              alone, since the repository deletes in bulk like the rest.
            */}
            <ViewSelect value={designView} onChange={setDesignViewParam} ariaLabel="Design view" />
            <SearchInput className="flex-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => refresh()}
              aria-label="Refresh"
              title="Refresh"
              className="shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            {/*
              The repository's only delete control, and the same square the stock
              table carries: icon-only and gray (the tone of Cancel) so it does
              not advertise itself as destructive at a glance — the confirmation
              dialog does that work. Disabled until something is ticked, with the
              reason in the hover title.
            */}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={selection.count === 0}
              onClick={openDeleteSelected}
              aria-label={selection.count > 0 ? `Delete ${selection.count} selected design${selection.count === 1 ? '' : 's'}` : 'Delete selected designs'}
              title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} design${selection.count === 1 ? '' : 's'}`}
              className="shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            {/*
              A bare plus, to the right of delete and matching its geometry
              exactly: the words live in the accessible name, and the primary
              fill stays because uploading is still this screen's one dominant
              action (R23).
            */}
            <Button
              type="button"
              variant="primary"
              size="icon"
              onClick={openAddModal}
              aria-label="Upload Design"
              title="Upload Design"
              className="shrink-0"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        {/*
          The grid needs `CardContent`'s padding; the table brings its own row
          padding and must run to the card's edge like every other list table.
          Only the padding differs — the frame, the title, the search box and the
          Upload button are drawn in either shape, because none of them depends
          on the data.
        */}
        <CardContent className={designView === 'list' ? undefined : 'p-4'}>
          {isLoading ? (
            designView === 'list'
              ? <TableSkeleton columns={4} />
              : <DesignGridSkeleton />
          ) : designView === 'list' ? (
            <DesignTable
              designs={filteredDesigns}
              onEdit={(design) => openEditModal(design)}
              selection={selection}
              footer={pager}
            />
          ) : filteredDesigns.length > 0 ? (
            <ImageGrid>
              {/*
                The shared track, not a local one — the stock gallery renders the
                same grid, so a column-count change lands on both at once. What
                is specific to a design lives in the card's slots: its tick box,
                and the body below. Both grids now carry the same parts — the
                category moved out of the photo's corner so the box the bulk
                delete needs can have it.
              */}
              {filteredDesigns.map((design) => (
                <ImageGridCard
                  key={design.id}
                  imageUrl={design.imageUrl}
                  imageAlt={design.name}
                  /*
                   * The tick box replaces the category badge in this corner, the
                   * same trade the stock gallery makes: a card cannot carry both,
                   * and the box is the only way to reach the bulk delete. Unlike
                   * the stock gallery there is no `overlay` — View and Download
                   * now live in the edit modal, which is what clicking the card
                   * opens.
                   */
                  leading={
                    <span onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(design.id)}
                        onChange={() => selection.toggle(design.id)}
                        aria-label={`Select ${design.name}`}
                      />
                    </span>
                  }
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => openEditModal(design)}
                    title={`${design.name} — click to edit`}
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-app-ink dark:text-zinc-100">{design.name}</h3>
                      <p className="mt-1 text-2xs text-app-text-muted dark:text-zinc-500">Added {design.createdAt}</p>
                    </div>
                    <StatusLabel tone="gray" className="mt-2 text-2xs">{design.category}</StatusLabel>
                  </div>
                </ImageGridCard>
              ))}
            </ImageGrid>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed py-20">
              <EmptyState title="No designs found" message="Try adjusting your search or upload a new design." icon={<ImageIcon className="h-12 w-12 opacity-15" aria-hidden="true" />} className="gap-3" />
            </div>
          )}
        </CardContent>

        {/* The grid's own pager band. `DesignTable` renders its own in the list
            shape, so exactly one band is ever on screen. */}
        {designView !== 'list' && pager ? <div className="border-t px-4 py-3">{pager}</div> : null}
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Upload New Design" maxWidth="max-w-3xl">
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
          {/*
            The same two-column shape the Stock List's form uses: artwork on the
            left, the fields it is about on the right. The image is picked as a
            FILE — there is no URL box, because the only URL there ever was is
            the Storage link the upload returns.
          */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-3">
              <label htmlFor="design-image-add" className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Image</label>
              <div className="flex aspect-square max-h-[min(42vh,380px)] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border">
                {addPreviewUrl ? (
                  <img src={addPreviewUrl} alt={newDesign.name || 'Design preview'} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-5 text-center text-app-text-muted dark:text-zinc-500">
                    <ImageIcon className="h-14 w-14 opacity-40" aria-hidden="true" />
                    <span className="text-2xs font-bold">No image yet</span>
                  </div>
                )}
              </div>
              <Input id="design-image-add" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-app-accent file:px-3 file:py-1.5 file:text-2xs file:font-bold file:text-[var(--app-accent-ink)]" onChange={(event) => handleAddAssetSelected(event.target.files?.[0])} />
              {addAsset && <p className="text-2xs text-app-text-muted dark:text-zinc-500">Selected: {addAsset.name}</p>}
              {assetError && <InlineAlert variant="inline" message={assetError} />}
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" placeholder="Modern Minimalist Logo" value={newDesign.name} onChange={(e) => setNewDesign({ ...newDesign, name: e.target.value })} /></label>
              <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Category</span><Select required value={newDesign.category} onChange={(e) => setNewDesign({ ...newDesign, category: e.target.value })}><option value="">Select Category</option>{DESIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
            </div>
          </div>
          {mutationError && <InlineAlert message={mutationError} />}
          <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsAddModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth isLoading={isUploading}>{isUploading ? 'Uploading...' : 'Upload Design'}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Design" maxWidth="max-w-3xl">
        {editDesignData && (
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
            {/*
              Exactly the Stock List's arrangement: the current artwork, then the
              control that replaces it. The old form showed the stored URL in a
              text box instead — a staff member had no way to know what to type
              there, no way to swap the picture, and the Supabase Storage link
              (project host included) sat on screen, editable.
            */}
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="space-y-3">
                <label htmlFor="design-image-edit" className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Image</label>
                <div className="flex aspect-square max-h-[min(42vh,380px)] w-full items-center justify-center overflow-hidden rounded-[var(--radius-card)] border">
                  <img src={editPreviewUrl ?? editDesignData.imageUrl} alt={editDesignData.name} className="h-full w-full object-contain" />
                </div>
                <Input id="design-image-edit" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-auto cursor-pointer py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-app-accent file:px-3 file:py-1.5 file:text-2xs file:font-bold file:text-[var(--app-accent-ink)]" onChange={(event) => handleEditAssetSelected(event.target.files?.[0])} />
                {editAsset && <p className="text-2xs text-app-text-muted dark:text-zinc-500">Selected: {editAsset.name}</p>}
                {assetError && <InlineAlert variant="inline" message={assetError} />}
                <p className="text-2xs leading-relaxed text-app-text-muted dark:text-zinc-500">Choose a file to replace the artwork. Leave it empty and the current image is kept.</p>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" value={editDesignData.name} onChange={(e) => setEditDesignData({ ...editDesignData, name: e.target.value })} /></label>
                <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Category</span><Select required value={editDesignData.category} onChange={(e) => setEditDesignData({ ...editDesignData, category: e.target.value })}><option value="">Select Category</option>{editCategories(editDesignData.category).map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
                {/*
                  The two things the removed View modal was the only place to see:
                  when the design was added, and the download that hands over the
                  stored original. Both belong on the record's own screen — the
                  View dialog was a second screen that showed the same record and
                  one extra stat, which is not a screen.
                */}
                <StatTile label="Created Date" value={editDesignData.createdAt} />
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => window.open(editDesignData.imageUrl, '_blank', 'noopener,noreferrer')}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download Assets
                </Button>
              </div>
            </div>
            {mutationError && <InlineAlert message={mutationError} />}
            <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth isLoading={isUploading}>Save Changes</Button></div>
          </form>
        )}
      </Modal>

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        itemLabels={designsToDelete.map((design) => design.name)}
        isBusy={isDeleting}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
      />
    </div>
  );
}
