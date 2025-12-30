
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
// Configure Decimal for financial precision
const DecimalConstructor = Decimal; // Use default precision (20) and rounding (HALF_UP)

export const MathHelper = {
    // Basic arithmetic
    add: (a: number | string, b: number | string): number => {
        return new DecimalConstructor(a).plus(b).toNumber();
    },

    subtract: (a: number | string, b: number | string): number => {
        return new DecimalConstructor(a).minus(b).toNumber();
    },

    multiply: (a: number | string, b: number | string): number => {
        return new DecimalConstructor(a).times(b).toNumber();
    },

    divide: (a: number | string, b: number | string): number => {
        return new DecimalConstructor(a).dividedBy(b).toNumber();
    },

    // Financial specific
    round: (value: number | string, decimals = 2): number => {
        return new DecimalConstructor(value).toDecimalPlaces(decimals).toNumber();
    },

    // Specific logic for Line Item Total: Qty * Price * (1 - Discount/100)
    calculateLineTotal: (qty: number, price: number, discountPercentage: number): number => {
        const dQty = new DecimalConstructor(qty);
        const dPrice = new DecimalConstructor(price);
        const dDisc = new DecimalConstructor(discountPercentage).dividedBy(100);

        // price * (1 - discount)
        const discountedPrice = dPrice.times(new DecimalConstructor(1).minus(dDisc));

        // total = qty * discounted_price
        return dQty.times(discountedPrice).toDecimalPlaces(2).toNumber();
    }
};
