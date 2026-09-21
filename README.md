# Moasher POS & Inventory Management System
[![Angular](https://img.shields.io/badge/Angular-21.2.0-DD0031?logo=angular\&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3.8-7952B3?logo=bootstrap\&logoColor=white)](https://getbootstrap.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.5.1-FF6384?logo=chart.js\&logoColor=white)](https://www.chartjs.org/)
[![JSON Server](https://img.shields.io/badge/JSON_Server-1.0.0--beta.15-000000?logo=json\&logoColor=white)](https://github.com/typicode/json-server)

Moasher is a Point of Sale (POS) and Inventory Management System built with Angular. It provides a simple interface for managing products, categories, sales, purchase invoices, orders, returns, reports, team members, and store settings.

## Features

### Authentication
* Login and password reset
* Role-based access control
* Protected routes

### Inventory
* Product management
* Category management
* Stock tracking
* Product search and filtering
* Low stock and out-of-stock status

### Point of Sale
* Product search and category filtering
* Shopping cart
* Cash and card payments
* Order checkout
* Printable receipts

### Orders & Returns
* Order management and details
* Order status filtering
* Sales returns
* Purchase returns

### Purchase Invoices
* Create and manage purchase invoices
* Supplier and invoice information
* Automatic inventory updates
* Search and filtering
* CSV export

### Reports
* Sales overview and analytics
* Sales charts
* Product and category statistics
* CSV/PDF export

### Team & Store Settings
* Team member management
* Role management
* Store information
* Tax and currency settings

## User Roles
| Role         | Access                                             |
| ------------ | -------------------------------------------------- |
| **Employee** | POS, sales, and inventory viewing                  |
| **Manager**  | Inventory, purchases, reports, and team management |
| **Owner**    | Full access, including store settings              |

## Tech Stack
* Angular 21
* TypeScript
* Bootstrap 5
* RxJS
* Chart.js
* JSON Server

## Project Structure
```text
src/
└── app/
    ├── core/
    │   ├── guards/
    │   ├── models/
    │   └── services/
    ├── features/
    │   ├── dashboard/
    │   ├── products/
    │   ├── categories/
    │   ├── pos/
    │   ├── orders/
    │   ├── returns/
    │   ├── purchase-invoices/
    │   ├── reports/
    │   └── team-members/
    └── shared/
```

## Getting Started

### Prerequisites
* Node.js
* npm
* Angular CLI

### Installation
```bash
git clone https://github.com/Azza127/Moasher-POS.git
cd Moasher-POS
npm install
```

### Run the Project
Start JSON Server:

```bash
npx json-server db.json
```

Then, in another terminal:

```bash
npm start
```

Open the application at:

```text
http://localhost:4200
```

## Future Improvements
* Backend and database integration
* Real authentication
* Real-time updates
* More advanced reporting

## Author
**Azza Ezzat**

Software Developer focused on Frontend Development and UI/UX Design.

