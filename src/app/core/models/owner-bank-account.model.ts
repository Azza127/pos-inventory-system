export interface OwnerBankAccount {
    id: string;
    bankName: string;
    accountName: string;
    /** Only the final four digits are stored/displayed. */
    accountNumberLast4?: string;
    isActive: boolean;
}
