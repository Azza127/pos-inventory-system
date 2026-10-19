export interface OrderItem {
    productId: string | number;
    productName: string;
    categoryId?: string;
    price: number;
    costPrice?: number;
    quantity: number;
    total: number;
    image?: string;
}