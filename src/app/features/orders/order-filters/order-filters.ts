import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-filters',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './order-filters.html',
  styleUrl: './order-filters.css',
})

export class OrderFilters {
  @Input() searchTerm = '';
  @Output() searchTermChange = new EventEmitter<string>();
  @Input() dateFilter = '';
  @Output() dateFilterChange = new EventEmitter<string>();
  @Output() exportClick = new EventEmitter<void>();

  onSearchInput(value: string): void {
    this.searchTermChange.emit(value);
  }

  onDateInput(value: string): void {
    this.dateFilterChange.emit(value);
  }

  clearDateFilter(): void {
    this.dateFilterChange.emit('');
  }
}
