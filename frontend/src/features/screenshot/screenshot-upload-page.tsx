import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { screenshotApi, ExtractScreenshotResponse, IngestScreenshotResponse } from '../../api/endpoints/screenshot';
import { ApiError } from '../../api/errors';
import { formatAmountMinor } from '../../shared/lib/amount';
import {
  CameraIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  SparkleIcon,
  ImageIcon,
  ReceiptIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshIcon,
  GitCompareIcon,
} from '../../shared/components/icons';

type IngestionState = 'idle' | 'extracting' | 'review' | 'ingesting' | 'completed' | 'error';

export const ScreenshotUploadPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

  // State
  const [targetDataSourceId, setTargetDataSourceId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ingestionState, setIngestionState] = useState<IngestionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractScreenshotResponse | null>(null);
  const [rawOcrExpanded, setRawOcrExpanded] = useState(false);
  const [ingestedResult, setIngestedResult] = useState<IngestScreenshotResponse | null>(null);

  // Editable Form fields
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('INR');
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [externalId, setExternalId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [externalTxnId, setExternalTxnId] = useState<string>('');
  const [merchantOrOrderId, setMerchantOrOrderId] = useState<string>('');
  const [txnType, setTxnType] = useState<string>('PAYMENT');
  const [description, setDescription] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Data Sources
  const { data: dataSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  // Preselect first data source if none selected
  useEffect(() => {
    if (dataSources?.items && dataSources.items.length > 0 && !targetDataSourceId) {
      setTargetDataSourceId(dataSources.items[0].id);
    }
  }, [dataSources, targetDataSourceId]);

  // Clipboard paste listener (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (ingestionState === 'extracting' || ingestionState === 'ingesting') return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFileSelection(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [ingestionState]);

  // Cleanup object url on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelection = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPEG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds 15MB limit.');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Automatically trigger extraction
    performExtraction(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  // 1. Extraction Mutation
  const extractMutation = useMutation({
    mutationFn: (file: File) => screenshotApi.extractScreenshot(orgId!, file),
    onSuccess: (data) => {
      setExtractedData(data);
      // Populate editable fields with detected values
      setAmount(data.amount);
      setCurrency(data.currency || 'INR');
      setTransactionDate(data.transactionDate || new Date().toISOString().slice(0, 10));
      setExternalId(data.externalId || '');
      setReference(data.reference || '');
      setExternalTxnId(data.externalTxnId || '');
      setMerchantOrOrderId(data.merchantOrOrderId || '');
      setTxnType(data.txnType || 'PAYMENT');
      setDescription(data.description || '');
      setIngestionState('review');
    },
    onError: (err: any) => {
      setIngestionState('error');
      if (ApiError.isApiError(err)) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err?.message || 'Failed to extract text from screenshot.');
      }
    },
  });

  const performExtraction = (file: File) => {
    setIngestionState('extracting');
    setErrorMessage(null);
    setExtractedData(null);
    extractMutation.mutate(file);
  };

  // 2. Ingest Mutation
  const ingestMutation = useMutation({
    mutationFn: (payload: any) => screenshotApi.ingestScreenshot(orgId!, payload),
    onSuccess: (res) => {
      setIngestedResult(res);
      setIngestionState('completed');
      queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
    },
    onError: (err: any) => {
      setIngestionState('review');
      if (ApiError.isApiError(err)) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err?.message || 'Failed to ingest transaction into ledger.');
      }
    },
  });

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDataSourceId) {
      setErrorMessage('Please select a target Data Source for this transaction.');
      return;
    }
    if (!externalId.trim()) {
      setErrorMessage('External ID / UTR is required.');
      return;
    }
    if (!amount || amount <= 0) {
      setErrorMessage('Valid transaction amount greater than 0 is required.');
      return;
    }
    if (!transactionDate) {
      setErrorMessage('Transaction date is required.');
      return;
    }

    setErrorMessage(null);
    setIngestionState('ingesting');

    ingestMutation.mutate({
      dataSourceId: targetDataSourceId,
      externalId: externalId.trim(),
      amount: Number(amount),
      currency: currency.toUpperCase().trim(),
      transactionDate,
      reference: reference.trim() || undefined,
      externalTxnId: externalTxnId.trim() || undefined,
      merchantOrOrderId: merchantOrOrderId.trim() || undefined,
      txnType: txnType.trim() || undefined,
      metadata: {
        source: 'SCREENSHOT_OCR_INGESTION',
        extractionMethod: extractedData?.extractionMethod,
        confidenceScore: extractedData?.confidenceScore,
        rawOcrPreview: extractedData?.rawOcrText?.slice(0, 300),
        originalFileName: selectedFile?.name,
      },
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtractedData(null);
    setIngestedResult(null);
    setIngestionState('idle');
    setErrorMessage(null);
    setAmount(0);
    setCurrency('INR');
    setTransactionDate('');
    setExternalId('');
    setReference('');
    setExternalTxnId('');
    setMerchantOrOrderId('');
    setTxnType('PAYMENT');
    setDescription('');
  };

  if (!orgId) return null;

  const selectedDs = dataSources?.items.find((ds) => ds.id === targetDataSourceId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Link
            to={`/orgs/${orgId}/transactions`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--rx-text-secondary)',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeftIcon size={14} /> Back to Transactions
          </Link>
          <span style={{ color: 'var(--rx-text-muted)' }}>/</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--rx-text-primary)', fontWeight: 600 }}>
            Screenshot Receipt OCR
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CameraIcon size={26} style={{ color: 'var(--rx-dark)' }} />
              Receipt & Screenshot Ingestion
            </h1>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
              Upload or paste payment receipts (UPI, GPay, Stripe, Bank SMS, Invoices). AI OCR extracts transaction data and ingests it directly into your ledger ready for reconciliation matching.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/orgs/${orgId}/reconciliation/new`} className="rx-btn rx-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <GitCompareIcon size={16} /> Open Reconciliation Run
            </Link>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          className="rx-card"
          style={{
            backgroundColor: 'var(--rx-danger-bg)',
            borderColor: 'var(--rx-danger-border)',
            padding: '1rem 1.25rem',
            color: 'var(--rx-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircleIcon size={20} />
          <div style={{ flex: 1, fontSize: '0.875rem' }}>{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="rx-btn rx-btn-ghost"
            style={{ padding: '0.2rem 0.5rem', color: 'var(--rx-danger)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SUCCESS STATE */}
      {ingestionState === 'completed' && ingestedResult && (
        <div
          className="rx-card rx-animate-fade-in"
          style={{
            padding: '2.5rem 2rem',
            backgroundColor: 'var(--rx-surface)',
            border: '2px solid var(--rx-success-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--rx-success-bg)',
                color: 'var(--rx-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleIcon size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--rx-success)' }}>
                Transaction Ingested Successfully!
              </h2>
              <div style={{ color: 'var(--rx-text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                {ingestedResult.message}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              backgroundColor: 'var(--rx-surface-subtle)',
              padding: '1.25rem',
              borderRadius: 'var(--rx-radius-md)',
              border: '1px solid var(--rx-border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Transaction ID
              </div>
              <div style={{ fontFamily: 'var(--rx-font-mono)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {ingestedResult.id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                External ID / Reference
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.25rem' }}>
                {ingestedResult.externalId} {ingestedResult.reference ? `(${ingestedResult.reference})` : ''}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Amount Ingested
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--rx-dark)', marginTop: '0.25rem' }}>
                {formatAmountMinor(ingestedResult.amountMinor, ingestedResult.currency)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Ledger Status
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--rx-radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--rx-info-bg)',
                    color: 'var(--rx-info)',
                    border: '1px solid var(--rx-info-border)',
                  }}
                >
                  {ingestedResult.status} (Eligible for Reconciliation)
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.5rem' }}>
            <Link
              to={`/orgs/${orgId}/reconciliation/new?sourceA=${ingestedResult.dataSourceId}`}
              className="rx-btn rx-btn-lime"
              style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <GitCompareIcon size={16} /> Run Reconciliation with This Transaction
            </Link>

            <Link
              to={`/orgs/${orgId}/transactions?sourceId=${ingestedResult.dataSourceId}`}
              className="rx-btn rx-btn-dark"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ReceiptIcon size={16} /> View in Transactions Explorer
            </Link>

            <button onClick={handleReset} className="rx-btn rx-btn-secondary" style={{ marginLeft: 'auto' }}>
              Extract Another Screenshot
            </button>
          </div>
        </div>
      )}

      {/* IDLE / EXTRACTION / REVIEW FORM */}
      {ingestionState !== 'completed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Target Data Source Card */}
          <div className="rx-card" style={{ padding: '1.25rem 1.5rem', backgroundColor: 'var(--rx-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <label htmlFor="target-ds" className="rx-label" style={{ fontSize: '0.85rem' }}>
                  Target Ledger Data Source *
                </label>
                <select
                  id="target-ds"
                  value={targetDataSourceId}
                  onChange={(e) => setTargetDataSourceId(e.target.value)}
                  disabled={sourcesLoading || ingestionState === 'extracting' || ingestionState === 'ingesting'}
                  className="rx-select"
                  style={{ fontSize: '0.9rem', width: '100%', maxWidth: '450px' }}
                >
                  {dataSources?.items.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.type} • {ds.direction || 'NEUTRAL'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedDs && (
                <div
                  style={{
                    backgroundColor: 'var(--rx-surface-subtle)',
                    padding: '0.65rem 1rem',
                    borderRadius: 'var(--rx-radius-md)',
                    border: '1px solid var(--rx-border)',
                    fontSize: '0.825rem',
                    color: 'var(--rx-text-secondary)',
                  }}
                >
                  Target data source: <strong style={{ color: 'var(--rx-text-primary)' }}>{selectedDs.name}</strong> (
                  <code style={{ fontSize: '0.75rem' }}>{selectedDs.type}</code> • {selectedDs.direction || 'NEUTRAL'})
                </div>
              )}
            </div>
          </div>

          {/* If No Image Selected yet: Big Dropzone */}
          {!selectedFile && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rx-card"
              style={{
                border: isDragging ? '2px dashed var(--rx-dark)' : '2px dashed var(--rx-border)',
                backgroundColor: isDragging ? 'var(--rx-surface-muted)' : 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-lg)',
                padding: '4rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'var(--rx-transition)',
                boxShadow: isDragging ? 'var(--rx-shadow-md)' : 'none',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelection(e.target.files[0]);
                  }
                }}
              />

              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--rx-surface)',
                  border: '1px solid var(--rx-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rx-dark)',
                  marginBottom: '1rem',
                  boxShadow: 'var(--rx-shadow-sm)',
                }}
              >
                <CameraIcon size={30} />
              </div>

              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Drop receipt screenshot here, or click to browse
              </h3>

              <p style={{ margin: '0.5rem auto 1.5rem', color: 'var(--rx-text-secondary)', fontSize: '0.9rem', maxWidth: '520px' }}>
                Supports PNG, JPEG, WebP receipts from Google Pay, PhonePe, Paytm, Stripe, Razorpay, Bank SMS, or POS terminals.
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--rx-radius-full)',
                  backgroundColor: 'var(--rx-surface)',
                  border: '1px solid var(--rx-border)',
                  fontSize: '0.8rem',
                  color: 'var(--rx-text-secondary)',
                }}
              >
                <SparkleIcon size={14} style={{ color: '#D97706' }} />
                <span>Tip: You can also press <strong>Ctrl+V</strong> to paste a screenshot directly from your clipboard!</span>
              </div>
            </div>
          )}

          {/* EXTRACTION IN PROGRESS */}
          {ingestionState === 'extracting' && (
            <div
              className="rx-card rx-animate-fade-in"
              style={{
                padding: '3rem 2rem',
                textAlign: 'center',
                backgroundColor: 'var(--rx-surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  border: '3px solid var(--rx-border)',
                  borderTopColor: 'var(--rx-dark)',
                  animation: 'rx-spin 0.8s linear infinite',
                }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Analyzing Screenshot with AI Vision & OCR...
                </h3>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Scanning visual layout, detecting currency, parsing monetary amounts, and extracting transaction reference tokens.
                </p>
              </div>

              {previewUrl && (
                <div style={{ marginTop: '1rem', maxWidth: '280px', borderRadius: 'var(--rx-radius-md)', overflow: 'hidden', border: '1px solid var(--rx-border)' }}>
                  <img src={previewUrl} alt="Receipt preview" style={{ width: '100%', display: 'block', maxHeight: '180px', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          )}

          {/* REVIEW & VERIFICATION VIEW (SPLIT SCREEN) */}
          {(ingestionState === 'review' || ingestionState === 'ingesting') && extractedData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column: Image Preview & Extraction Diagnostics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="rx-card" style={{ padding: '1rem', backgroundColor: 'var(--rx-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                      <ImageIcon size={16} /> Screenshot Preview
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="rx-btn rx-btn-ghost rx-btn-sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Change Image
                    </button>
                  </div>

                  {previewUrl && (
                    <div
                      style={{
                        borderRadius: 'var(--rx-radius-md)',
                        overflow: 'hidden',
                        border: '1px solid var(--rx-border)',
                        backgroundColor: '#1E201E',
                        maxHeight: '420px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="Uploaded receipt"
                        style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{selectedFile?.name}</span>
                    <span>{selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : ''}</span>
                  </div>
                </div>

                {/* AI / OCR Extraction Diagnostics Card */}
                <div className="rx-card" style={{ padding: '1.25rem', backgroundColor: 'var(--rx-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem' }}>
                      <SparkleIcon size={14} style={{ color: '#D97706' }} /> Extraction Diagnostics
                    </div>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--rx-radius-sm)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: extractedData.extractionMethod === 'GEMINI_VISION' ? 'var(--rx-success-bg)' : 'var(--rx-pale-yellow-light)',
                        color: extractedData.extractionMethod === 'GEMINI_VISION' ? 'var(--rx-success)' : '#854D0E',
                        border: '1px solid var(--rx-border)',
                      }}
                    >
                      {extractedData.extractionMethod === 'GEMINI_VISION' ? 'Gemini Multimodal Vision' : 'Tesseract OCR + NLP'}
                    </span>
                  </div>

                  {/* Confidence meter */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--rx-text-secondary)' }}>Confidence Score</span>
                      <strong style={{ color: extractedData.confidenceScore >= 80 ? 'var(--rx-success)' : '#D97706' }}>
                        {extractedData.confidenceScore}%
                      </strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--rx-surface-muted)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${extractedData.confidenceScore}%`,
                          height: '100%',
                          backgroundColor: extractedData.confidenceScore >= 80 ? 'var(--rx-success)' : '#D97706',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Collapsible Raw OCR text */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setRawOcrExpanded(!rawOcrExpanded)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.75rem',
                        color: 'var(--rx-text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: 600,
                      }}
                    >
                      {rawOcrExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                      {rawOcrExpanded ? 'Hide Raw OCR Text' : 'View Detected OCR Text'}
                    </button>

                    {rawOcrExpanded && (
                      <pre
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.75rem',
                          backgroundColor: 'var(--rx-surface-subtle)',
                          borderRadius: 'var(--rx-radius-sm)',
                          fontSize: '0.7rem',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: 'var(--rx-text-primary)',
                          border: '1px solid var(--rx-border)',
                        }}
                      >
                        {extractedData.rawOcrText || '(No OCR text detected)'}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Editable Verification Form */}
              <form
                onSubmit={handleIngest}
                className="rx-card"
                style={{ padding: '1.75rem 2rem', backgroundColor: 'var(--rx-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    Verify & Ingest Transaction
                  </h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.85rem' }}>
                    Review the extracted fields below. Values are pre-filled by AI OCR. Adjust any details if needed before committing to the organizational ledger.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Amount */}
                  <div>
                    <label htmlFor="txn-amount" className="rx-label">
                      Monetary Amount *
                    </label>
                    <input
                      id="txn-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount || ''}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="rx-input"
                      placeholder="e.g. 1499.00"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label htmlFor="txn-currency" className="rx-label">
                      Currency (ISO 3-Letter) *
                    </label>
                    <select
                      id="txn-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="rx-select"
                    >
                      <option value="INR">INR (₹ Indian Rupee)</option>
                      <option value="USD">USD ($ US Dollar)</option>
                      <option value="EUR">EUR (€ Euro)</option>
                      <option value="GBP">GBP (£ British Pound)</option>
                      <option value="AUD">AUD (A$ Australian Dollar)</option>
                      <option value="CAD">CAD (C$ Canadian Dollar)</option>
                      <option value="SGD">SGD (S$ Singapore Dollar)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Transaction Date */}
                  <div>
                    <label htmlFor="txn-date" className="rx-label">
                      Transaction Date (YYYY-MM-DD) *
                    </label>
                    <input
                      id="txn-date"
                      type="date"
                      required
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="rx-input"
                    />
                  </div>

                  {/* Transaction Type */}
                  <div>
                    <label htmlFor="txn-type" className="rx-label">
                      Transaction Type
                    </label>
                    <select
                      id="txn-type"
                      value={txnType}
                      onChange={(e) => setTxnType(e.target.value)}
                      className="rx-select"
                    >
                      <option value="PAYMENT">PAYMENT (Standard settlement)</option>
                      <option value="SALE">SALE (Customer purchase)</option>
                      <option value="CAPTURE">CAPTURE (Payment gateway capture)</option>
                      <option value="REFUND">REFUND (Customer refund / reversal)</option>
                      <option value="TRANSFER">TRANSFER (Account transfer)</option>
                      <option value="CREDIT">CREDIT (Inflow credit)</option>
                      <option value="DEBIT">DEBIT (Outflow debit)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* External ID */}
                  <div>
                    <label htmlFor="txn-ext-id" className="rx-label">
                      External ID / UTR / Order No. *
                    </label>
                    <input
                      id="txn-ext-id"
                      type="text"
                      required
                      value={externalId}
                      onChange={(e) => setExternalId(e.target.value)}
                      placeholder="e.g. ORD-1002 or 228941092831"
                      className="rx-input"
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)', marginTop: '0.2rem' }}>
                      Unique identifier used to prevent ledger duplicates.
                    </div>
                  </div>

                  {/* Reference Key for Reconciliation */}
                  <div>
                    <label htmlFor="txn-ref" className="rx-label">
                      Counterparty Matching Reference
                    </label>
                    <input
                      id="txn-ref"
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. ORD-1002 or REF-5541"
                      className="rx-input"
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)', marginTop: '0.2rem' }}>
                      Key used by the reconciliation engine to match counterparty records.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Gateway Txn ID */}
                  <div>
                    <label htmlFor="txn-gw-id" className="rx-label">
                      Gateway Reference ID
                    </label>
                    <input
                      id="txn-gw-id"
                      type="text"
                      value={externalTxnId}
                      onChange={(e) => setExternalTxnId(e.target.value)}
                      placeholder="e.g. PG-TXN-7002 or pay_Nk418s"
                      className="rx-input"
                    />
                  </div>

                  {/* Merchant / Order ID */}
                  <div>
                    <label htmlFor="txn-merchant" className="rx-label">
                      Merchant / Order ID
                    </label>
                    <input
                      id="txn-merchant"
                      type="text"
                      value={merchantOrOrderId}
                      onChange={(e) => setMerchantOrOrderId(e.target.value)}
                      placeholder="e.g. ORD-1002"
                      className="rx-input"
                    />
                  </div>
                </div>

                {/* Description / Counterparty */}
                <div>
                  <label htmlFor="txn-desc" className="rx-label">
                    Description / Counterparty
                  </label>
                  <input
                    id="txn-desc"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Payment to Supplier / Google Pay settlement"
                    className="rx-input"
                  />
                </div>

                {/* Submit Action */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--rx-border-subtle)' }}>
                  <button
                    type="submit"
                    disabled={ingestionState === 'ingesting'}
                    className="rx-btn rx-btn-lime rx-btn-lg"
                    style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {ingestionState === 'ingesting' ? (
                      <>
                        <RefreshIcon size={16} className="rx-animate-spin" /> Ingesting into Ledger...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon size={18} /> Ingest into Ledger & Enable Reconciliation
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={ingestionState === 'ingesting'}
                    className="rx-btn rx-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
