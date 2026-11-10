import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import {
  screenshotApi,
  ExtractScreenshotResponse,
  IngestScreenshotResponse,
} from '../../api/endpoints/screenshot';
import {
  ScreenshotDatasetDetail,
  ScreenshotExtractedRecord,
  UpdateExtractedRecordPayload,
} from '../../api/types';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDate, formatDateTime } from '../../shared/lib/date';
import {
  CameraIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  SparkleIcon,
  ImageIcon,
  ReceiptIcon,
  RefreshIcon,
  GitCompareIcon,
  XIcon,
  UploadIcon,
} from '../../shared/components/icons';

type ActiveTab = 'batch_dataset' | 'single_extract' | 'dataset_history';

export const ScreenshotUploadPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('batch_dataset');

  // ---------------------------------------------------------------------------
  // Batch Dataset State
  // ---------------------------------------------------------------------------
  const [datasetName, setDatasetName] = useState('');
  const [targetBatchSourceId, setTargetBatchSourceId] = useState('');
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [isBatchDragging, setIsBatchDragging] = useState(false);
  const [activeDataset, setActiveDataset] = useState<ScreenshotDatasetDetail | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ScreenshotExtractedRecord | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateExtractedRecordPayload>({});
  const [previewModalFile, setPreviewModalFile] = useState<{ url: string; filename: string } | null>(null);
  const [confirmSuccessMessage, setConfirmSuccessMessage] = useState<string | null>(null);

  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Single Ingest State (Backward Compatibility)
  // ---------------------------------------------------------------------------
  const [targetDataSourceId, setTargetDataSourceId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleErrorMessage, setSingleErrorMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractScreenshotResponse | null>(null);
  const [rawOcrExpanded, setRawOcrExpanded] = useState(false);
  const [ingestedResult, setIngestedResult] = useState<IngestScreenshotResponse | null>(null);

  // Single Editable Form
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

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  const { data: dataSources } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  const { data: datasetsList, isLoading: datasetsLoading, refetch: refetchDatasets } = useQuery({
    queryKey: ['screenshot-datasets', orgId],
    queryFn: () => screenshotApi.getDatasets(orgId!),
    enabled: !!orgId,
  });

  // Preselect default target data source
  useEffect(() => {
    if (dataSources?.items && dataSources.items.length > 0 && !targetDataSourceId) {
      setTargetDataSourceId(dataSources.items[0].id);
    }
  }, [dataSources, targetDataSourceId]);

  // Cleanup object url for single upload
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ---------------------------------------------------------------------------
  // Batch Dataset Mutations
  // ---------------------------------------------------------------------------
  const createDatasetMutation = useMutation({
    mutationFn: async () => {
      if (!datasetName.trim()) throw new Error('Please enter a dataset name.');
      if (batchFiles.length === 0) throw new Error('Please select at least one screenshot image.');
      return screenshotApi.createDataset(
        orgId!,
        datasetName.trim(),
        batchFiles,
        targetBatchSourceId || undefined,
      );
    },
    onSuccess: (data) => {
      setActiveDataset(data);
      setBatchFiles([]);
      setBatchError(null);
      queryClient.invalidateQueries({ queryKey: ['screenshot-datasets', orgId] });
    },
    onError: (err: any) => {
      setBatchError(err?.message || 'Failed to upload and extract screenshot dataset.');
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({
      recordId,
      payload,
    }: {
      recordId: string;
      payload: UpdateExtractedRecordPayload;
    }) => {
      return screenshotApi.updateExtractedRecord(orgId!, recordId, payload);
    },
    onSuccess: (updatedRecord) => {
      if (activeDataset && activeDataset.records) {
        setActiveDataset({
          ...activeDataset,
          records: activeDataset.records.map((r) =>
            r.id === updatedRecord.id ? { ...r, ...updatedRecord } : r,
          ),
        });
      }
      setEditingRecord(null);
      setEditFormData({});
      setBatchError(null);
    },
    onError: (err: any) => {
      setBatchError(err?.message || 'Failed to update record.');
    },
  });

  const confirmDatasetMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      return screenshotApi.confirmDataset(orgId!, datasetId, {
        dataSourceName: activeDataset?.name,
      });
    },
    onSuccess: (confirmed) => {
      setActiveDataset(confirmed);
      setConfirmSuccessMessage(
        `Dataset "${confirmed.name}" confirmed successfully! Ingested ${confirmed.confirmedRecords} transaction(s) into ledger. This dataset is now READY for reconciliation.`,
      );
      queryClient.invalidateQueries({ queryKey: ['screenshot-datasets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
    },
    onError: (err: any) => {
      setBatchError(err?.message || 'Failed to confirm dataset.');
    },
  });

  // ---------------------------------------------------------------------------
  // Single Extraction & Ingest Mutations
  // ---------------------------------------------------------------------------
  const singleExtractMutation = useMutation({
    mutationFn: (file: File) => screenshotApi.extractScreenshot(orgId!, file),
    onSuccess: (data) => {
      setExtractedData(data);
      setAmount(data.amount);
      setCurrency(data.currency);
      setTransactionDate(data.transactionDate);
      setExternalId(data.externalId);
      setReference(data.reference || '');
      setExternalTxnId(data.externalTxnId || '');
      setMerchantOrOrderId(data.merchantOrOrderId || '');
      setTxnType(data.txnType || 'PAYMENT');
      setDescription(data.description || '');
      setSingleLoading(false);
    },
    onError: (err: any) => {
      setSingleLoading(false);
      setSingleErrorMessage(err?.message || 'Failed to extract screenshot.');
    },
  });

  const singleIngestMutation = useMutation({
    mutationFn: (payload: any) => screenshotApi.ingestScreenshot(orgId!, payload),
    onSuccess: (res) => {
      setIngestedResult(res);
      setSingleLoading(false);
      queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
    },
    onError: (err: any) => {
      setSingleLoading(false);
      setSingleErrorMessage(err?.message || 'Failed to ingest transaction.');
    },
  });

  // Batch file handling
  const handleBatchFileAdd = (files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith('image/')) {
        newFiles.push(f);
      }
    }
    setBatchFiles((prev) => [...prev, ...newFiles]);
  };

  const removeBatchFile = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const loadDatasetForReview = async (datasetId: string) => {
    try {
      const detail = await screenshotApi.getDatasetById(orgId!, datasetId);
      setActiveDataset(detail);
      setActiveTab('batch_dataset');
      setConfirmSuccessMessage(null);
      setBatchError(null);
    } catch (e: any) {
      setBatchError(e?.message || 'Failed to load dataset details.');
    }
  };

  const startEditRecord = (record: ScreenshotExtractedRecord) => {
    setEditingRecord(record);
    setEditFormData({
      externalId: record.externalId,
      amount: record.amount,
      currency: record.currency,
      transactionDate:
        typeof record.transactionDate === 'string'
          ? record.transactionDate.split('T')[0]
          : new Date(record.transactionDate).toISOString().split('T')[0],
      reference: record.reference || '',
      externalTxnId: record.externalTxnId || '',
      merchantOrOrderId: record.merchantOrOrderId || '',
      txnType: record.txnType || 'PAYMENT',
      paymentMethod: record.paymentMethod || '',
      senderReceiver: record.senderReceiver || '',
      description: record.description || '',
    });
  };

  if (!orgId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1240px', margin: '0 auto' }}>
      {/* Breadcrumb Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Link
            to={`/orgs/${orgId}/data-sources`}
            style={{
              color: 'var(--rx-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            <ArrowLeftIcon size={14} /> Back to Data Sources
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CameraIcon size={28} style={{ color: 'var(--rx-primary)' }} />
              Screenshot Transaction Ingestion
            </h1>
            <p style={{ margin: '0.35rem 0 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
              Upload single or batch payment screenshots (UPI, Bank, Stripe, Razorpay). Extract structured transaction data, review confidence, and ingest directly into reconciliation.
            </p>
          </div>
          <Link
            to={`/orgs/${orgId}/reconciliation/new`}
            className="rx-btn rx-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <GitCompareIcon size={16} /> New Reconciliation Run
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rx-border)', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('batch_dataset')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'batch_dataset' ? '2px solid var(--rx-primary)' : '2px solid transparent',
            color: activeTab === 'batch_dataset' ? 'var(--rx-primary)' : 'var(--rx-text-secondary)',
            fontWeight: activeTab === 'batch_dataset' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <UploadIcon size={16} /> Batch Dataset Ingestion & Review
          {activeDataset && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                backgroundColor: activeDataset.status === 'READY' ? 'var(--rx-success-bg)' : 'var(--rx-warning-bg)',
                color: activeDataset.status === 'READY' ? 'var(--rx-success)' : 'var(--rx-warning)',
                fontWeight: 700,
              }}
            >
              {activeDataset.status}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('dataset_history')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'dataset_history' ? '2px solid var(--rx-primary)' : '2px solid transparent',
            color: activeTab === 'dataset_history' ? 'var(--rx-primary)' : 'var(--rx-text-secondary)',
            fontWeight: activeTab === 'dataset_history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <ReceiptIcon size={16} /> Ingested Datasets
          {datasetsList && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                backgroundColor: 'var(--rx-surface-hover)',
                color: 'var(--rx-text-secondary)',
              }}
            >
              {datasetsList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('single_extract')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'single_extract' ? '2px solid var(--rx-primary)' : '2px solid transparent',
            color: activeTab === 'single_extract' ? 'var(--rx-primary)' : 'var(--rx-text-secondary)',
            fontWeight: activeTab === 'single_extract' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <SparkleIcon size={16} /> Quick Single Receipt OCR
        </button>
      </div>

      {/* =======================================================================
          TAB 1: BATCH DATASET INGESTION & REVIEW
          ======================================================================= */}
      {activeTab === 'batch_dataset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {batchError && (
            <div
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--rx-danger-bg)',
                border: '1px solid var(--rx-danger-border)',
                borderRadius: 'var(--rx-radius-md)',
                color: 'var(--rx-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <AlertCircleIcon size={18} />
              <div><strong>Error:</strong> {batchError}</div>
            </div>
          )}

          {confirmSuccessMessage && (
            <div
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--rx-success-bg)',
                border: '1px solid var(--rx-success-border)',
                borderRadius: 'var(--rx-radius-md)',
                color: 'var(--rx-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircleIcon size={20} />
                <span style={{ fontWeight: 600 }}>{confirmSuccessMessage}</span>
              </div>
              <Link
                to={`/orgs/${orgId}/reconciliation/new`}
                className="rx-btn rx-btn-primary rx-btn-sm"
              >
                Create Reconciliation Run &rarr;
              </Link>
            </div>
          )}

          {/* If no active dataset being reviewed, show upload form */}
          {!activeDataset ? (
            <div className="rx-card" style={{ padding: '2rem' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>
                1. Upload Batch of Transaction Screenshots
              </h2>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                Images are securely stored in private S3-compatible storage. OCR will extract records into a staged review dataset where you can verify fields before saving into the ledger.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Dataset Name *
                  </label>
                  <input
                    type="text"
                    className="rx-input"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    placeholder="e.g. Vendor Invoices - Batch 1"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Target Data Source (Optional)
                  </label>
                  <select
                    className="rx-select"
                    value={targetBatchSourceId}
                    onChange={(e) => setTargetBatchSourceId(e.target.value)}
                  >
                    <option value="">Auto-create new Data Source from dataset name</option>
                    {dataSources?.items.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsBatchDragging(true);
                }}
                onDragLeave={() => setIsBatchDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsBatchDragging(false);
                  handleBatchFileAdd(e.dataTransfer.files);
                }}
                onClick={() => batchFileInputRef.current?.click()}
                style={{
                  border: isBatchDragging ? '2px dashed var(--rx-primary)' : '2px dashed var(--rx-border)',
                  backgroundColor: isBatchDragging ? 'var(--rx-surface-hover)' : 'var(--rx-surface)',
                  padding: '2.5rem 1.5rem',
                  borderRadius: 'var(--rx-radius-lg)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  marginBottom: '1.5rem',
                }}
              >
                <input
                  ref={batchFileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleBatchFileAdd(e.target.files)}
                />
                <CameraIcon size={44} style={{ color: 'var(--rx-text-muted)', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                  Click to select multiple screenshots or drag & drop files here
                </div>
                <div style={{ color: 'var(--rx-text-muted)', fontSize: '0.85rem' }}>
                  Supports PNG, JPG, JPEG, and WebP (up to 10MB each)
                </div>
              </div>

              {/* Selected Files List */}
              {batchFiles.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Selected Files ({batchFiles.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {batchFiles.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.4rem 0.75rem',
                          backgroundColor: 'var(--rx-surface-hover)',
                          borderRadius: 'var(--rx-radius-sm)',
                          fontSize: '0.825rem',
                          border: '1px solid var(--rx-border)',
                        }}
                      >
                        <ImageIcon size={14} />
                        <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ color: 'var(--rx-text-muted)' }}>
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBatchFile(idx);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--rx-danger)',
                            cursor: 'pointer',
                            padding: '0 0.2rem',
                          }}
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="rx-btn rx-btn-primary"
                  disabled={batchFiles.length === 0 || !datasetName.trim() || createDatasetMutation.isPending}
                  onClick={() => createDatasetMutation.mutate()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {createDatasetMutation.isPending ? (
                    <>
                      <RefreshIcon size={16} className="animate-spin" /> Uploading & Extracting OCR...
                    </>
                  ) : (
                    <>
                      <SparkleIcon size={16} /> Upload & Extract Staged Dataset ({batchFiles.length} images)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ===============================================================
               Review & Confirmation Interface
               =============================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Dataset Header Card */}
              <div
                className="rx-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  backgroundColor: 'var(--rx-surface)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
                      {activeDataset.name}
                    </h2>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        backgroundColor:
                          activeDataset.status === 'READY'
                            ? 'var(--rx-success-bg)'
                            : activeDataset.status === 'REVIEW_REQUIRED'
                            ? 'var(--rx-warning-bg)'
                            : 'var(--rx-surface-hover)',
                        color:
                          activeDataset.status === 'READY'
                            ? 'var(--rx-success)'
                            : activeDataset.status === 'REVIEW_REQUIRED'
                            ? 'var(--rx-warning)'
                            : 'var(--rx-text-secondary)',
                      }}
                    >
                      {activeDataset.status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--rx-text-secondary)', fontSize: '0.85rem' }}>
                    Created: {formatDateTime(activeDataset.createdAt)} • Files: {activeDataset.totalFiles} • Staged Records: {activeDataset.totalRecords}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="rx-btn rx-btn-secondary rx-btn-sm"
                    onClick={() => {
                      setActiveDataset(null);
                      setConfirmSuccessMessage(null);
                    }}
                  >
                    Upload Another Batch
                  </button>

                  {activeDataset.status === 'REVIEW_REQUIRED' && (
                    <button
                      type="button"
                      className="rx-btn rx-btn-primary rx-btn-sm"
                      disabled={confirmDatasetMutation.isPending}
                      onClick={() => confirmDatasetMutation.mutate(activeDataset.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      {confirmDatasetMutation.isPending ? (
                        <>
                          <RefreshIcon size={14} className="animate-spin" /> Ingesting into Ledger...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon size={14} /> Confirm & Ingest Dataset
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Records Table */}
              <div className="rx-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--rx-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                      Extracted Transaction Records ({activeDataset.records?.length || 0})
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.825rem' }}>
                      Review values extracted from screenshots. Low confidence or duplicate records are flagged for verification.
                    </p>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="rx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--rx-surface-hover)', textAlign: 'left', borderBottom: '1px solid var(--rx-border)' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Screenshot</th>
                        <th style={{ padding: '0.75rem 1rem' }}>External ID / UTR</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Reference / Counterparty</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Confidence</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Validation</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDataset.records && activeDataset.records.length > 0 ? (
                        activeDataset.records.map((r) => {
                          const file = activeDataset.files?.find((f) => f.id === r.screenshotFileId);
                          const hasErrors = r.validationErrors && r.validationErrors.length > 0;
                          return (
                            <tr
                              key={r.id}
                              style={{
                                borderBottom: '1px solid var(--rx-border)',
                                backgroundColor: hasErrors ? 'rgba(239, 68, 68, 0.04)' : undefined,
                              }}
                            >
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {r.screenshotPreviewUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewModalFile({
                                        url: r.screenshotPreviewUrl!,
                                        filename: file?.originalFilename || 'Screenshot',
                                      })
                                    }
                                    style={{
                                      background: 'none',
                                      border: '1px solid var(--rx-border)',
                                      borderRadius: '4px',
                                      padding: '2px',
                                      cursor: 'pointer',
                                      display: 'inline-block',
                                    }}
                                    title="Click to inspect original screenshot"
                                  >
                                    <img
                                      src={r.screenshotPreviewUrl}
                                      alt="Screenshot"
                                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '3px' }}
                                    />
                                  </button>
                                ) : (
                                  <div
                                    style={{
                                      width: '48px',
                                      height: '48px',
                                      backgroundColor: 'var(--rx-surface-hover)',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <ImageIcon size={20} style={{ color: 'var(--rx-text-muted)' }} />
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                {r.externalId}
                                {r.userCorrected && (
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: '0.7rem',
                                      color: 'var(--rx-info)',
                                      fontFamily: 'sans-serif',
                                    }}
                                  >
                                    Edited by User
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                                {formatAmountMinor(r.amountMinor, r.currency)}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--rx-text-secondary)' }}>
                                {formatDate(r.transactionDate)}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div>{r.reference || '-'}</div>
                                {r.merchantOrOrderId && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)' }}>
                                    {r.merchantOrOrderId}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '10px',
                                    backgroundColor:
                                      r.confidenceScore >= 80 ? 'var(--rx-success-bg)' : 'var(--rx-warning-bg)',
                                    color:
                                      r.confidenceScore >= 80 ? 'var(--rx-success)' : 'var(--rx-warning)',
                                  }}
                                >
                                  {r.confidenceScore}%
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {hasErrors ? (
                                  <div style={{ color: 'var(--rx-danger)', fontSize: '0.75rem' }}>
                                    {r.validationErrors!.map((msg, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        • {msg}
                                      </div>
                                    ))}
                                  </div>
                                ) : r.isDuplicate ? (
                                  <span style={{ color: 'var(--rx-warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    ⚠️ Duplicate Warning
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--rx-success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    ✓ Valid
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                {activeDataset.status !== 'READY' && (
                                  <button
                                    type="button"
                                    className="rx-btn rx-btn-secondary rx-btn-sm"
                                    onClick={() => startEditRecord(r)}
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--rx-text-muted)' }}>
                            No extracted records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 2: DATASET HISTORY
          ======================================================================= */}
      {activeTab === 'dataset_history' && (
        <div className="rx-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--rx-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                Uploaded Screenshot Datasets
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.825rem' }}>
                All screenshot batches uploaded for this organization with their status and reconciliation readiness.
              </p>
            </div>
            <button
              type="button"
              className="rx-btn rx-btn-secondary rx-btn-sm"
              onClick={() => refetchDatasets()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <RefreshIcon size={14} /> Refresh
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--rx-surface-hover)', textAlign: 'left', borderBottom: '1px solid var(--rx-border)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Dataset Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Files</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Records</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Confirmed</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasetsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--rx-text-secondary)' }}>
                      Loading screenshot datasets...
                    </td>
                  </tr>
                ) : datasetsList && datasetsList.length > 0 ? (
                  datasetsList.map((ds) => (
                    <tr key={ds.id} style={{ borderBottom: '1px solid var(--rx-border)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{ds.name}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              ds.status === 'READY'
                                ? 'var(--rx-success-bg)'
                                : ds.status === 'REVIEW_REQUIRED'
                                ? 'var(--rx-warning-bg)'
                                : 'var(--rx-surface-hover)',
                            color:
                              ds.status === 'READY'
                                ? 'var(--rx-success)'
                                : ds.status === 'REVIEW_REQUIRED'
                                ? 'var(--rx-warning)'
                                : 'var(--rx-text-secondary)',
                          }}
                        >
                          {ds.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ds.totalFiles}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ds.totalRecords}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{ds.confirmedRecords}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--rx-text-secondary)' }}>
                        {formatDateTime(ds.createdAt)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="rx-btn rx-btn-secondary rx-btn-sm"
                          onClick={() => loadDatasetForReview(ds.id)}
                        >
                          {ds.status === 'REVIEW_REQUIRED' ? 'Review & Confirm' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--rx-text-muted)' }}>
                      No screenshot datasets have been ingested yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: QUICK SINGLE RECEIPT OCR (BACKWARD COMPATIBILITY)
          ======================================================================= */}
      {activeTab === 'single_extract' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Left: Upload Card */}
          <div className="rx-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
              Upload Receipt Image
            </h3>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                  setSingleLoading(true);
                  singleExtractMutation.mutate(file);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed var(--rx-primary)' : '2px dashed var(--rx-border)',
                backgroundColor: isDragging ? 'var(--rx-surface-hover)' : 'var(--rx-surface)',
                padding: '2rem 1rem',
                borderRadius: 'var(--rx-radius-md)',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1rem',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    setSingleLoading(true);
                    singleExtractMutation.mutate(file);
                  }
                }}
              />
              <CameraIcon size={36} style={{ color: 'var(--rx-text-muted)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Click to upload or drag image here
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-muted)' }}>
                PNG, JPEG, WebP (Ctrl+V paste supported)
              </div>
            </div>

            {previewUrl && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  style={{
                    maxHeight: '260px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: 'var(--rx-radius-md)',
                    border: '1px solid var(--rx-border)',
                  }}
                />
                {selectedFile && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.4rem' }}>
                    {selectedFile.name}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Extracted Form */}
          <div className="rx-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
              Extracted Transaction Form
            </h3>

            {singleErrorMessage && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--rx-danger-bg)', color: 'var(--rx-danger)', borderRadius: 'var(--rx-radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {singleErrorMessage}
              </div>
            )}

            {ingestedResult && (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--rx-success-bg)', color: 'var(--rx-success)', borderRadius: 'var(--rx-radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ✓ Successfully ingested transaction <code>{ingestedResult.externalId}</code> into ledger!
              </div>
            )}

            {singleLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <RefreshIcon size={24} className="animate-spin" style={{ color: 'var(--rx-primary)', marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 600 }}>Analyzing receipt image with OCR...</div>
              </div>
            ) : extractedData ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSingleLoading(true);
                  singleIngestMutation.mutate({
                    dataSourceId: targetDataSourceId,
                    externalId,
                    amount: Number(amount),
                    currency,
                    transactionDate,
                    reference,
                    externalTxnId,
                    merchantOrOrderId,
                    txnType,
                    description,
                  });
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Target Data Source</label>
                  <select
                    className="rx-select"
                    value={targetDataSourceId}
                    onChange={(e) => setTargetDataSourceId(e.target.value)}
                    required
                  >
                    {dataSources?.items.map((ds) => (
                      <option key={ds.id} value={ds.id}>{ds.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>External ID / UTR *</label>
                    <input
                      className="rx-input"
                      value={externalId}
                      onChange={(e) => setExternalId(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="rx-input"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Currency</label>
                    <input
                      className="rx-input"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Date *</label>
                    <input
                      type="date"
                      className="rx-input"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Reference</label>
                  <input
                    className="rx-input"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                {extractedData.rawOcrText && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setRawOcrExpanded(!rawOcrExpanded)}
                      className="rx-btn rx-btn-secondary rx-btn-xs"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {rawOcrExpanded ? 'Hide Raw OCR Text' : 'View Raw OCR Text'}
                    </button>
                    {rawOcrExpanded && (
                      <pre style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.72rem', marginTop: '0.4rem', padding: '0.5rem', backgroundColor: 'var(--rx-surface-hover)', borderRadius: '4px' }}>
                        {extractedData.rawOcrText}
                      </pre>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="rx-btn rx-btn-primary"
                  style={{ marginTop: '0.5rem' }}
                >
                  Confirm & Ingest Transaction into Ledger
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--rx-text-muted)' }}>
                Upload or paste an image to extract fields.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          RECORD EDIT MODAL (CORRECTION WORKFLOW)
          ======================================================================= */}
      {editingRecord && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="rx-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--rx-surface)',
              padding: '1.75rem',
              borderRadius: 'var(--rx-radius-lg)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Correct Extracted Transaction
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rx-text-secondary)' }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRecordMutation.mutate({
                  recordId: editingRecord.id,
                  payload: editFormData,
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  External ID / UTR *
                </label>
                <input
                  type="text"
                  className="rx-input"
                  value={editFormData.externalId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, externalId: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="rx-input"
                    value={editFormData.amount ?? ''}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Currency *
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    className="rx-input"
                    value={editFormData.currency || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Transaction Date *
                </label>
                <input
                  type="date"
                  className="rx-input"
                  value={editFormData.transactionDate || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, transactionDate: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Reference / Order ID
                  </label>
                  <input
                    type="text"
                    className="rx-input"
                    value={editFormData.reference || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, reference: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Merchant / Payee
                  </label>
                  <input
                    type="text"
                    className="rx-input"
                    value={editFormData.merchantOrOrderId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, merchantOrOrderId: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="rx-btn rx-btn-secondary"
                  onClick={() => setEditingRecord(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rx-btn rx-btn-primary"
                  disabled={updateRecordMutation.isPending}
                >
                  {updateRecordMutation.isPending ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          SCREENSHOT PREVIEW MODAL
          ======================================================================= */}
      {previewModalFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1.5rem',
          }}
          onClick={() => setPreviewModalFile(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: '#1E293B',
              borderRadius: 'var(--rx-radius-lg)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', color: '#F8FAFC' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{previewModalFile.filename}</span>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                style={{ background: 'none', border: 'none', color: '#F8FAFC', cursor: 'pointer' }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <img
              src={previewModalFile.url}
              alt="Screenshot Preview"
              style={{
                maxWidth: '85vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 'var(--rx-radius-md)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
