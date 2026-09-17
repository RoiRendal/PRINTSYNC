/**
 * Static reference data for the PrintSync demo dataset.
 *
 * Everything here is fictional: a mid-size print shop in Batangas with a
 * walk-in counter, a handful of school and business accounts, and four months
 * of trading history. Prices are in peso and anchored to Philippine print-shop
 * rates (tarpaulin around 35/sq ft, photo paper around 20-30/sheet).
 *
 * `targetStock` is the stock level the shop should show *after* the seeded
 * history is replayed. The seeder works backwards from it so that no sale ever
 * runs the shelf negative mid-replay.
 */

export interface ProductSeed {
  sku: string;
  name: string;
  category: string;
  /** How the unit is counted on a sale line; shown in notes only. */
  unit: string;
  cost: number;
  price: number;
  targetStock: number;
  reorderLevel: number;
  /** Relative chance this item lands in a basket. */
  weight: number;
  /** Largest quantity a single walk-in line realistically reaches. */
  maxQty: number;
}

export const PRODUCTS: readonly ProductSeed[] = [
  { sku: 'TRP-SQF', name: 'Tarpaulin Printing (per sq ft)', category: 'Tarpaulin', unit: 'sq ft', cost: 18, price: 35, targetStock: 880, reorderLevel: 250, weight: 10, maxQty: 60 },
  { sku: 'TRP-8X4', name: 'Tarpaulin 8ft x 4ft (printed)', category: 'Tarpaulin', unit: 'pc', cost: 576, price: 1120, targetStock: 22, reorderLevel: 8, weight: 4, maxQty: 4 },
  { sku: 'TRP-3X6', name: 'Tarpaulin 3ft x 6ft (printed)', category: 'Tarpaulin', unit: 'pc', cost: 324, price: 630, targetStock: 26, reorderLevel: 10, weight: 5, maxQty: 6 },
  { sku: 'TRP-EYE', name: 'Tarpaulin with Eyelets (per sq ft)', category: 'Tarpaulin', unit: 'sq ft', cost: 24, price: 45, targetStock: 380, reorderLevel: 120, weight: 4, maxQty: 40 },

  { sku: 'LFM-SINTRA', name: 'Sintra Board 3mm (per sq ft)', category: 'Large Format', unit: 'sq ft', cost: 55, price: 110, targetStock: 15, reorderLevel: 20, weight: 3, maxQty: 20 },
  { sku: 'LFM-POSTER', name: 'Poster Printing A2 (per pc)', category: 'Large Format', unit: 'pc', cost: 45, price: 120, targetStock: 58, reorderLevel: 20, weight: 5, maxQty: 10 },
  { sku: 'LFM-CANVAS', name: 'Canvas Print 12x18 (per pc)', category: 'Large Format', unit: 'pc', cost: 180, price: 420, targetStock: 22, reorderLevel: 8, weight: 2, maxQty: 4 },
  { sku: 'LFM-STAND', name: 'X-Banner Standee (per set)', category: 'Large Format', unit: 'set', cost: 550, price: 1250, targetStock: 11, reorderLevel: 5, weight: 2, maxQty: 2 },

  { sku: 'STK-VINYL', name: 'Vinyl Sticker (per sq ft)', category: 'Stickers & Decals', unit: 'sq ft', cost: 45, price: 95, targetStock: 175, reorderLevel: 60, weight: 6, maxQty: 25 },
  { sku: 'STK-DIECUT', name: 'Die-Cut Sticker 3x3 (per pc)', category: 'Stickers & Decals', unit: 'pc', cost: 8, price: 25, targetStock: 820, reorderLevel: 250, weight: 8, maxQty: 50 },
  { sku: 'STK-LABEL', name: 'Label Sticker A4 (per sheet)', category: 'Stickers & Decals', unit: 'sheet', cost: 12, price: 30, targetStock: 230, reorderLevel: 80, weight: 5, maxQty: 20 },
  { sku: 'STK-REFLEC', name: 'Reflectorized Decal (per pc)', category: 'Stickers & Decals', unit: 'pc', cost: 35, price: 90, targetStock: 85, reorderLevel: 30, weight: 2, maxQty: 10 },

  { sku: 'PPR-GLOSS', name: 'Glossy Photo Paper A4 (per pc)', category: 'Photo & Paper', unit: 'pc', cost: 6, price: 20, targetStock: 1150, reorderLevel: 300, weight: 9, maxQty: 40 },
  { sku: 'PPR-MATTE', name: 'Matte Photo Paper 220gsm A4', category: 'Photo & Paper', unit: 'pc', cost: 9, price: 30, targetStock: 120, reorderLevel: 150, weight: 5, maxQty: 30 },
  { sku: 'PPR-A3', name: 'Photo Paper A3 (per pc)', category: 'Photo & Paper', unit: 'pc', cost: 18, price: 55, targetStock: 245, reorderLevel: 80, weight: 4, maxQty: 15 },
  { sku: 'PPR-4R', name: 'Photo Print 4R (per pc)', category: 'Photo & Paper', unit: 'pc', cost: 4, price: 15, targetStock: 1440, reorderLevel: 400, weight: 9, maxQty: 50 },
  { sku: 'PPR-BONDA4', name: 'A4 Bond Paper (ream, 500s)', category: 'Photo & Paper', unit: 'ream', cost: 165, price: 250, targetStock: 82, reorderLevel: 30, weight: 6, maxQty: 10 },
  { sku: 'PPR-LONGB', name: 'Long Bond Paper (ream)', category: 'Photo & Paper', unit: 'ream', cost: 180, price: 270, targetStock: 44, reorderLevel: 20, weight: 4, maxQty: 6 },

  { sku: 'CRD-BCMATTE', name: 'Business Cards Matte (100 pcs)', category: 'Cards & Stationery', unit: 'box', cost: 180, price: 450, targetStock: 36, reorderLevel: 12, weight: 5, maxQty: 4 },
  { sku: 'CRD-BCUV', name: 'Business Cards UV Spot (100 pcs)', category: 'Cards & Stationery', unit: 'box', cost: 260, price: 650, targetStock: 8, reorderLevel: 10, weight: 3, maxQty: 3 },
  { sku: 'CRD-FLYER', name: 'Flyers A4 Colored (100 pcs)', category: 'Cards & Stationery', unit: 'pack', cost: 220, price: 550, targetStock: 52, reorderLevel: 20, weight: 6, maxQty: 6 },
  { sku: 'CRD-BROCH', name: 'Brochure Tri-fold A4 (100 pcs)', category: 'Cards & Stationery', unit: 'pack', cost: 480, price: 1100, targetStock: 20, reorderLevel: 8, weight: 3, maxQty: 3 },
  { sku: 'CRD-CERT', name: 'Certificate Printing (per pc)', category: 'Cards & Stationery', unit: 'pc', cost: 25, price: 80, targetStock: 170, reorderLevel: 60, weight: 4, maxQty: 30 },
  { sku: 'CRD-IDLACE', name: 'ID Card with Lace (per pc)', category: 'Cards & Stationery', unit: 'pc', cost: 55, price: 150, targetStock: 105, reorderLevel: 40, weight: 4, maxQty: 20 },

  { sku: 'INK-BLACK', name: 'Black Toner Cartridge', category: 'Toner & Ink', unit: 'pc', cost: 1350, price: 1800, targetStock: 5, reorderLevel: 6, weight: 3, maxQty: 2 },
  { sku: 'INK-CYAN', name: 'Cyan Toner Cartridge', category: 'Toner & Ink', unit: 'pc', cost: 1350, price: 1800, targetStock: 4, reorderLevel: 6, weight: 2, maxQty: 2 },
  { sku: 'INK-MAGENTA', name: 'Magenta Toner Cartridge', category: 'Toner & Ink', unit: 'pc', cost: 1350, price: 1800, targetStock: 16, reorderLevel: 6, weight: 2, maxQty: 2 },
  { sku: 'INK-YELLOW', name: 'Yellow Toner Cartridge', category: 'Toner & Ink', unit: 'pc', cost: 1350, price: 1800, targetStock: 14, reorderLevel: 6, weight: 2, maxQty: 2 },
  { sku: 'INK-EPSON', name: 'Epson 003 Ink Bottle Black', category: 'Toner & Ink', unit: 'bottle', cost: 220, price: 350, targetStock: 19, reorderLevel: 8, weight: 4, maxQty: 4 },

  { sku: 'APP-COTTON', name: 'T-Shirt Printing Cotton (per pc)', category: 'Apparel', unit: 'pc', cost: 165, price: 350, targetStock: 62, reorderLevel: 25, weight: 5, maxQty: 20 },
  { sku: 'APP-DRIFIT', name: 'Dri-Fit Shirt Printing (per pc)', category: 'Apparel', unit: 'pc', cost: 240, price: 450, targetStock: 46, reorderLevel: 20, weight: 4, maxQty: 15 },
  { sku: 'APP-TOTE', name: 'Tote Bag Printing (per pc)', category: 'Apparel', unit: 'pc', cost: 85, price: 200, targetStock: 57, reorderLevel: 20, weight: 3, maxQty: 10 },

  { sku: 'GIV-MUG', name: 'Sublimation Mug (per pc)', category: 'Giveaways', unit: 'pc', cost: 95, price: 220, targetStock: 52, reorderLevel: 20, weight: 3, maxQty: 10 },
  { sku: 'GIV-KEYCHAIN', name: 'Acrylic Keychain (per pc)', category: 'Giveaways', unit: 'pc', cost: 28, price: 85, targetStock: 124, reorderLevel: 40, weight: 4, maxQty: 20 },
  { sku: 'GIV-MOUSEPAD', name: 'Mousepad Printing (per pc)', category: 'Giveaways', unit: 'pc', cost: 75, price: 180, targetStock: 37, reorderLevel: 15, weight: 2, maxQty: 6 },

  { sku: 'FIN-LAM', name: 'Lamination A4 (per pc)', category: 'Finishing', unit: 'pc', cost: 8, price: 25, targetStock: 360, reorderLevel: 120, weight: 7, maxQty: 30 },
  { sku: 'FIN-SPIRAL', name: 'Spiral Binding (per book)', category: 'Finishing', unit: 'pc', cost: 35, price: 90, targetStock: 80, reorderLevel: 30, weight: 4, maxQty: 10 },
  { sku: 'FIN-CUT', name: 'Cutting / Trimming (per job)', category: 'Finishing', unit: 'job', cost: 15, price: 40, targetStock: 190, reorderLevel: 60, weight: 5, maxQty: 10 },
];

