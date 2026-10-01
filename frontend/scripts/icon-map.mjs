/**
 * The PrintSync icon map — one source of truth for the name→glyph mapping.
 *
 * Key   = the export name call sites import (kept unchanged from lucide-react,
 *         so the swap touched import paths only).
 * Value = the Ionicons base name; the glyph file is `<value>-outline.svg` in
 *         the `ionicons` package.
 *
 * Shared by scripts/gen-icons.mjs (writes the module) and
 * scripts/gen-icon-preview.mjs (writes the review page).
 */
export const ICON_MAP = {
  AlertCircle: 'alert-circle',
  AlertTriangle: 'warning',
  ArrowRight: 'arrow-forward',
  BarChart3: 'bar-chart',
  Bell: 'notifications',
  Box: 'cube',
  Calendar: 'calendar',
  CheckCheck: 'checkmark-done',
  CheckCircle2: 'checkmark-circle',
  ChevronLeft: 'chevron-back',
  ChevronRight: 'chevron-forward',
  Clock: 'time',
  ClipboardList: 'clipboard',
  Download: 'download',
  Edit: 'create',
  Eye: 'eye',
  History: 'time',
  Image: 'image',
  Inbox: 'file-tray',
  LayoutDashboard: 'grid',
  LineChart: 'analytics',
  LoaderCircle: 'reload',
  Lock: 'lock-closed',
  Mail: 'mail',
  Minus: 'remove',
  Monitor: 'desktop',
  Moon: 'moon',
  Package: 'archive',
  PackageSearch: 'receipt',
  PanelLeft: 'menu',
  Phone: 'call',
  Plus: 'add',
  RefreshCw: 'refresh',
  RotateCw: 'sync',
  ScrollText: 'document-text',
  Search: 'search',
  Settings: 'settings',
  ShoppingBag: 'bag-handle',
  ShoppingCart: 'cart',
  Sun: 'sunny',
  Tag: 'pricetag',
  Trash2: 'trash',
  User: 'person',
  UserCircle: 'person-circle',
  Users: 'people',
  X: 'close',
};
