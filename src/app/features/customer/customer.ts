import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  DecimalPipe
} from '@angular/common';

import {
  CustomerService
} from '../../core/services/customer.service';

import {
  Customer as CustomerModel
} from '../../core/models/customer.model';

import {
  PopupService
} from '../../core/services/popup.service';


@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe
  ],
  templateUrl: './customer.html',
  styleUrl: './customer.css',
})
export class Customer implements OnInit {

  // =========================================================
  // SERVICES
  // =========================================================

  private readonly customerService =
    inject(CustomerService);

  private readonly popupService =
    inject(PopupService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  // =========================================================
  // CUSTOMERS
  // =========================================================

  customers: CustomerModel[] = [];

  filteredCustomers: CustomerModel[] = [];

  searchTerm = '';

  searchMode: 'name' | 'phone' = 'name';

  errorMessage = '';


  // =========================================================
  // CUSTOMER FORM
  // =========================================================

  showCustomerModal = false;

  editingCustomerId: string | null = null;

  customerForm = {
    name: '',
    phone: '',
    address: '',
    notes: ''
  };


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadCustomers();

  }


  // =========================================================
  // LOAD CUSTOMERS
  // =========================================================

  loadCustomers(): void {

    this.errorMessage = '';

    this.customerService
      .getCustomers()
      .subscribe({

        next: (customers) => {

          this.customers = customers;
          this.filteredCustomers = customers;

          this.cdr.detectChanges();

        },

        error: () => {

          this.errorMessage = 'Failed to load customers.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // SEARCH / FILTER CUSTOMERS
  // =========================================================

  applyFilters(): void {

    const term =
      this.searchTerm
        .trim()
        .toLowerCase();

    if (!term) {

      this.filteredCustomers =
        this.customers;

      return;
    }

    this.filteredCustomers =
      this.customers.filter(
        (customer) => {

          if (
            this.searchMode ===
            'name'
          ) {

            return customer.name
              .toLowerCase()
              .includes(term);
          }

          return customer.phone
            .includes(term);
        }
      );
  }


  // =========================================================
  // ADD CUSTOMER
  // =========================================================

  openAddCustomerModal(): void {

    this.editingCustomerId =
      null;

    this.customerForm = {
      name: '',
      phone: '',
      address: '',
      notes: ''
    };

    this.errorMessage = '';

    this.showCustomerModal =
      true;

    this.cdr.detectChanges();
  }


  // =========================================================
  // EDIT CUSTOMER
  // =========================================================

  openEditCustomerModal(
    customer: CustomerModel
  ): void {

    this.editingCustomerId =
      customer.id;

    this.customerForm = {
      name: customer.name,
      phone: customer.phone,
      address:
        customer.address || '',
      notes:
        customer.notes || ''
    };

    this.errorMessage = '';

    this.showCustomerModal =
      true;

    this.cdr.detectChanges();
  }


  // =========================================================
  // CLOSE CUSTOMER FORM MODAL
  // =========================================================

  closeCustomerModal(): void {

    this.showCustomerModal =
      false;

    this.editingCustomerId =
      null;

    this.cdr.detectChanges();
  }


  // =========================================================
  // SAVE CUSTOMER
  // ADD / EDIT
  // =========================================================

  saveCustomer(): void {

    const name =
      this.customerForm.name.trim();

    const phone =
      this.customerForm.phone.trim();

    const address =
      this.customerForm.address.trim();

    const notes =
      this.customerForm.notes.trim();


    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!name || !phone) {

      this.errorMessage =
        'Customer name and phone are required.';

      return;
    }


    // -------------------------------------------------------
    // EDIT CUSTOMER
    // -------------------------------------------------------

    if (this.editingCustomerId) {

      const currentCustomer =
        this.customers.find(
          customer =>
            customer.id ===
            this.editingCustomerId
        );

      if (!currentCustomer) {
        return;
      }


      const updatedCustomer:
        Omit<CustomerModel, 'id'> = {

        name,

        phone,

        address:
          address || undefined,

        notes:
          notes || undefined,

        /*
         * Financial information must not
         * change when editing customer data.
         */
        balance:
          currentCustomer.balance,

        status:
          currentCustomer.status
      };


      this.customerService
        .updateCustomer(
          this.editingCustomerId,
          updatedCustomer
        )
        .subscribe({

          next: (customer) => {

            this.customers =
              this.customers.map(
                item =>
                  item.id === customer.id
                    ? customer
                    : item
              );

            this.applyFilters();

            this.showCustomerModal =
              false;

            this.editingCustomerId =
              null;

            this.errorMessage =
              '';

            this.cdr.detectChanges();
          },

          error: () => {

            this.errorMessage =
              'Failed to update customer.';

            this.cdr.detectChanges();
          }

        });

      return;
    }


    // -------------------------------------------------------
    // ADD CUSTOMER
    // -------------------------------------------------------

    const newCustomer:
      Omit<CustomerModel, 'id'> = {

      name,

      phone,

      address:
        address || undefined,

      notes:
        notes || undefined,

      balance: 0,

      status: 'Active'
    };


    this.customerService
      .addCustomer(newCustomer)
      .subscribe({

        next: (customer) => {

          this.customers = [
            ...this.customers,
            customer
          ];

          this.applyFilters();

          this.showCustomerModal =
            false;

          this.editingCustomerId =
            null;

          this.customerForm = {
            name: '',
            phone: '',
            address: '',
            notes: ''
          };

          this.errorMessage =
            '';

          this.cdr.detectChanges();
        },

        error: () => {

          this.errorMessage =
            'Failed to add customer.';

          this.cdr.detectChanges();
        }

      });
  }


  // =========================================================
  // DELETE CUSTOMER
  // =========================================================

  deleteCustomer(
    customer: CustomerModel
  ): void {

    /*
     * A customer with outstanding debt
     * cannot be deleted.
     */
    if (
      Number(customer.balance) > 0
    ) {

      this.popupService.showAlert(
        'This customer cannot be deleted because they have an outstanding balance.',
        'warning'
      );

      return;
    }


    this.popupService
      .showConfirm(
        `Are you sure you want to delete "${customer.name}"?`,
        'Delete Customer'
      )
      .subscribe(
        (confirmed: boolean) => {

          if (!confirmed) {
            return;
          }


          this.customerService
            .deleteCustomer(
              customer.id
            )
            .subscribe({

              next: () => {

                this.customers =
                  this.customers.filter(
                    item =>
                      item.id !==
                      customer.id
                  );

                this.applyFilters();

                this.popupService.showAlert(
                  'Customer deleted successfully.',
                  'success'
                );

                this.cdr.detectChanges();
              },

              error: () => {

                this.popupService.showAlert(
                  'Failed to delete customer.',
                  'error'
                );

                this.cdr.detectChanges();
              }

            });
        }
      );
  }

}