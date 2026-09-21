import { Product } from '../models/product.model';
import { Order } from '../models/order.model';

export class StatsUtil {
  static totalSales(orders: Order[]): number {
    return orders.reduce((total, order) => {
      return total + Number(order.total || 0);
    }, 0);
  }

  static lowStockProducts(products: Product[]): Product[] {
    return products.filter(product => {
      const stock = Number(product.stock);
      const minStock = Number(product.minStock);
      return stock <= minStock;
    });
  }

  static recentOrders(orders: Order[], limit: number): Order[] {
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  }
}