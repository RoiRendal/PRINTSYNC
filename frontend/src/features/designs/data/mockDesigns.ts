import { designImagePublicUrl } from '../../../shared/constants/designImages';
import type { Design } from '../types';

export const MOCK_DESIGNS: Design[] = [
  { id: 'DSG-001', name: 'Logo/Design 1', category: 'Retro', imageUrl: designImagePublicUrl('DSG-001'), createdAt: '2026-01-12', tags: ['City', 'Vintage', 'Art'] },
  { id: 'DSG-002', name: 'Logo/Design 2', category: 'Abstract', imageUrl: designImagePublicUrl('DSG-002'), createdAt: '2026-02-03', tags: ['Simple', 'Modern'] },
  { id: 'DSG-003', name: 'Logo/Design 3', category: 'Summer', imageUrl: designImagePublicUrl('DSG-003'), createdAt: '2026-02-20', tags: ['Bright', 'Floral'] },
  { id: 'DSG-004', name: 'Logo/Design 4', category: 'Tech', imageUrl: designImagePublicUrl('DSG-004'), createdAt: '2026-03-08', tags: ['Futuristic', 'Neon'] },
];
