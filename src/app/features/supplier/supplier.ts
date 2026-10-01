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
  SupplierService
} from '../../core/services/supplier.service';

import {
  Supplier as SupplierModel
} from '../../core/models/supplier.model';

import {
  PopupService
} from '../../core/services/popup.service';


@Component({

  selector: 'app-supplier',

  standalone: true,

  imports: [
    FormsModule,
    DecimalPipe
  ],

  templateUrl: './supplier.html',

  styleUrl: './supplier.css'

})
export class Supplier
  implements OnInit {


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly supplierService =
    inject(SupplierService);

  private readonly popupService =
    inject(PopupService);

  private readonly cdr =
    inject(ChangeDetectorRef);


  // =========================================================
  // SUPPLIERS
  // =========================================================

  suppliers:
    SupplierModel[] = [];

  filteredSuppliers:
    SupplierModel[] = [];

  searchTerm = '';

  searchMode:
    'name' | 'phone' =
    'name';

  errorMessage = '';


  // =========================================================
  // SUPPLIER FORM
  // =========================================================

  showSupplierModal = false;

  editingSupplierId:
    string | null = null;

  supplierForm = {

    name: '',

    phone: '',

    address: '',

    notes: ''

  };


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadSuppliers();

  }


  // =========================================================
  // LOAD SUPPLIERS
  // =========================================================

  loadSuppliers(): void {

    this.errorMessage = '';

    this.supplierService
      .getSuppliers()
      .subscribe({

        next: (suppliers) => {

            this.suppliers =
              [...suppliers].sort(
                (a, b) =>
                  a.name.localeCompare(
                    b.name,
                    undefined,
                    {
                      sensitivity: 'base'
                    }
                  )
              );
          
            this.filteredSuppliers =
              [...this.suppliers];
          
            this.cdr.detectChanges();
          
          },

        error: () => {

          this.errorMessage =
            'Failed to load suppliers.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // SEARCH / FILTER SUPPLIERS
  // =========================================================

  applyFilters(): void {

    const term =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (!term) {

      this.filteredSuppliers =
        this.suppliers;

      return;

    }


    this.filteredSuppliers =
      this.suppliers.filter(
        (supplier) => {

          if (
            this.searchMode ===
            'name'
          ) {

            return supplier.name
              .toLowerCase()
              .includes(term);

          }


          return supplier.phone
            .includes(term);

        }
      );

  }


  // =========================================================
  // ADD SUPPLIER
  // =========================================================

  openAddSupplierModal(): void {

    this.editingSupplierId =
      null;

    this.supplierForm = {

      name: '',

      phone: '',

      address: '',

      notes: ''

    };

    this.errorMessage = '';

    this.showSupplierModal =
      true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // EDIT SUPPLIER
  // =========================================================

  openEditSupplierModal(
    supplier: SupplierModel
  ): void {

    this.editingSupplierId =
      supplier.id;

    this.supplierForm = {

      name:
        supplier.name,

      phone:
        supplier.phone,

      address:
        supplier.address || '',

      notes:
        supplier.notes || ''

    };

    this.errorMessage = '';

    this.showSupplierModal =
      true;

    this.cdr.detectChanges();

  }


  // =========================================================
  // CLOSE SUPPLIER MODAL
  // =========================================================

  closeSupplierModal(): void {

    this.showSupplierModal =
      false;

    this.editingSupplierId =
      null;

    this.cdr.detectChanges();

  }


  // =========================================================
  // SAVE SUPPLIER
  // ADD / EDIT
  // =========================================================

  saveSupplier(): void {

    const name =
      this.supplierForm.name
        .trim();

    const phone =
      this.supplierForm.phone
        .trim();

    const address =
      this.supplierForm.address
        .trim();

    const notes =
      this.supplierForm.notes
        .trim();


    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!name || !phone) {

      this.errorMessage =
        'Supplier name and phone are required.';

      return;

    }


    // -------------------------------------------------------
    // EDIT SUPPLIER
    // -------------------------------------------------------

    if (this.editingSupplierId) {

      const currentSupplier =
        this.suppliers.find(
          supplier =>
            supplier.id ===
            this.editingSupplierId
        );


      if (!currentSupplier) {

        return;

      }


      const updatedSupplier:
        Omit<SupplierModel, 'id'> = {

        name,

        phone,

        address:
          address || undefined,

        notes:
          notes || undefined,

        /*
         * Financial information must
         * remain unchanged when editing
         * supplier information.
         */
        balance:
          currentSupplier.balance,

        status:
          currentSupplier.status

      };


      this.supplierService
        .updateSupplier(
          this.editingSupplierId,
          updatedSupplier
        )
        .subscribe({

          next: (supplier) => {

            this.suppliers =
              this.suppliers.map(
                item =>
                  item.id ===
                  supplier.id
                    ? supplier
                    : item
              );

            this.applyFilters();

            this.showSupplierModal =
              false;

            this.editingSupplierId =
              null;

            this.errorMessage =
              '';

            this.cdr.detectChanges();

          },

          error: () => {

            this.errorMessage =
              'Failed to update supplier.';

            this.cdr.detectChanges();

          }

        });


      return;

    }


    // -------------------------------------------------------
    // ADD SUPPLIER
    // -------------------------------------------------------

    const newSupplier:
      Omit<SupplierModel, 'id'> = {

      name,

      phone,

      address:
        address || undefined,

      notes:
        notes || undefined,

      balance: 0,

      status:
        'Active'

    };


    this.supplierService
      .addSupplier(
        newSupplier
      )
      .subscribe({

        next: (supplier) => {

          this.suppliers = [

            ...this.suppliers,

            supplier

          ];

          this.applyFilters();

          this.showSupplierModal =
            false;

          this.editingSupplierId =
            null;

          this.supplierForm = {

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
            'Failed to add supplier.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // DELETE SUPPLIER
  // =========================================================

  deleteSupplier(
    supplier: SupplierModel
  ): void {

    /*
     * A supplier with an outstanding
     * payable balance cannot be deleted.
     */
    if (
      Number(supplier.balance) > 0
    ) {

      this.popupService.showAlert(

        'This supplier cannot be deleted because they have an outstanding balance.',

        'warning'

      );

      return;

    }


    this.popupService
      .showConfirm(

        `Are you sure you want to delete "${supplier.name}"?`,

        'Delete Supplier'

      )
      .subscribe(
        (confirmed: boolean) => {

          if (!confirmed) {

            return;

          }


          this.supplierService
            .deleteSupplier(
              supplier.id
            )
            .subscribe({

              next: () => {

                this.suppliers =
                  this.suppliers.filter(
                    item =>
                      item.id !==
                      supplier.id
                  );

                this.applyFilters();


                this.popupService.showAlert(

                  'Supplier deleted successfully.',

                  'success'

                );


                this.cdr.detectChanges();

              },

              error: () => {

                this.popupService.showAlert(

                  'Failed to delete supplier.',

                  'error'

                );


                this.cdr.detectChanges();

              }

            });

        }
      );

  }

}

