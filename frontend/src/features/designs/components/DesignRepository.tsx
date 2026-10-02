import React, { useState } from 'react';
import { Download, Edit, Eye, Image as ImageIcon, Plus, RefreshCw, Trash2 } from '../../../shared/components/ui/icons';

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
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DeleteConfirmModal, ImageGrid, ImageGridCard, Pagination, SearchInput, Skeleton, StatTile, StatTileRow, SurfaceCard, ViewSelect, parseViewShape, Input, Modal, Select } from '../../../shared/components/ui';
import type { ViewShape } from '../../../shared/components/ui';
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
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [designToDelete, setDesignToDelete] = useState<Design | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDesign, setNewDesign] = useState({ name: '', category: '' });
  const [editDesignData, setEditDesignData] = useState<Design | null>(null);
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

  const openViewModal = (design: Design) => {
    setSelectedDesign(design);
    setIsViewModalOpen(true);
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

  const confirmDelete = (design: Design) => {
    setDesignToDelete(design);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!designToDelete || isDeleting) return;
    setMutationError(null);
    setIsDeleting(true);
    try {
      await deleteDesign(designToDelete.id);
      setIsDeleteConfirmOpen(false);
      setDesignToDelete(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The design could not be deleted.');
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
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
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
            {/*
              The view picker leads this toolbar row too — left of the search
              box, the same place the stock table puts its own, so the two
              surfaces read alike. Below `md` the row is a column and it takes
              its own line rather than squeezing the search box.
            */}
            <ViewSelect value={designView} onChange={setDesignViewParam} ariaLabel="Design view" />
            <SearchInput className="flex-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {/*
              Re-reads the repository. This header has no delete square to sit to
              the left of, so it takes the other position the rule allows — on the
              right of the search box, the same place the Audit Log puts its own.
            */}
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
              A bare plus, the same control the list tables carry: the words moved
              into the accessible name, and the primary fill stays because
              uploading is still this screen's one dominant action (R23). Nothing
              sits to its left — a design is deleted from its own card, not in a
              batch, so this header has no delete square to pair with.
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
              ? <TableSkeleton columns={4} select={false} />
              : <DesignGridSkeleton />
          ) : designView === 'list' ? (
            <DesignTable
              designs={filteredDesigns}
              onView={(design) => openViewModal(design)}
              onEdit={(design) => openEditModal(design)}
              onDelete={(design) => confirmDelete(design)}
              footer={pager}
            />
          ) : filteredDesigns.length > 0 ? (
            <ImageGrid>
              {/*
                The shared track, not a local one — the stock gallery renders the
                same grid, so a column-count change lands on both at once. What
                is specific to a design lives in the card's slots: its category
                badge, its View / Download pair, and the body below.
              */}
              {filteredDesigns.map((design) => (
                <ImageGridCard
                  key={design.id}
                  imageUrl={design.imageUrl}
                  imageAlt={design.name}
                  leading={<Badge variant="accent">{design.category}</Badge>}
                  overlay={
                    <>
                      <Button type="button" variant="secondary" size="icon" onClick={() => openViewModal(design)} title="View details" className="rounded-full bg-[#3a3a3c] text-white ring-[#6b6b6d] hover:bg-[#525254]">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button type="button" variant="secondary" size="icon" onClick={() => window.open(design.imageUrl, '_blank', 'noopener,noreferrer')} title="Download design" className="rounded-full bg-[#3a3a3c] text-white ring-[#6b6b6d] hover:bg-[#525254]">
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-app-ink dark:text-zinc-100">{design.name}</h3>
                      <p className="mt-1 text-2xs text-app-text-muted dark:text-zinc-500">Added {design.createdAt}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEditModal(design)} title="Edit design" className="h-8 w-8"><Edit className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => confirmDelete(design)} title="Delete design" className="h-8 w-8 text-app-danger hover:text-app-danger"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                    </div>
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

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={selectedDesign?.name || 'Design View'} maxWidth="max-w-2xl">
        {selectedDesign && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-[var(--radius-card)] border"><img src={selectedDesign.imageUrl} alt={selectedDesign.name} className="h-full w-full object-contain" /></div>
            <div className="space-y-4">
              <div><h4 className="mb-1 label-caps text-app-text-muted">Design Information</h4><p className="text-xl font-bold text-app-ink dark:text-zinc-100">{selectedDesign.name}</p><Badge variant="accent" className="mt-2">{selectedDesign.category}</Badge></div>
              <StatTileRow columns={2}>
                <StatTile label="Reference ID" value={`#${selectedDesign.id}`} />
                <StatTile label="Created Date" value={selectedDesign.createdAt} />
              </StatTileRow>
              <Button fullWidth onClick={() => window.open(selectedDesign.imageUrl, '_blank', 'noopener,noreferrer')}>Download Assets</Button>
            </div>
          </div>
        )}
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
              </div>
            </div>
            {mutationError && <InlineAlert message={mutationError} />}
            <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth isLoading={isUploading}>Save Changes</Button></div>
          </form>
        )}
      </Modal>

      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        itemLabels={designToDelete ? [designToDelete.name] : []}
        isBusy={isDeleting}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
