import React, { useState } from 'react';
import { Download, Edit, Eye, Image as ImageIcon, Plus, RefreshCw, Tag, Trash2 } from '../../../shared/components/ui/icons';

import { designsApi } from '../api/designsApi';
import { useDesigns } from '../../../app/stores/useDesignStore';
import type { CreateDesign, Design } from '../types';
import { DEFAULT_NEW_DESIGN_IMAGE_URL } from '../../../shared/constants/designImages';
import { readFileAsDataUrl } from '../../../shared/lib/readFileAsDataUrl';
import { ApiError } from '../../../shared/api/errors';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { TableSkeleton } from '../../../shared/components/feedback/TableSkeleton';
import { cn } from '../../../shared/lib/cn';
import { useUrlFilter } from '../../../shared/hooks/useUrlFilter';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DeleteConfirmModal, ImageGrid, ImageGridCard, Pagination, SearchInput, Skeleton, StatTile, StatTileRow, SurfaceCard, Input, Modal, Select } from '../../../shared/components/ui';
import { DesignTable } from './DesignTable';

const DESIGN_CATEGORIES = ['Logo', 'Abstract', 'Typography', 'Graphic', 'Pattern'];

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
const DESIGN_VIEWS = ['image', 'list'] as const;
type DesignView = (typeof DESIGN_VIEWS)[number];
const DEFAULT_DESIGN_VIEW: DesignView = 'image';

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
  const [designViewParam, setDesignViewParam] = useUrlFilter('designView', '');
  const designView: DesignView = DESIGN_VIEWS.includes(designViewParam as DesignView)
    ? (designViewParam as DesignView)
    : DEFAULT_DESIGN_VIEW;
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [designToDelete, setDesignToDelete] = useState<Design | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDesign, setNewDesign] = useState<CreateDesign>({ name: '', category: '', imageUrl: '', tags: [], assetType: null, assetSizeBytes: null });
  const [editDesignData, setEditDesignData] = useState<Design | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<File | null>(null);
  const [assetError, setAssetError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const filteredDesigns = designs.filter((design) =>
    design.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    design.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetError('');
    setMutationError(null);
    setIsUploading(true);
    let imageUrl = newDesign.imageUrl || DEFAULT_NEW_DESIGN_IMAGE_URL;
    let assetType: string | null = null;
    let assetSizeBytes: number | null = null;

    try {
      if (selectedAsset) {
        const dataUrl = await readFileAsDataUrl(selectedAsset);
        const uploaded = await designsApi.uploadAsset({
          dataUrl,
          fileName: selectedAsset.name,
          contentType: selectedAsset.type,
          sizeBytes: selectedAsset.size,
        });
        imageUrl = uploaded.imageUrl;
        assetType = uploaded.assetType;
        assetSizeBytes = uploaded.assetSizeBytes;
      }
      await addDesign({ ...newDesign, imageUrl, assetType, assetSizeBytes });
      setNewDesign({ name: '', category: '', imageUrl: '', tags: [], assetType: null, assetSizeBytes: null });
      setSelectedAsset(null);
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

  const handleAssetSelected = (file: File | undefined) => {
    setAssetError('');
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setAssetError('Use a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAssetError('Keep the image under 5 MB.');
      return;
    }
    setSelectedAsset(file);
    setNewDesign((previous) => ({ ...previous, imageUrl: '' }));
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      setNewDesign((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewDesign((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }));
  };

  const openViewModal = (design: Design) => {
    setSelectedDesign(design);
    setIsViewModalOpen(true);
  };

  const openEditModal = (design: Design) => {
    setEditDesignData({ ...design });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDesignData) return;
    setMutationError(null);
    try {
      await updateDesign(editDesignData.id, {
        name: editDesignData.name,
        category: editDesignData.category,
        imageUrl: editDesignData.imageUrl,
        tags: editDesignData.tags,
      });
      setIsEditModalOpen(false);
      setEditDesignData(null);
    } catch (error: unknown) {
      setMutationError(error instanceof ApiError ? error.message : 'The design could not be updated.');
    }
  };

  const handleEditAddTag = () => {
    if (editTagInput.trim() && editDesignData) {
      setEditDesignData((prev) => prev ? ({ ...prev, tags: [...prev.tags, editTagInput.trim()] }) : null);
      setEditTagInput('');
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    if (editDesignData) {
      setEditDesignData((prev) => prev ? ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }) : null);
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

      <div className="flex flex-wrap items-center gap-2">
        {/*
          TEMPORARY: a plain two-button toggle, replaced by the ERPNext-style
          dropdown in P5. Switchers are the look the Boss retired, so this is
          scaffolding to keep this phase about the table itself — not a pattern
          to copy. It sits at the leading edge, where the dropdown will go.
        */}
        {DESIGN_VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setDesignViewParam(view === DEFAULT_DESIGN_VIEW ? '' : view)}
            aria-pressed={designView === view}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1.5 text-2xs font-bold',
              designView === view
                ? 'bg-[var(--app-state-hover-sub)] text-app-ink dark:text-zinc-100'
                : 'border text-app-text-muted hover:bg-[var(--app-state-hover)] hover:text-app-ink dark:text-zinc-400 dark:hover:bg-[var(--app-tint-neutral)] dark:hover:text-zinc-200',
            )}
          >
            {view === 'list' ? 'List View' : 'Image View'}
          </button>
        ))}
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>

            <CardTitle>Design Repository</CardTitle>
            <CardDescription>Search, upload, and manage reusable artwork assets for custom production.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
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
              onClick={() => setIsAddModalOpen(true)}
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
                  <div className="flex flex-wrap gap-1">
                    {design.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="gray" className="gap-1"><Tag className="h-2.5 w-2.5" aria-hidden="true" />{tag}</Badge>)}
                    {design.tags.length > 3 && <Badge variant="neutral">+{design.tags.length - 3}</Badge>}
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

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Upload New Design">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" placeholder="Modern Minimalist Logo" value={newDesign.name} onChange={(e) => setNewDesign({ ...newDesign, name: e.target.value })} /></label>
          <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Category</span><Select required value={newDesign.category} onChange={(e) => setNewDesign({ ...newDesign, category: e.target.value })}><option value="">Select Category</option>{DESIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
          <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Upload Image (Optional)</span><Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="h-auto py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-app-accent file:px-3 file:py-1.5 file:text-2xs file:font-bold file:text-[var(--app-accent-ink)]" onChange={(event) => handleAssetSelected(event.target.files?.[0])} />{selectedAsset && <p className="text-2xs text-app-text-muted dark:text-zinc-500">Selected: {selectedAsset.name}</p>}</label>
          <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Image URL (Optional)</span><Input type="text" placeholder="https://images.unsplash.com/..." value={newDesign.imageUrl} onChange={(e) => setNewDesign({ ...newDesign, imageUrl: e.target.value })} /></label>
          {assetError && <InlineAlert variant="inline" message={assetError} />}
          <div className="space-y-2">
            <span className="block text-2xs font-bold text-app-text-muted dark:text-zinc-500">Tags</span>
            <div className="flex gap-2"><Input type="text" placeholder="Add a tag..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} /><Button type="button" variant="secondary" onClick={handleAddTag}>Add</Button></div>
            <div className="flex flex-wrap gap-1.5">{newDesign.tags.map((tag) => <Badge key={tag} variant="accent" className="gap-1">{tag}<button type="button" onClick={() => removeTag(tag)} className="cursor-pointer"><Plus className="h-3 w-3 rotate-45" aria-hidden="true" /></button></Badge>)}</div>
          </div>
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
              <div className="space-y-2"><h4 className="label-caps text-app-text-muted">Tags</h4><div className="flex flex-wrap gap-1.5">{selectedDesign.tags.map((tag) => <Badge key={tag} variant="gray">{tag}</Badge>)}</div></div>
              <Button fullWidth onClick={() => window.open(selectedDesign.imageUrl, '_blank', 'noopener,noreferrer')}>Download Assets</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Design">
        {editDesignData && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Design Name</span><Input required type="text" value={editDesignData.name} onChange={(e) => setEditDesignData({ ...editDesignData, name: e.target.value })} /></label>
            <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Category</span><Select required value={editDesignData.category} onChange={(e) => setEditDesignData({ ...editDesignData, category: e.target.value })}><option value="">Select Category</option>{DESIGN_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</Select></label>
            <label className="block space-y-1.5"><span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Image URL</span><Input type="text" value={editDesignData.imageUrl} onChange={(e) => setEditDesignData({ ...editDesignData, imageUrl: e.target.value })} /></label>
            <div className="space-y-2"><span className="block text-2xs font-bold text-app-text-muted dark:text-zinc-500">Tags</span><div className="flex gap-2"><Input type="text" placeholder="Add a tag..." value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEditAddTag())} /><Button type="button" variant="secondary" onClick={handleEditAddTag}>Add</Button></div><div className="flex flex-wrap gap-1.5">{editDesignData.tags.map((tag) => <Badge key={tag} variant="accent" className="gap-1">{tag}<button type="button" onClick={() => removeEditTag(tag)} className="cursor-pointer"><Plus className="h-3 w-3 rotate-45" aria-hidden="true" /></button></Badge>)}</div></div>
            <div className="flex gap-3 border-t pt-4"><Button type="button" variant="secondary" fullWidth onClick={() => setIsEditModalOpen(false)}>Cancel</Button><Button type="submit" fullWidth>Save Changes</Button></div>
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
