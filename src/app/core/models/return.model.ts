export type ReturnType = 'sale' | 'purchase';
export type ReturnStatus = | 'completed' | 'cancelled';

export interface ReturnItem {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
    total: number;
}

export interface ReturnTransaction {
    id: string;
    type: ReturnType;
    referenceId: string;
    referenceNumber: string;
    createdAt: string;
    items: ReturnItem[];
    total: number;
    reason?: string;
    status: ReturnStatus;
}