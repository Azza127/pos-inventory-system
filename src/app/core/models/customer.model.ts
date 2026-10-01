export interface Customer {
    id: string;
    name: string;
    phone: string;
    address?: string;
    notes?: string;
    balance: number;
    status: 'Active' | 'Inactive';
}