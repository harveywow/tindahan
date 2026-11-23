/**
 * @file Tests for InventoryService and the Product model (incl. tingi).
 */
import { ConflictError, StockError, ValidationError } from '../js/core/AppError.js';
import { isLowStock, splitStock } from '../js/models/Product.js';
import { Basket } from '../js/services/Basket.js';
import { createOpenStore, createTestApp, SARDINES_INPUT, SHAMPOO_INPUT } from './helpers.js';
import { describe, expect, it } from './testRunner.js';

describe('InventoryService', () => {
  describe('adding products', () => {
    it('stores money in centavos and stock in pieces', () => {
      const { services } = createTestApp();
      const shampoo = services.inventoryService.addProduct(SHAMPOO_INPUT);
      expect(shampoo.pricePerPiece).toBe(750);
      expect(shampoo.stockPieces).toBe(24);
      expect(splitStock({ ...shampoo, stockPieces: 29 })).toEqual({ packs: 2, pieces: 5 });
    });

    it('[EC1] rejects a blank name', () => {
      const { services } = createTestApp();
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, name: '   ' }),
      ).toThrow(ValidationError, 'errors.required');
    });

    it('[EC2] rejects a negative price', () => {
      const { services } = createTestApp();
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, pricePerPack: '-25' }),
      ).toThrow(ValidationError);
    });

    it('[EC3] rejects decimal stock', () => {
      const { services } = createTestApp();
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, initialStock: '2.5' }),
      ).toThrow(ValidationError, 'errors.wholeNumber');
    });

    it('[EC4] warns when price is below cost, and allows it after confirmation', () => {
      const { services } = createTestApp();
      const cheap = { ...SARDINES_INPUT, pricePerPack: '15' };
      expect(() => services.inventoryService.addProduct(cheap)).toThrow(
        ValidationError,
        'errors.priceBelowCost',
      );
      const product = services.inventoryService.addProduct(cheap, { confirmBelowCost: true });
      expect(product.pricePerPack).toBe(1500);
    });

    it('[EC4] also catches tingi prices that lose money when the whole pack is sold per piece', () => {
      const { services } = createTestApp();
      const losingTingi = { ...SHAMPOO_INPUT, pricePerPiece: '5' }; // 12 × ₱5 = ₱60 < ₱72 cost
      expect(() => services.inventoryService.addProduct(losingTingi)).toThrow(
        ValidationError,
        'errors.priceBelowCost',
      );
    });

    it('[EC7] rejects duplicate names regardless of case and spacing', () => {
      const { services } = createTestApp();
      services.inventoryService.addProduct(SARDINES_INPUT);
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, name: '  SARDINAS ' }),
      ).toThrow(ConflictError, 'errors.duplicateProduct');
    });

    it('rejects categories that do not exist', () => {
      const { services } = createTestApp();
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, category: 'Gadgets' }),
      ).toThrow(ValidationError, 'errors.unknownCategory');
    });

    it('rejects images over 200 KB', () => {
      const { services } = createTestApp();
      const bigImage = `data:image/jpeg;base64,${'A'.repeat(300 * 1024)}`;
      expect(() =>
        services.inventoryService.addProduct({ ...SARDINES_INPUT, imageDataUrl: bigImage }),
      ).toThrow(ValidationError, 'errors.imageTooLarge');
    });
  });

  describe('editing and removing', () => {
    it('refuses to change pack size while stock exists', () => {
      const { services, shampoo } = createOpenStore();
      expect(() =>
        services.inventoryService.updateProduct(shampoo.id, {
          ...SHAMPOO_INPUT,
          piecesPerPack: '10',
        }),
      ).toThrow(ConflictError, 'errors.cannotChangePackSize');
    });

    it('detects when an edit changes a price (PIN needed)', () => {
      const { services, sardines } = createOpenStore();
      expect(
        services.inventoryService.wouldChangePrice(sardines.id, {
          ...SARDINES_INPUT,
          pricePerPack: '26',
        }),
      ).toBe(true);
      expect(
        services.inventoryService.wouldChangePrice(sardines.id, {
          ...SARDINES_INPUT,
          name: 'Sardinas Red',
        }),
      ).toBe(false);
    });

    it('[EC9] deletes unsold products but ARCHIVES products with sales history', () => {
      const { services, sardines, shampoo } = createOpenStore();
      const basket = new Basket();
      basket.add(sardines);
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
      expect(services.inventoryService.removeProduct(sardines.id)).toBe('archived');
      expect(services.inventoryService.removeProduct(shampoo.id)).toBe('deleted');
      expect(services.inventoryService.listProducts({ stockStatus: 'archived' })).toHaveLength(1);
    });

    it('[EC9] blocks deleting a category that is still in use', () => {
      const { services } = createOpenStore();
      expect(() => services.inventoryService.removeCategory('Delata')).toThrow(
        ConflictError,
        'errors.categoryInUse',
      );
      services.inventoryService.removeCategory('Bigas');
      expect(services.inventoryService.listCategories().includes('Bigas')).toBe(false);
    });

    it('[EC7] rejects duplicate categories', () => {
      const { services } = createTestApp();
      expect(() => services.inventoryService.addCategory(' delata ')).toThrow(
        ConflictError,
        'errors.duplicateCategory',
      );
    });
  });

  describe('stock changes', () => {
    it('adjusts stock with a reason and logs it', () => {
      const { services, shampoo } = createOpenStore();
      services.inventoryService.adjustStock(shampoo.id, {
        quantity: '3',
        unit: 'piece',
        direction: 'remove',
        reason: 'spoiled',
      });
      expect(services.inventoryService.getProduct(shampoo.id).stockPieces).toBe(21);
      expect(services.inventoryService.listAdjustments()[0].reason).toBe('spoiled');
    });

    it('[EC5] cannot remove more stock than exists', () => {
      const { services, sardines } = createOpenStore();
      expect(() =>
        services.inventoryService.adjustStock(sardines.id, {
          quantity: '11',
          unit: 'pack',
          direction: 'remove',
          reason: 'lost',
        }),
      ).toThrow(StockError, 'errors.notEnoughStock');
    });

    it('receives restocked packs and updates the cost', () => {
      const { services, sardines } = createOpenStore();
      const updated = services.inventoryService.receiveStock(sardines.id, {
        quantity: '5',
        costPerPack: '21',
      });
      expect(updated.stockPieces).toBe(15);
      expect(updated.costPerPack).toBe(2100);
    });

    it('[EC11] refuses to restock an archived product', () => {
      const { services, sardines } = createOpenStore();
      const basket = new Basket();
      basket.add(sardines);
      services.salesService.checkout(basket, { paymentType: 'cash', cashReceived: '25' });
      services.inventoryService.removeProduct(sardines.id);
      expect(() =>
        services.inventoryService.receiveStock(sardines.id, { quantity: '1', costPerPack: '20' }),
      ).toThrow(ConflictError, 'errors.productArchived');
    });

    it('flags low stock and expiring products', () => {
      const { services } = createTestApp();
      const product = services.inventoryService.addProduct({
        ...SARDINES_INPUT,
        initialStock: '3',
        expiryDate: '2026-11-25',
      });
      expect(isLowStock(product)).toBe(true);
      expect(services.inventoryService.getExpiringProducts()).toHaveLength(1);
    });
  });
});
