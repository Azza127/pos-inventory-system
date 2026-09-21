export interface OrderItem {
    productId: number;
    productName: string;
    price: number;
    costPrice?: number;
    quantity: number;
    total: number;
    image?: string;
}