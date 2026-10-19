# Moasher POS & Inventory Management System (مُـؤشِّــر)

[![Angular](https://img.shields.io/badge/Angular-21.2.0-DD0031?logo=angular&logoColor=white)](https://angular.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.8-7952B3?logo=bootstrap&logoColor=white)](https://getbootstrap.com/) [![Chart.js](https://img.shields.io/badge/Chart.js-4.5.1-FF6384?logo=chart.js&logoColor=white)](https://www.chartjs.org/) [![ExcelJS](https://img.shields.io/badge/ExcelJS-4.4.0-217346?logo=microsoft-excel&logoColor=white)](https://github.com/exceljs/exceljs) [![JSON Server](https://img.shields.io/badge/JSON_Server-1.0.0--beta.15-000000?logo=json&logoColor=white)](https://github.com/typicode/json-server)

Moasher is a Point of Sale (POS), Inventory, and Cash Treasury Management System built with Angular. It helps manage products, categories, sales, purchase invoices, returns, customer and supplier accounts, cash movements, employee shifts, and reports.

## Features

### Authentication
- Login and password reset
- Role-based access control
- Protected routes

### Inventory
- Product and category management
- Stock tracking and low-stock indicators
- Product search and filtering
- Protection for products used in historical transactions

### Point of Sale
- Product search by name, SKU, or barcode
- Shopping cart with multiple invoice tabs
- Cash/payment-account and on-account sales
- Employee shift handling
- Printable receipts

### Orders & Returns
- View and filter orders by status, date, and search term
- Order details and Excel export
- Sales returns and purchase returns

### Purchase Invoices
- Create and manage supplier purchase invoices
- Update stock quantities and purchase costs
- Paid and on-account invoices
- Search and filter invoices
- Excel export

### Customers, Suppliers & Accounts
- Customer and supplier management
- Track customer receivables and supplier payables
- Customer and supplier account statements
- Record collections and supplier payments

### Cash Movements & Treasury
- Record cash in, cash out, and account transfers
- Track payment accounts
- Close employee shifts and record handovers to the safe
- View safe balance and movement history

### Reports
- Sales overview and average order value
- Sales charts and category statistics
- Top-selling products and sales trends
- Inventory valuation and profit margin indicators

### Team, Attendance & Store Settings
- Manage employees and roles
- Employee check-in and check-out tracking
- Store information, currency, tax, and payment account settings

## User Roles

| Role | Access |
|---|---|
| **Employee** | POS, orders, inventory viewing, customer and supplier information, cash movements, and personal attendance |
| **Manager** | Inventory and categories, purchase invoices, returns, reports, treasury, and employee management within assigned permissions |
| **Owner** | Full system access, including team management and store settings |

## Tech Stack

- Angular 21
- TypeScript 5.9
- Bootstrap 5
- RxJS
- Chart.js
- ExcelJS
- JSON Server

## Getting Started

### Installation

```bash
npm install
```

### Start JSON Server

Open a terminal and run:

```bash
npx json-server db.json --port 3000
```

### Start Angular

In a second terminal, run:

```bash
npm start
```

Then open `http://localhost:4200` in your browser.

## Project Structure

```text
src/app/
├── core/
│   ├── guards/        # Authentication and role guards
│   ├── models/        # TypeScript data models
│   ├── services/      # API and application services
│   └── utils/         # Shared utility functions
├── features/
│   ├── accounts/      # Customer and supplier statements
│   ├── attendance/    # Employee attendance
│   ├── auth-settings/ # Login, password reset, users, and store settings
│   ├── cash-movements/# Cash in, cash out, and transfers
│   ├── categories/    # Product categories
│   ├── customer/      # Customer management
│   ├── dashboard/     # Dashboard and business overview
│   ├── orders/        # Orders and Excel export
│   ├── pos/           # Point of Sale
│   ├── products/      # Products and inventory
│   ├── purchase-invoices/ # Purchase invoices and stock intake
│   ├── reports/       # Reports and analytics
│   ├── returns/       # Sales and purchase returns
│   ├── supplier/      # Supplier management
│   └── treasury/      # Safe balances and shift handovers
└── shared/
    └── components/   # Header, sidebar, and popup components

angular.json           # Angular CLI configuration
db.json                # JSON Server data
package.json           # Dependencies and npm scripts
```

## Build & Test

```bash
npm run build
npm test
```

## Author

- **Author:** Azza Ezzat
- **Repository:** [Moasher-POS](https://github.com/Azza127/Moasher-POS)