export interface CustomerSeed {
  name: string;
  phone: string;
  email: string;
  notes: string;
  /** Relative chance this account appears on a job. */
  weight: number;
}

export const CUSTOMERS: readonly CustomerSeed[] = [
  { name: 'Maria Santos', phone: '0917 123 4567', email: 'maria.santos@gmail.com', notes: 'Walk-in regular. Prefers glossy finish.', weight: 6 },
  { name: 'Jose Ramos', phone: '0918 234 5678', email: 'joseramos@yahoo.com', notes: 'Pays in full on pickup.', weight: 5 },
  { name: 'Ana Reyes', phone: '0919 345 6789', email: 'ana.reyes@gmail.com', notes: 'School teacher, seasonal certificate orders.', weight: 5 },
  { name: 'Carlo Dela Cruz', phone: '0920 456 7890', email: 'carlo.delacruz@gmail.com', notes: 'Asks for rush jobs, pays rush fee.', weight: 4 },
  { name: 'Liza Mendoza', phone: '0921 567 8901', email: 'lizamendoza@outlook.com', notes: 'Booked a wedding invitation package.', weight: 4 },
  { name: 'Ramon Aquino', phone: '0922 678 9012', email: 'ramon.aquino@gmail.com', notes: 'Sari-sari store owner, tarpaulin every quarter.', weight: 5 },
  { name: 'Grace Villanueva', phone: '0923 789 0123', email: 'grace.v@gmail.com', notes: 'Prefers matte photo paper.', weight: 4 },
  { name: 'Mark Bautista', phone: '0924 890 1234', email: 'markbautista@gmail.com', notes: 'Team jerseys for local league.', weight: 3 },
  { name: 'Jennylyn Castro', phone: '0925 901 2345', email: 'jen.castro@gmail.com', notes: 'Online seller, needs product labels monthly.', weight: 5 },
  { name: 'Aristotle Tolentino', phone: '0926 012 3456', email: 'ari.tolentino@gmail.com', notes: 'Pays 50% downpayment always.', weight: 4 },
  { name: 'Rowena Bautista', phone: '0927 123 4560', email: 'rowena.b@gmail.com', notes: 'Requests itemized receipts for reimbursement.', weight: 3 },
  { name: 'Danilo Mercado', phone: '0928 234 5671', email: 'danilo.mercado@gmail.com', notes: 'Barangay official, fiesta banners.', weight: 4 },
  { name: 'Michelle Ferrer', phone: '0929 345 6782', email: 'michelle.ferrer@gmail.com', notes: 'Photography hobbyist, canvas prints.', weight: 3 },
  { name: 'Bernard Ignacio', phone: '0930 456 7893', email: 'bernard.ignacio@gmail.com', notes: 'Walk-in, small volume.', weight: 3 },
  { name: 'Kristine Salazar', phone: '0931 567 8904', email: 'kristine.salazar@gmail.com', notes: 'Orders giveaways for birthdays.', weight: 3 },
  { name: 'Ricardo Punzalan', phone: '0932 678 9015', email: 'ricardo.punzalan@gmail.com', notes: 'Real estate agent, for-sale standees.', weight: 5 },
  { name: 'Maricel Ong', phone: '0933 789 0126', email: 'maricel.ong@gmail.com', notes: 'Coffee shop owner, menu boards.', weight: 4 },
  { name: 'Ferdinand Lucas', phone: '0934 890 1237', email: 'ferdinand.lucas@gmail.com', notes: 'Needs lamination for permits.', weight: 3 },
  { name: 'Maharlika Elementary School', phone: '043 723 1100', email: 'records@maharlika.edu.ph', notes: 'School account. Net 15 terms, PO required.', weight: 6 },
  { name: 'Sampaguita Learning Center', phone: '043 723 2244', email: 'admin@sampaguita.edu.ph', notes: 'Enrollment banners every June.', weight: 5 },
  { name: 'Bayanihan Institute of Technology', phone: '043 756 8800', email: 'procurement@bayanhantech.edu.ph', notes: 'Bulk ID cards each semester.', weight: 5 },
  { name: 'Reyes Realty and Brokerage', phone: '043 757 3311', email: 'hello@reyesrealty.ph', notes: 'Corporate account. For-sale standees and cards.', weight: 5 },
  { name: 'Brew House Coffee', phone: '043 300 4455', email: 'brewhouse.coffee@gmail.com', notes: 'Menu boards, sticker labels, staff shirts.', weight: 4 },
  { name: 'Lipa City Dental Clinic', phone: '043 756 9900', email: 'lipadental@gmail.com', notes: 'Appointment cards and flyers.', weight: 3 },
  { name: 'Golden Harvest Traders', phone: '043 980 1122', email: 'goldenharvest@gmail.com', notes: 'Product labels every two weeks.', weight: 5 },
  { name: 'Tahanan Home Furniture', phone: '043 757 6600', email: 'tahanan.furniture@gmail.com', notes: 'Large format posters for sales events.', weight: 3 },
  { name: 'Kahel Wellness Spa', phone: '043 312 7788', email: 'kahelspa@gmail.com', notes: 'Gift certificates and mugs.', weight: 3 },
  { name: 'Pinoy Builders Cooperative', phone: '043 723 5566', email: 'pinoybuilderscoop@gmail.com', notes: 'Safety signage and reflectorized decals.', weight: 4 },
  { name: 'Sikat Barangay Council', phone: '043 740 2233', email: 'barangaysikat@gmail.com', notes: 'Community banners, paid by voucher.', weight: 4 },
  { name: 'Rosario Town Fiesta Committee', phone: '043 321 9000', email: 'rosariofiesta@gmail.com', notes: 'Annual fiesta tarpaulin, biggest single job.', weight: 3 },
];

