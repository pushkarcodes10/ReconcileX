import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importsApi, UploadImportResponse } from '../../api/endpoints/imports';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { ApiError } from '../../api/errors';
import { StatusBadge } from '../../shared/components/status-badge';
import {
  ArrowLeftIcon,
  UploadIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  FileSpreadsheetIcon,
} from '../../shared/components/icons';

export type ImportUIState =
  | 'idle'
  | 'file_selected'
  | 'uploading'
  | 'file_uploaded'
  | 'parsing'
  | 'mapping_columns'
  | 'validating_records'
  | 'importing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

interface CanonicalFieldDef {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

const CANONICAL_FIELD_DEFS: CanonicalFieldDef[] = [
  { key: 'external_id', label: 'External ID (external_id)', required: true, description: 'Unique transaction reference / identifier' },
  { key: 'amount', label: 'Amount (amount)', required: true, description: 'Monetary amount (decimal major units)' },
  { key: 'currency', label: 'Currency (currency)', required: true, description: '3-letter ISO 4217 code (e.g. INR, USD, EUR)' },
  { key: 'transaction_date', label: 'Transaction Date (transaction_date)', required: true, description: 'Transaction date (YYYY-MM-DD, DD-MM-YYYY, ISO)' },
  { key: 'reference', label: 'Reference Key (reference)', required: false, description: 'Secondary reference or counterparty matching key' },
  { key: 'external_txn_id', label: 'External Txn ID (external_txn_id)', required: false, description: 'Gateway / external payment capture identifier' },
  { key: 'merchant_or_order_id', label: 'Merchant / Order ID (merchant_or_order_id)', required: false, description: 'Merchant internal order or batch number' },
  { key: 'txn_type', label: 'Transaction Type (txn_type)', required: false, description: 'Classification (e.g. SALE, CAPTURE, REFUND)' },
];

function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  const pipes = (headerLine.match(/\|/g) || []).length;
  const counts = [
    { delim: ',', count: commas },
    { delim: ';', count: semicolons },
    { delim: '\t', count: tabs },
    { delim: '|', count: pipes },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delim : ',';
}

function suggestColumnMappingClient(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  if (!headers || headers.length === 0) return mapping;

  const normalized = headers.map((h, i) => {
    let clean = String(h ?? '').replace(/^\uFEFF/, '').trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }
    return {
      original: clean,
      sanitized: clean.toLowerCase().replace(/[^a-z0-9]/g, ''),
      index: i,
    };
  });

  const findHeader = (candidates: string[], exclude?: Set<string>): string | undefined => {
    for (const cand of candidates) {
      const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exact = normalized.find((h) => h.sanitized === candClean && (!exclude || !exclude.has(h.original)));
      if (exact) return exact.original;
    }
    for (const cand of candidates) {
      const candClean = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Avoid loose substring matches for short tokens (e.g. 'id' matching 'paid_date' or 'dividend')
      if (candClean.length < 3) continue;
      const sub = normalized.find(
        (h) => (h.sanitized.includes(candClean) || candClean.includes(h.sanitized)) && (!exclude || !exclude.has(h.original)),
      );
      if (sub) return sub.original;
    }
    return undefined;
  };

  const used = new Set<string>();

  const extId = findHeader([
    'external_id',
    'externalid',
    'ext_id',
    'order_id',
    'orderid',
    'txn_id',
    'transaction_id',
    'txnid',
    'transactionid',
    'reference_id',
    'ref_id',
    'id',
  ]);
  if (extId) {
    mapping.external_id = extId;
    used.add(extId);
  }

  const amt = findHeader([
    'amount',
    'gross_amount',
    'transaction_amount',
    'total_amount',
    'total',
    'sum',
    'amt',
    'value',
    'price',
    'net_amount',
    'net',
  ], used);
  if (amt) {
    mapping.amount = amt;
    used.add(amt);
  }

  const cur = findHeader(['currency', 'currency_code', 'curr', 'ccy', 'cur'], used);
  if (cur) {
    mapping.currency = cur;
    used.add(cur);
  }

