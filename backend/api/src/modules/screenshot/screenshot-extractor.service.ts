import { Injectable, Logger } from '@nestjs/common';
import { getCurrencyMinorUnitScale } from '@reconcilex/csv';
import { recognize } from 'tesseract.js';
import { ExtractScreenshotResponseDto } from './dto/screenshot.dto';

@Injectable()
export class ScreenshotExtractorService {
  private readonly logger = new Logger(ScreenshotExtractorService.name);

  async extractFromImageBuffer(
    buffer: Buffer,
    mimeType: string = 'image/png',
  ): Promise<ExtractScreenshotResponseDto> {
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Try Gemini Vision if API key is provided in environment
    if (geminiKey && geminiKey.trim().length > 0) {
      try {
        const geminiResult = await this.extractWithGeminiVision(buffer, mimeType, geminiKey.trim());
        if (geminiResult) {
          return geminiResult;
        }
      } catch (err: any) {
        this.logger.warn(`Gemini Vision extraction failed, falling back to local OCR: ${err.message}`);
      }
    }

    // 2. Fall back to local Tesseract OCR + Financial NLP heuristic parsing
    return this.extractWithTesseract(buffer);
  }

  private async extractWithGeminiVision(
    buffer: Buffer,
    mimeType: string,
    apiKey: string,
  ): Promise<ExtractScreenshotResponseDto | null> {
    const base64Image = buffer.toString('base64');
    const prompt = `You are a financial reconciliation document parser.
Analyze this payment receipt or transaction screenshot.
Extract transaction details as strict JSON:
{
  "amount": number (positive decimal value, e.g. 1499.00),
  "currency": string (3-letter uppercase ISO code, e.g. "INR", "USD", "EUR"),
  "transactionDate": string (YYYY-MM-DD format),
  "externalId": string (transaction ID, UTR, order ID, or reference number),
  "reference": string or null (secondary reference, order ID, or invoice number),
  "externalTxnId": string or null (gateway transaction ID),
  "merchantOrOrderId": string or null (merchant name or order number),
  "txnType": "PAYMENT" | "REFUND" | "TRANSFER" | "FEE" | "SALE",
  "description": string (short summary of transaction),
  "confidenceScore": number (0 to 100)
}
Return ONLY valid JSON.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/png',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) return null;

    const parsed = JSON.parse(candidate);
    const currency = (parsed.currency || 'INR').toUpperCase().trim();
    const amount = Math.abs(Number(parsed.amount) || 0);
    const scale = getCurrencyMinorUnitScale(currency);
    const amountMinor = Math.round(amount * Math.pow(10, scale));

    return {
      amount,
      amountMinor,
      currency,
      transactionDate: parsed.transactionDate || new Date().toISOString().split('T')[0],
      externalId: parsed.externalId || `TXN-${Date.now()}`,
      reference: parsed.reference || parsed.externalId,
      externalTxnId: parsed.externalTxnId || undefined,
      merchantOrOrderId: parsed.merchantOrOrderId || undefined,
      txnType: parsed.txnType || 'PAYMENT',
      description: parsed.description || undefined,
      confidenceScore: Math.min(100, Math.max(50, Number(parsed.confidenceScore) || 95)),
      rawOcrText: candidate,
      extractionMethod: 'GEMINI_VISION',
    };
  }

  private async extractWithTesseract(buffer: Buffer): Promise<ExtractScreenshotResponseDto> {
    this.logger.log('Executing local OCR using Tesseract.js...');
    const ocrResult = await recognize(buffer, 'eng');
    const rawText = ocrResult?.data?.text || '';

    this.logger.debug(`Extracted raw OCR text (${rawText.length} chars)`);
    return this.parseFinancialText(rawText);
  }

  public parseFinancialText(rawText: string): ExtractScreenshotResponseDto {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // 1. Detect Currency
    let currency = 'INR'; // Default fallback
    if (/[₹]|Rs\.?|INR/i.test(rawText)) {
      currency = 'INR';
    } else if (/[\$]|USD/i.test(rawText)) {
      currency = 'USD';
    } else if (/[€]|EUR/i.test(rawText)) {
      currency = 'EUR';
    } else if (/[£]|GBP/i.test(rawText)) {
      currency = 'GBP';
    }

    // 2. Detect Amount
    let detectedAmount = 0;
    // Regex for amounts with currency symbol or standard decimal numbers
    // e.g. ₹ 1,499.00 or $45.50 or 2499.00 or 1,200
    const amountRegexes = [
      /(?:[₹\$€£]|Rs\.?|INR|USD|EUR)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi,
      /(?:paid|amount|total|sum|debited|transferred)[\s:]*(?:[₹\$€£]|Rs\.?|INR|USD|EUR)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi,
      /\b([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2})\b/g,
      /\b([0-9]+(?:\.[0-9]{2}))\b/g,
    ];

    let foundAmountStr: string | null = null;
    for (const regex of amountRegexes) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(rawText)) !== null) {
        const valStr = match[1] || match[0];
        const cleaned = valStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 0 && num < 100000000) {
          detectedAmount = num;
          foundAmountStr = cleaned;
          break;
        }
      }
      if (foundAmountStr) break;
    }

    // 3. Detect Date (Timezone-safe calendar date parsing)
    let detectedDate = new Date().toISOString().split('T')[0];
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };

    const isoMatch = /\b(\d{4})[-/.](\d{2})[-/.](\d{2})\b/.exec(rawText);
    if (isoMatch) {
      detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else {
      const dmyMatch = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/.exec(rawText);
      if (dmyMatch) {
        detectedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      } else {
        const dMonYMatch = /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/.exec(rawText);
        if (dMonYMatch) {
          const monKey = dMonYMatch[2].slice(0, 3).toLowerCase();
          const m = monthMap[monKey];
          if (m) {
            detectedDate = `${dMonYMatch[3]}-${m}-${dMonYMatch[1].padStart(2, '0')}`;
          }
        } else {
          const monDYMatch = /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/.exec(rawText);
          if (monDYMatch) {
            const monKey = monDYMatch[1].slice(0, 3).toLowerCase();
            const m = monthMap[monKey];
            if (m) {
              detectedDate = `${monDYMatch[3]}-${m}-${monDYMatch[2].padStart(2, '0')}`;
            }
          }
        }
      }
    }

    // 4. Detect External ID / Transaction Reference
    let externalId: string | null = null;
    let reference: string | null = null;
    let externalTxnId: string | null = null;
    let merchantOrOrderId: string | null = null;

    // Direct labeled extraction
    const upiMatch = /(?:upi\s*(?:txn|transaction)?\s*id|utr|rrn)[\s:]*([A-Za-z0-9_-]{8,30})/i.exec(rawText);
    const payMatch = /(?:payment\s*id|gateway\s*(?:txn|id)|charge\s*id)[\s:]*([A-Za-z0-9_-]{6,36})/i.exec(rawText);
    const orderMatch = /(?:order\s*id|order\s*#)[\s:]*([A-Za-z0-9_-]{4,30})/i.exec(rawText);
    const refMatch = /(?:reference\s*(?:no|number)?|ref\s*(?:no|#)?)[\s:]*([A-Za-z0-9_-]{4,30})/i.exec(rawText);

    if (upiMatch) {
      externalId = upiMatch[1].trim();
    } else if (payMatch) {
      externalId = payMatch[1].trim();
      externalTxnId = externalId;
    }

    if (orderMatch) {
      merchantOrOrderId = orderMatch[1].trim();
      if (!externalId) {
        externalId = merchantOrOrderId;
      }
      if (!reference) {
        reference = merchantOrOrderId;
      }
    }

    if (refMatch) {
      reference = refMatch[1].trim();
      if (!externalId) {
        externalId = reference;
      }
    }

    // Pattern fallback if labels were missing
    if (!externalId) {
      const fallbackPatterns = [
        /\b(ORD-[0-9]{4,10})\b/i,
        /\b(ch_[A-Za-z0-9]{10,24})\b/i,
        /\b(pay_[A-Za-z0-9]{10,24})\b/i,
        /\b(PG-[A-Za-z0-9_-]{4,16})\b/i,
      ];
      for (const pat of fallbackPatterns) {
        const m = pat.exec(rawText);
        if (m) {
          externalId = m[1].trim();
          break;
        }
      }
    }

    // Default identifiers if none detected in OCR
    if (!externalId) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      externalId = `IMG-${detectedDate.replace(/-/g, '')}-${randomSuffix}`;
    }
    if (!reference) {
      reference = externalId;
    }

    // 5. Detect Merchant / Recipient
    let description: string | undefined;
    for (const line of lines) {
      const match = /(?:paid to|to:|merchant:|billed to|receiver:)[\s]*(.+)/i.exec(line);
      if (match) {
        description = match[1].trim();
        if (!merchantOrOrderId) {
          merchantOrOrderId = description.slice(0, 50);
        }
        break;
      }
    }

    // 6. Detect Transaction Type
    let txnType = 'PAYMENT';
    if (/refund|refunded/i.test(rawText)) {
      txnType = 'REFUND';
    } else if (/transfer|transferred/i.test(rawText)) {
      txnType = 'TRANSFER';
    } else if (/fee|charge/i.test(rawText)) {
      txnType = 'FEE';
    }

    // 7. Minor amount scaling
    const scale = getCurrencyMinorUnitScale(currency);
    const amountMinor = Math.round(detectedAmount * Math.pow(10, scale));

    // 8. Confidence Score
    let confidence = 50;
    if (detectedAmount > 0) confidence += 20;
    if (externalId && !externalId.startsWith('IMG-')) confidence += 15;
    if (detectedDate) confidence += 10;
    if (description) confidence += 5;

    return {
      amount: detectedAmount,
      amountMinor,
      currency,
      transactionDate: detectedDate,
      externalId,
      reference,
      externalTxnId: externalTxnId || undefined,
      merchantOrOrderId: merchantOrOrderId || externalId,
      txnType,
      description,
      confidenceScore: Math.min(100, confidence),
      rawOcrText: rawText.slice(0, 2000),
      extractionMethod: 'TESSERACT_OCR',
    };
  }
}
