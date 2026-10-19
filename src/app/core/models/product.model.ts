export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  /** Optional scanned code. Existing products remain valid without a barcode. */
  barcode?: string;
  categoryId: string;
  price: number;
  costPrice?: number;
  stock: number;
  maxStock: number;
  minStock: number;
  image?: string;
}
