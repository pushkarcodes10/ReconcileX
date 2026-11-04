import { describe, expect, it } from 'vitest';
import { ScreenshotExtractorService } from '../src/modules/screenshot/screenshot-extractor.service';
import { ScreenshotService } from '../src/modules/screenshot/screenshot.service';
import { InMemoryDataSourcesRepository } from '../src/modules/data-sources/repositories/in-memory-data-sources.repository';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('Screenshot Ingestion & OCR Extraction Module', () => {
  const extractor = new ScreenshotExtractorService();

  describe('Financial Text Parser (OCR Heuristics)', () => {
    it('correctly extracts UPI / Google Pay transaction screenshot text', () => {
      const sampleGPayText = `
        Payment Successful
        ₹1,499.00
        To: Swiggy Dineout
        Date: 02 Sep 2026, 14:30
        UPI transaction ID: 624512345678
        Google transaction ID: CICAgOD123
        From: HDFC Bank
      `;

      const result = extractor.parseFinancialText(sampleGPayText);

      expect(result.amount).toBe(1499);
      expect(result.amountMinor).toBe(149900); // 2 decimal places for INR
      expect(result.currency).toBe('INR');
      expect(result.transactionDate).toBe('2026-09-02');
      expect(result.externalId).toBe('624512345678');
      expect(result.description).toContain('Swiggy Dineout');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    });

    it('correctly extracts Stripe USD receipt screenshot text', () => {
      const sampleStripeText = `
        Receipt from Acme Corp
        Amount: $45.50 USD
        Date: 2026-08-21
        Payment ID: ch_3M123456789
        Order ID: ORD-000005
        Status: Succeeded
      `;

      const result = extractor.parseFinancialText(sampleStripeText);

      expect(result.amount).toBe(45.5);
      expect(result.amountMinor).toBe(4550); // 2 decimal places for USD
      expect(result.currency).toBe('USD');
      expect(result.transactionDate).toBe('2026-08-21');
      expect(result.externalId).toBe('ch_3M123456789');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
    });

    it('correctly handles Razorpay payment screenshot with Order ID', () => {
      const sampleRazorpayText = `
        Razorpay Trusted Business
        Payment of ₹ 2,499.00
        Order ID: ORD-1003
        Payment ID: pay_L123456789
        Date: 03-09-2026
        Completed
      `;

      const result = extractor.parseFinancialText(sampleRazorpayText);

      expect(result.amount).toBe(2499);
      expect(result.amountMinor).toBe(249900);
      expect(result.currency).toBe('INR');
      expect(result.transactionDate).toBe('2026-09-03');
      expect(result.externalId).toBe('pay_L123456789');
      expect(result.reference).toBe('ORD-1003');
    });

    it('identifies refund transaction types from receipt text', () => {
      const sampleRefundText = `
        Refund Processed
        Amount: ₹ 499.00
        Reference: REF-1016
        Date: 16-09-2026
      `;

      const result = extractor.parseFinancialText(sampleRefundText);

      expect(result.amount).toBe(499);
      expect(result.amountMinor).toBe(49900);
      expect(result.txnType).toBe('REFUND');
      expect(result.reference).toBe('REF-1016');
    });
  });

  describe('Screenshot Ingestion Service', () => {
    it('ingests verified screenshot transaction into ledger with UNMATCHED status', async () => {
      const dataSourcesRepo = new InMemoryDataSourcesRepository();
      const transactionsRepo = new InMemoryTransactionsRepository();

      const orgId = 'org-test-1';
      const ds = await dataSourcesRepo.create(orgId, {
        name: 'Payment Gateway',
        type: 'PAYMENT_GATEWAY',
        status: 'ACTIVE',
        columnMapping: { external_id: 'id', amount: 'amount', date: 'date', currency: 'currency' },
      });

      const service = new ScreenshotService(extractor, dataSourcesRepo, transactionsRepo);

      const res = await service.ingestScreenshotTransaction(orgId, 'user-1', {
        dataSourceId: ds.id,
        externalId: 'ORD-1002',
        amount: 1499.0,
        currency: 'INR',
        transactionDate: '2026-09-02',
        reference: 'ORD-1002',
        merchantOrOrderId: 'Swiggy',
        txnType: 'PAYMENT',
      });

      expect(res.id).toBeDefined();
      expect(res.externalId).toBe('ORD-1002');
      expect(res.amountMinor).toBe(149900);
      expect(res.currency).toBe('INR');
      expect(res.status).toBe('UNMATCHED');

      // Verify transaction is in repository and eligible for reconciliation
      const eligible = await transactionsRepo.findEligibleForReconciliation(
        orgId,
        ds.id,
        new Date('2026-09-01'),
        new Date('2026-09-03'),
      );

      expect(eligible).toHaveLength(1);
      expect(eligible[0].externalId).toBe('ORD-1002');
      expect(eligible[0].status).toBe('UNMATCHED');
    });

    it('rejects duplicate transaction insertion for the same data source', async () => {
      const dataSourcesRepo = new InMemoryDataSourcesRepository();
      const transactionsRepo = new InMemoryTransactionsRepository();

      const orgId = 'org-test-1';
      const ds = await dataSourcesRepo.create(orgId, {
        name: 'Internal Orders',
        type: 'INTERNAL_ORDERS',
        status: 'ACTIVE',
        columnMapping: { external_id: 'id', amount: 'amount', date: 'date', currency: 'currency' },
      });

      const service = new ScreenshotService(extractor, dataSourcesRepo, transactionsRepo);

      await service.ingestScreenshotTransaction(orgId, 'user-1', {
        dataSourceId: ds.id,
        externalId: 'ORD-DUP-01',
        amount: 500,
        currency: 'INR',
        transactionDate: '2026-09-01',
      });

      await expect(
        service.ingestScreenshotTransaction(orgId, 'user-1', {
          dataSourceId: ds.id,
          externalId: 'ORD-DUP-01',
          amount: 500,
          currency: 'INR',
          transactionDate: '2026-09-01',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects invalid image mime types in extractFromScreenshot', async () => {
      const dataSourcesRepo = new InMemoryDataSourcesRepository();
      const transactionsRepo = new InMemoryTransactionsRepository();
      const service = new ScreenshotService(extractor, dataSourcesRepo, transactionsRepo);

      const fakeFile: any = {
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake pdf content'),
      };

      await expect(service.extractFromScreenshot('org-1', fakeFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully matches screenshot-extracted transaction during reconciliation', async () => {
      const dataSourcesRepo = new InMemoryDataSourcesRepository();
      const transactionsRepo = new InMemoryTransactionsRepository();

      const orgId = 'org-test-1';
      const dsOrders = await dataSourcesRepo.create(orgId, {
        name: 'Internal Orders',
        type: 'INTERNAL_ORDERS',
        status: 'ACTIVE',
        columnMapping: { external_id: 'id', amount: 'amount', date: 'date', currency: 'currency' },
      });

      const dsGateway = await dataSourcesRepo.create(orgId, {
        name: 'Payment Gateway',
        type: 'PAYMENT_GATEWAY',
        status: 'ACTIVE',
        columnMapping: { external_id: 'id', amount: 'amount', date: 'date', currency: 'currency' },
      });

      // 1. Existing order in Source A
      await transactionsRepo.createBatch(orgId, [
        {
          organizationId: orgId,
          dataSourceId: dsOrders.id,
          externalId: 'ORD-1002',
          amountMinor: 149900,
          currency: 'INR',
          transactionDate: new Date('2026-09-02'),
          reference: 'ORD-1002',
          status: 'UNMATCHED',
        },
      ]);

      // 2. User uploads screenshot of payment receipt -> extracted & ingested into Source B
      const service = new ScreenshotService(extractor, dataSourcesRepo, transactionsRepo);
      const ingested = await service.ingestScreenshotTransaction(orgId, 'user-1', {
        dataSourceId: dsGateway.id,
        externalId: 'UPI-TXN-624512345678',
        amount: 1499.0,
        currency: 'INR',
        transactionDate: '2026-09-02',
        reference: 'ORD-1002',
        merchantOrOrderId: 'Swiggy',
        txnType: 'PAYMENT',
      });

      expect(ingested.status).toBe('UNMATCHED');

      // 3. Query eligible transactions for reconciliation
      const txnsA = await transactionsRepo.findEligibleForReconciliation(
        orgId,
        dsOrders.id,
        new Date('2026-09-01'),
        new Date('2026-09-03'),
      );
      const txnsB = await transactionsRepo.findEligibleForReconciliation(
        orgId,
        dsGateway.id,
        new Date('2026-09-01'),
        new Date('2026-09-03'),
      );

      expect(txnsA).toHaveLength(1);
      expect(txnsB).toHaveLength(1);

      // 4. Run matching engine
      const { matchTwoSets } = await import('@reconcilex/matching');
      const matchResult = matchTwoSets(
        txnsA.map((t) => ({
          id: t.id,
          amountMinor: t.amountMinor,
          currency: t.currency,
          transactionDate: t.transactionDate,
          reference: t.reference,
          externalId: t.externalId,
        })),
        txnsB.map((t) => ({
          id: t.id,
          amountMinor: t.amountMinor,
          currency: t.currency,
          transactionDate: t.transactionDate,
          reference: t.reference,
          externalId: t.externalId,
        })),
      );

      expect(matchResult.acceptedMatches).toHaveLength(1);
      const match = matchResult.acceptedMatches[0];
      expect(match.classification).toBe('EXACT');
      expect(match.score).toBe(100);
      expect(match.reasons).toEqual(expect.arrayContaining(['REFERENCE', 'AMOUNT']));
    });
  });
});