export interface SupplierSeed {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export const SUPPLIERS: readonly SupplierSeed[] = [
  { name: 'Paperline Trading Corp.', contactPerson: 'Rodel Cruz', phone: '02 8370 1122', email: 'sales@paperlinetrading.ph', address: '112 E. Rodriguez Ave., Quezon City' },
  { name: 'InkPlus Philippines', contactPerson: 'Maricel Ong', phone: '02 8556 7788', email: 'orders@inkplus.ph', address: '45 Shaw Blvd., Mandaluyong City' },
  { name: 'Batangas Tarp Supply', contactPerson: 'Danny Mercado', phone: '043 723 4455', email: 'batangastarp@gmail.com', address: 'P. Burgos St., Batangas City' },
  { name: 'VJ Graphic Arts, Inc.', contactPerson: 'Alvin Tan', phone: '02 8921 3344', email: 'info@vjgraphicarts.com', address: '88 Timog Ave., Quezon City' },
  { name: 'SubliCraft Enterprises', contactPerson: 'Karen Villamor', phone: '043 756 2211', email: 'hello@sublicraft.ph', address: 'Ayala Highway, Lipa, Batangas' },
  { name: 'Metro Print Finishing', contactPerson: 'Ronald Sy', phone: '02 8712 9900', email: 'metroprintfinishing@gmail.com', address: '23 Blumentritt St., Manila' },
];

export interface DesignSeed {
  name: string;
  category: string;
  tags: string[];
}

export const DESIGNS: readonly DesignSeed[] = [
  { name: 'Grand Opening Tarp - Sari-Sari Store', category: 'Tarpaulin', tags: ['grand opening', 'tarpaulin', 'retail'] },
  { name: 'Enrollment Banner Layout A3', category: 'Tarpaulin', tags: ['school', 'enrollment', 'banner'] },
  { name: 'Barangay Fiesta Tarp 8x4', category: 'Tarpaulin', tags: ['fiesta', 'community', 'tarpaulin'] },
  { name: 'Coffee Shop Menu Board', category: 'Large Format', tags: ['menu', 'food', 'poster'] },
  { name: 'For Sale Standee - Reyes Realty', category: 'Large Format', tags: ['real estate', 'standee', 'corporate'] },
  { name: 'Die-Cut Logo Stickers - Brew House', category: 'Stickers & Decals', tags: ['logo', 'die-cut', 'branding'] },
  { name: 'Product Label - Golden Harvest Honey', category: 'Stickers & Decals', tags: ['label', 'product', 'food'] },
  { name: 'Wedding Invitation Suite', category: 'Cards & Stationery', tags: ['wedding', 'invitation', 'premium'] },
  { name: 'Business Card - Reyes Realty', category: 'Cards & Stationery', tags: ['business card', 'corporate', 'minimal'] },
  { name: 'Certificate of Appreciation', category: 'Cards & Stationery', tags: ['certificate', 'school', 'formal'] },
  { name: 'Class Reunion T-Shirt Design', category: 'Apparel', tags: ['reunion', 't-shirt', 'school'] },
  { name: 'Team Building Jersey Layout', category: 'Apparel', tags: ['jersey', 'corporate', 'team'] },
  { name: 'Personalized Mug - Teacher Gift', category: 'Giveaways', tags: ['mug', 'gift', 'sublimation'] },
  { name: 'Acrylic Keychain - Paw Prints', category: 'Giveaways', tags: ['keychain', 'pet', 'acrylic'] },
  { name: 'Restaurant Flyer - Buy 1 Take 1', category: 'Cards & Stationery', tags: ['flyer', 'promo', 'food'] },
];

export interface ExpenseSeed {
  category: string;
  description: string;
  /** Typical monthly amount; the seeder varies it. */
  amount: number;
  /** How many times per month this recurs. */
  perMonth: number;
}

export const EXPENSE_TEMPLATES: readonly ExpenseSeed[] = [
  { category: 'Rent', description: 'Shop rental - P. Burgos St.', amount: 15000, perMonth: 1 },
  { category: 'Electricity', description: 'Meralco bill - shop and machines', amount: 8200, perMonth: 1 },
  { category: 'Water', description: 'Batangas City Water District', amount: 650, perMonth: 1 },
  { category: 'Internet & Phone', description: 'Fiber plan and landline', amount: 1899, perMonth: 1 },
  { category: 'Salaries', description: 'Press operator and counter staff wages', amount: 16000, perMonth: 2 },
  { category: 'Machine Maintenance', description: 'Printer servicing and parts', amount: 3800, perMonth: 1 },
  { category: 'Toner & Supplies', description: 'Replenishment of inks and toners', amount: 6400, perMonth: 2 },
  { category: 'Transportation', description: 'Delivery and supplier pickups', amount: 2200, perMonth: 2 },
  { category: 'Marketing', description: 'Facebook ads and flyer distribution', amount: 2500, perMonth: 1 },
  { category: 'Miscellaneous', description: 'Packaging, cleaning, petty cash', amount: 1400, perMonth: 2 },
];

export interface PurchaseOrderTemplate {
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  totalAmount: number;
  notes: string;
}

export const PURCHASE_ORDERS: readonly PurchaseOrderTemplate[] = [
  { status: 'received', totalAmount: 38500, notes: 'A4 and long bond paper reams, 120 units.' },
  { status: 'received', totalAmount: 27200, notes: 'Toner cartridges, full colour set plus spares.' },
  { status: 'received', totalAmount: 18900, notes: 'Tarpaulin rolls, 12 yards assorted.' },
  { status: 'received', totalAmount: 24600, notes: 'Sublimation blanks: mugs, mousepads, keychains.' },
  { status: 'ordered', totalAmount: 31200, notes: 'Photo paper stocks ahead of enrolment season.' },
  { status: 'ordered', totalAmount: 15400, notes: 'Laminating pouches and spiral binding coils.' },
  { status: 'ordered', totalAmount: 9600, notes: 'Epson 003 ink bottles, 24 units.' },
  { status: 'draft', totalAmount: 21800, notes: 'Cotton and dri-fit shirts for team jersey orders.' },
  { status: 'draft', totalAmount: 7400, notes: 'Cutting mats and finishing consumables.' },
  { status: 'received', totalAmount: 12750, notes: 'Vinyl sticker rolls and reflectorized sheets.' },
  { status: 'cancelled', totalAmount: 16200, notes: 'Cancelled - supplier out of stock, moved to Paperline.' },
  { status: 'received', totalAmount: 20300, notes: 'Sintra boards and standee hardware.' },
];

export const BUSINESS = {
  name: 'IC Printing Services',
  vatRate: 12,
  currencySymbol: '₱',
} as const;
