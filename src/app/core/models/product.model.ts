export interface Product {
    id: string;
    name: string;
    description?: string;
    sku: string;
    categoryId: string;
    price: number;
    costPrice?: number;
    stock: number;
    maxStock: number;
    minStock: number;
    image?: string;
  }