  const dt = findHeader([
    'transaction_date',
    'transactiondate',
    'txn_date',
    'tx_date',
    'payment_date',
    'date',
    'timestamp',
    'created_at',
    'txn_dt',
    'tx_dt',
    'datetime',
    'time',
  ], used);
  if (dt) {
    mapping.transaction_date = dt;
    used.add(dt);
  }

  const ref = findHeader(['reference', 'reference_number', 'reference_no', 'ref_number', 'ref', 'ref_no'], used);
  if (ref) {
    mapping.reference = ref;
    used.add(ref);
  }

  const extTxn = findHeader(['external_txn_id', 'external_transaction_id', 'gateway_txn_id', 'gateway_id', 'payment_id', 'stmt_id'], used);
  if (extTxn) {
    mapping.external_txn_id = extTxn;
    used.add(extTxn);
  }

  const merch = findHeader(['merchant_or_order_id', 'merchant_order_id', 'order_id', 'batch_id'], used);
  if (merch) {
    mapping.merchant_or_order_id = merch;
    used.add(merch);
  }

  const type = findHeader(['txn_type', 'transaction_type', 'payment_type', 'type'], used);
  if (type) {
    mapping.txn_type = type;
    used.add(type);
  }

  return mapping;
}

export const NewImportPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uiState, setUiState] = useState<ImportUIState>('idle');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UploadImportResponse | null>(null);

  // Parsed CSV metadata
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);

  // Fetch active data sources
  const { data: dataSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setUiState('validating_records');
      await new Promise((r) => setTimeout(r, 150));
      setUiState('uploading');
      await new Promise((r) => setTimeout(r, 150));
      setUiState('importing');
      const finalMapping = { ...columnMapping };
      if (finalMapping.transaction_date && !finalMapping.date) {
        finalMapping.date = finalMapping.transaction_date;
      }
      let res = await importsApi.uploadCsv(orgId!, selectedSourceId, selectedFile!, finalMapping);

      // If the backend has queued or is processing the import asynchronously, poll until completion
      if (res.status === 'QUEUED' || res.status === 'PROCESSING') {
        const importId = res.importId;
        const maxAttempts = 40; // up to ~60s
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const statusRes = await importsApi.getImportStatus(orgId!, importId);
            if (statusRes.status !== 'QUEUED' && statusRes.status !== 'PROCESSING') {
              res = {
                ...res,
                status: statusRes.status,
                rowCount: statusRes.rowCount,
                validCount: statusRes.validCount,
                invalidCount: statusRes.invalidCount,
                duplicateCount: statusRes.duplicateCount,
                totalRecords: statusRes.rowCount,
                validRecords: statusRes.validCount,
                invalidRecords: statusRes.invalidCount,
                duplicateRecords: statusRes.duplicateCount,
              };
              break;
            }
          } catch {
            // Transient network or polling error; continue polling
          }
        }
      }

      return res;
    },
    onSuccess: (res) => {
      setImportResult(res);
      queryClient.invalidateQueries({ queryKey: ['imports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['import', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
      queryClient.invalidateQueries({ queryKey: ['data-source', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-candidates', orgId] });
      queryClient.invalidateQueries({ queryKey: ['jobs', orgId] });

      const invalidCount = res.invalidRecords ?? res.invalidCount ?? 0;
      if (res.status === 'FAILED') {
        setUiState('failed');
      } else if (invalidCount > 0) {
        setUiState('completed_with_errors');
      } else {
        setUiState('completed');
      }
    },
    onError: (err: any) => {
      setUiState('failed');
      if (ApiError.isApiError(err)) {
        setUploadError(err.message);
      } else {
        setUploadError(err?.message || 'CSV upload failed. Please verify file format and connectivity.');
      }
    },
  });

  // Handle file inspection and parsing
  const handleFileSelected = (file: File, sourceIdOverride?: string) => {
    setSelectedFile(file);
    setUploadError(null);
    setUiState('file_selected');

    // Parse header and sample rows using FileReader
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setUiState('parsing');
        const text = (evt.target?.result as string) || '';
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length === 0) {
          setUploadError('The selected file is empty.');
          setUiState('idle');
          return;
        }

        const delimiter = detectDelimiter(lines[0]);
        const rawHeaders = parseCsvLine(lines[0], delimiter).map((h) =>
          h.replace(/^\uFEFF/, '').trim().replace(/^["']|["']$/g, '')
        );

        setCsvHeaders(rawHeaders);

        const sample = lines.slice(1, 6).map((line) => parseCsvLine(line, delimiter));
        setPreviewRows(sample);

        // Pre-fill mapping: use data source existing mapping if matching, or auto-suggest
        const targetSourceId = sourceIdOverride !== undefined ? sourceIdOverride : selectedSourceId;
        const currentDs = dataSources?.items.find((ds) => ds.id === targetSourceId);
        const auto = suggestColumnMappingClient(rawHeaders);
        const initialMapping: Record<string, string> = {};

        CANONICAL_FIELD_DEFS.forEach((field) => {
          const dsMap = currentDs?.columnMapping as any;
          const dsMapped =
            dsMap?.[field.key] ||
            (field.key === 'transaction_date' ? dsMap?.date || dsMap?.transactionDate : undefined) ||
            (field.key === 'external_id' ? dsMap?.externalId : undefined);
          if (dsMapped && rawHeaders.includes(dsMapped)) {
            initialMapping[field.key] = dsMapped;
          } else if (auto[field.key]) {
            initialMapping[field.key] = auto[field.key];
          }
        });

        setColumnMapping(initialMapping);
        setUiState('mapping_columns');
      } catch (err: any) {
        setUploadError(`Failed to parse CSV preview: ${err.message}`);
        setUiState('idle');
      }
    };
    reader.onerror = () => {
      setUploadError('Could not read the selected file.');
      setUiState('idle');
    };
    // Read first 64KB for instant header & sample inspection
    reader.readAsText(file.slice(0, 65536));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type === 'text/plain') {
        handleFileSelected(file);
      } else {
        setUploadError('Only CSV files (.csv) are accepted.');
      }
    }
  };

  const handleStartImport = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedSourceId) {
      setUploadError('Please select a target data source.');
      return;
    }
    if (!selectedFile) {
      setUploadError('Please select a CSV file.');
      return;
    }

    // Validate required fields are mapped
    const requiredFields = CANONICAL_FIELD_DEFS.filter((f) => f.required);
    const missing = requiredFields.filter((f) => !columnMapping[f.key] || columnMapping[f.key].trim() === '');
    if (missing.length > 0) {
      setUploadError(
        `Required column mappings are missing: ${missing.map((m) => m.label).join(', ')}`
      );
      return;
    }

    uploadMutation.mutate();
  };

  const handleDownloadErrors = async () => {
    if (!orgId || !importResult?.importId) return;
    try {
      setIsDownloadingErrors(true);
      await importsApi.downloadErrorReportCsv(orgId, importResult.importId);
    } catch {
      setUploadError('Failed downloading error report.');
    } finally {
      setIsDownloadingErrors(false);
    }
  };

  const resetAll = () => {
    setUiState('idle');
    setSelectedFile(null);
    setImportResult(null);
    setUploadError(null);
    setCsvHeaders([]);
    setPreviewRows([]);
    setColumnMapping({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!orgId) return null;

  // Compute validation state for mapping
  const requiredFields = CANONICAL_FIELD_DEFS.filter((f) => f.required);
  const unmappedRequired = requiredFields.filter(
    (f) => !columnMapping[f.key] || columnMapping[f.key].trim() === ''
  );
  const isMappingValid = unmappedRequired.length === 0;

  const totalRowsCount = importResult?.totalRecords ?? importResult?.rowCount ?? 0;
  const validRowsCount = importResult?.validRecords ?? importResult?.validCount ?? 0;
  const invalidRowsCount = importResult?.invalidRecords ?? importResult?.invalidCount ?? 0;
  const duplicateRowsCount = importResult?.duplicateRecords ?? importResult?.duplicateCount ?? 0;

  return (
    <div style={{ maxWidth: '840px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/imports`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--rx-text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeftIcon size={14} /> Back to Imports
        </Link>
      </div>

      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Import Transactions from CSV
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
          Upload, map canonical fields, validate records, and ingest into the organizational ledger.
        </p>
      </div>

      {/* Progress / Step Pipeline Tracker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--rx-surface-subtle)',
          borderRadius: 'var(--rx-radius-md)',
          border: '1px solid var(--rx-border)',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        <span style={{ color: selectedFile ? 'var(--rx-success)' : 'var(--rx-text-primary)' }}>
          1. Select File {selectedFile && '✓'}
        </span>
        <span style={{ color: 'var(--rx-text-secondary)' }}>→</span>
        <span
          style={{
            color:
              uiState === 'mapping_columns'
                ? 'var(--rx-text-primary)'
                : isMappingValid && selectedFile
                ? 'var(--rx-success)'
                : 'var(--rx-text-secondary)',
          }}
        >
          2. Map Columns {isMappingValid && selectedFile && '✓'}
        </span>
        <span style={{ color: 'var(--rx-text-secondary)' }}>→</span>
        <span
          style={{
            color:
              uiState === 'uploading' || uiState === 'validating_records' || uiState === 'importing'
                ? 'var(--rx-lime-dark, #2b5e20)'
                : 'var(--rx-text-secondary)',
          }}
        >
          3. Validate & Ingest
        </span>
        <span style={{ color: 'var(--rx-text-secondary)' }}>→</span>
        <span
          style={{
            color:
              uiState === 'completed' || uiState === 'completed_with_errors'
                ? 'var(--rx-success)'
                : uiState === 'failed'
                ? 'var(--rx-danger)'
                : 'var(--rx-text-secondary)',
          }}
        >
          4. Results
        </span>
      </div>

      {uploadError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--rx-danger-bg)',
            border: '1px solid var(--rx-danger-border)',
            borderRadius: 'var(--rx-radius-md)',
            color: 'var(--rx-danger)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Error:</strong> {uploadError}
          </div>
        </div>
      )}

      {/* State: Results (Completed / Completed with Errors / Failed) */}
      {importResult ? (
        <div
          className="rx-card rx-animate-fade-in"
          style={{
            padding: '2rem',
            border: `1px solid ${
              uiState === 'failed'
                ? 'var(--rx-danger-border)'
                : uiState === 'completed_with_errors'
                ? 'var(--rx-warning-border)'
                : 'var(--rx-success-border)'
            }`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor:
                  uiState === 'failed'
                    ? 'var(--rx-danger-bg)'
                    : uiState === 'completed_with_errors'
                    ? 'var(--rx-warning-bg)'
                    : 'var(--rx-success-bg)',
                color:
                  uiState === 'failed'
                    ? 'var(--rx-danger)'
                    : uiState === 'completed_with_errors'
                    ? 'var(--rx-warning)'
                    : 'var(--rx-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {uiState === 'failed' ? <AlertCircleIcon size={20} /> : <CheckCircleIcon size={20} />}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  color:
                    uiState === 'failed'
                      ? 'var(--rx-danger)'
                      : uiState === 'completed_with_errors'
                      ? 'var(--rx-warning)'
                      : 'var(--rx-success)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                }}
              >
                {importResult.duplicateFile
                  ? 'Duplicate File Ingestion Handled'
                  : uiState === 'failed'
                  ? 'Import Failed'
                  : uiState === 'completed_with_errors'
                  ? 'Import Completed with Row Validation Errors'
                  : 'Import Completed Successfully'}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--rx-text-secondary)', marginTop: '0.2rem' }}>
                Batch ID: <code>{importResult.importId}</code> | Status:{' '}
                <StatusBadge status={importResult.status} />
              </div>
            </div>
          </div>

          {importResult.duplicateFile && (
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--rx-warning-bg)',
                border: '1px solid var(--rx-warning-border)',
                borderRadius: 'var(--rx-radius-md)',
                color: 'var(--rx-text-primary)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              <strong>Duplicate File Warning:</strong> An identical CSV file (matching SHA-256 fingerprint) was
              previously uploaded to this data source. To prevent duplicate ledger entries, previously ingested
              batch counts are shown.
            </div>
          )}

          {/* Validation Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.85rem',
              margin: '1.5rem 0',
            }}
          >
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-md)',
                border: '1px solid var(--rx-border)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Rows
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>
                {totalRowsCount}
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--rx-success-bg)',
                borderRadius: 'var(--rx-radius-md)',
                border: '1px solid var(--rx-success-border)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-success)', textTransform: 'uppercase', fontWeight: 700 }}>
                Imported Valid
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--rx-success)', marginTop: '0.25rem' }}>
                {validRowsCount}
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                backgroundColor: invalidRowsCount > 0 ? 'var(--rx-danger-bg)' : 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-md)',
                border: '1px solid var(--rx-border)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: invalidRowsCount > 0 ? 'var(--rx-danger)' : 'var(--rx-text-secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Failed Rows (Errors)
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: invalidRowsCount > 0 ? 'var(--rx-danger)' : 'inherit',
                  marginTop: '0.25rem',
                }}
              >
                {invalidRowsCount}
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                backgroundColor: duplicateRowsCount > 0 ? 'var(--rx-warning-bg)' : 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-md)',
                border: '1px solid var(--rx-border)',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: duplicateRowsCount > 0 ? 'var(--rx-warning)' : 'var(--rx-text-secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Duplicates Flagged
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: duplicateRowsCount > 0 ? 'var(--rx-warning)' : 'inherit',
                  marginTop: '0.25rem',
                }}
              >
                {duplicateRowsCount}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to={`/orgs/${orgId}/imports/${importResult.importId}`} className="rx-btn rx-btn-dark">
              Inspect Batch Details & Errors <ArrowRightIcon size={14} />
            </Link>

            {invalidRowsCount > 0 && (
              <button
                onClick={handleDownloadErrors}
                disabled={isDownloadingErrors}
                className="rx-btn rx-btn-secondary"
              >
                <FileSpreadsheetIcon size={14} />
                {isDownloadingErrors ? 'Downloading Report...' : 'Download Failed-Row Report (CSV)'}
              </button>
            )}

            <Link to={`/orgs/${orgId}/transactions`} className="rx-btn rx-btn-ghost">
              View Transactions Catalog
            </Link>

            <button onClick={resetAll} className="rx-btn rx-btn-secondary" style={{ marginLeft: 'auto' }}>
              Import Another CSV
            </button>
          </div>
        </div>
      ) : (
        /* State: Upload & Mapping Form */
        <form
          onSubmit={handleStartImport}
          className="rx-card"
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}
        >
          {/* 1. Target Data Source */}
          <div>
            <label htmlFor="source-select" className="rx-label" style={{ fontSize: '0.875rem' }}>
              Target Data Source *
            </label>
            <select
              id="source-select"
              required
              value={selectedSourceId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedSourceId(newId);
                if (selectedFile) handleFileSelected(selectedFile, newId);
              }}
              disabled={sourcesLoading || uploadMutation.isPending}
              className="rx-select"
              style={{ fontSize: '0.9rem', padding: '0.65rem 2.25rem 0.65rem 0.85rem' }}
            >
              <option value="">-- Choose Data Source --</option>
              {dataSources?.items.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type} • {ds.direction || 'NEUTRAL'})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Drag & Drop File Selector */}
          <div>
            <label htmlFor="file-input" className="rx-label" style={{ fontSize: '0.875rem' }}>
              CSV File (max 50MB, comma/semicolon/tab-separated) *
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed var(--rx-dark)' : '2px dashed var(--rx-border)',
                backgroundColor: isDragging ? 'var(--rx-surface-muted)' : 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-lg)',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'var(--rx-transition)',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--rx-surface)',
                  border: '1px solid var(--rx-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rx-text-primary)',
                  marginBottom: '0.75rem',
                }}
              >
                <UploadIcon size={20} />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--rx-text-primary)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.25rem' }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB • {csvHeaders.length} headers detected
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--rx-text-primary)' }}>
                    Drag & drop your CSV file here, or click to browse
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.35rem' }}>
                    Standard UTF-8 CSV with optional BOM. Columns will be auto-mapped below.
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files[0]) {
                    handleFileSelected(files[0]);
                  }
                }}
                disabled={uploadMutation.isPending}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* 3. Column Mapping Configuration (Section 4 & Section 8) */}
          {csvHeaders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Configure Canonical Column Mapping
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.2rem' }}>
                    Map CSV headers to ReconcileX standard transaction fields. Required fields must be mapped.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setColumnMapping(suggestColumnMappingClient(csvHeaders))}
                  className="rx-btn rx-btn-secondary rx-btn-sm"
                >
                  Auto-Suggest Mappings
                </button>
              </div>

              {unmappedRequired.length > 0 && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--rx-warning-bg)',
                    borderRadius: 'var(--rx-radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--rx-warning)',
                    fontWeight: 600,
                  }}
                >
                  Missing required field mapping:{' '}
                  {unmappedRequired.map((f) => f.key).join(', ')}
                </div>
              )}

              <div className="rx-table-container">
                <table className="rx-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>ReconcileX Standard Field</th>
                      <th style={{ width: '45%' }}>CSV Header Column</th>
                      <th style={{ width: '20%' }}>Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CANONICAL_FIELD_DEFS.map((field) => {
                      const currentMapped = columnMapping[field.key] || '';
                      return (
                        <tr key={field.key}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{field.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>
                              {field.description}
                            </div>
                          </td>
                          <td>
                            <select
                              value={currentMapped}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnMapping((prev) => {
                                  const updated = { ...prev };
                                  if (val) {
                                    updated[field.key] = val;
                                  } else {
                                    delete updated[field.key];
                                  }
                                  return updated;
                                });
                              }}
                              className="rx-select"
                              style={{
                                width: '100%',
                                padding: '0.4rem 2rem 0.4rem 0.65rem',
                                fontSize: '0.8125rem',
                                borderColor: field.required && !currentMapped ? 'var(--rx-danger)' : undefined,
                              }}
                            >
                              <option value="">-- Unmapped --</option>
                              {csvHeaders.map((hdr) => (
                                <option key={hdr} value={hdr}>
                                  {hdr}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {field.required ? (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: currentMapped ? 'var(--rx-success)' : 'var(--rx-danger)',
                                }}
                              >
                                {currentMapped ? '✓ Mapped' : '● Required'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>
                                Optional
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Data Sample Preview */}
              {previewRows.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--rx-text-secondary)', marginBottom: '0.4rem' }}>
                    CSV Data Preview (First {previewRows.length} rows):
                  </div>
                  <div className="rx-table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="rx-table" style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr>
                          {csvHeaders.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {csvHeaders.map((_, colIdx) => (
                              <td key={colIdx} style={{ whiteSpace: 'nowrap' }}>
                                {row[colIdx] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submission CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={uploadMutation.isPending || !selectedSourceId || !selectedFile || !isMappingValid}
                className="rx-btn rx-btn-dark rx-btn-lg"
                style={{ flex: 1 }}
                title={
                  uploadMutation.isPending
                    ? 'Import currently processing...'
                    : !selectedSourceId
                    ? 'Please select a target data source above'
                    : !selectedFile
                    ? 'Please select or drop a CSV file'
                    : !isMappingValid
                    ? `Please map required fields: ${unmappedRequired.map((f) => f.label).join(', ')}`
                    : 'Click to upload and ingest transactions'
                }
              >
                {uploadMutation.isPending
                  ? uiState === 'validating_records'
                    ? 'Validating Schema & Headers...'
                    : uiState === 'uploading'
                    ? 'Uploading CSV File...'
                    : 'Ingesting & Normalizing Transactions...'
                  : 'Upload & Start Import'}
              </button>
              {selectedFile && (
                <button type="button" onClick={resetAll} className="rx-btn rx-btn-ghost">
                  Reset
                </button>
              )}
            </div>

            {selectedFile && !selectedSourceId && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--rx-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 600,
                }}
              >
                <AlertCircleIcon size={15} />
                Please select a Target Data Source from the dropdown above to enable import.
              </div>
            )}

            {selectedFile && !isMappingValid && (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--rx-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 600,
                }}
              >
                <AlertCircleIcon size={15} />
                Required column mappings missing: {unmappedRequired.map((f) => f.label).join(', ')}. Please assign CSV columns in the table above.
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
