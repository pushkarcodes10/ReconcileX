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
} from '../../shared/components/icons';

export const NewImportPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UploadImportResponse | null>(null);

  // Fetch active data sources
  const { data: dataSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  const uploadMutation = useMutation({
    mutationFn: () => importsApi.uploadCsv(orgId!, selectedSourceId, selectedFile!),
    onSuccess: (res) => {
      setImportResult(res);
      queryClient.invalidateQueries({ queryKey: ['imports', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
    onError: (err: any) => {
      if (ApiError.isApiError(err)) {
        setUploadError(err.message);
      } else {
        setUploadError('CSV upload failed. Please ensure file is valid CSV and under 50MB.');
      }
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedSourceId) {
      setUploadError('Please select a target data source.');
      return;
    }
    if (!selectedFile) {
      setUploadError('Please select a CSV file to upload.');
      return;
    }

    uploadMutation.mutate();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type.includes('csv')) {
        setSelectedFile(file);
      } else {
        setUploadError('Only CSV files are accepted.');
      }
    }
  };

  if (!orgId) return null;

  return (
    <div style={{ maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/imports`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Imports
        </Link>
      </div>

      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Import Transactions from CSV
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
          Upload a transaction CSV file into an existing data source. Processing is handled synchronously through the ingestion pipeline.
        </p>
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
          <div><strong>Error:</strong> {uploadError}</div>
        </div>
      )}

      {importResult ? (
        <div className="rx-card rx-animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--rx-success-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--rx-success-bg)', color: 'var(--rx-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleIcon size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--rx-success)', fontSize: '1.25rem', fontWeight: 800 }}>
                Import Completed
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--rx-text-secondary)', marginTop: '0.2rem' }}>
                Batch ID: <code>{importResult.importId}</code> | Status: <StatusBadge status={importResult.status} />
              </div>
            </div>
          </div>

          {/* Validation Summary Cards (Reference 2) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', margin: '1.5rem 0' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Records</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>{importResult.totalRecords ?? '—'}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: 'var(--rx-success-bg)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-success-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-success)', textTransform: 'uppercase', fontWeight: 700 }}>Valid Imported</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--rx-success)', marginTop: '0.25rem' }}>{importResult.validRecords ?? '—'}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: importResult.invalidRecords ? 'var(--rx-danger-bg)' : 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
              <div style={{ fontSize: '0.75rem', color: importResult.invalidRecords ? 'var(--rx-danger)' : 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Invalid (Errors)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: importResult.invalidRecords ? 'var(--rx-danger)' : 'inherit', marginTop: '0.25rem' }}>{importResult.invalidRecords ?? 0}</div>
            </div>
            <div style={{ padding: '1rem', backgroundColor: importResult.duplicateRecords ? 'var(--rx-warning-bg)' : 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
              <div style={{ fontSize: '0.75rem', color: importResult.duplicateRecords ? 'var(--rx-warning)' : 'var(--rx-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Duplicates</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: importResult.duplicateRecords ? 'var(--rx-warning)' : 'inherit', marginTop: '0.25rem' }}>{importResult.duplicateRecords ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link
              to={`/orgs/${orgId}/imports/${importResult.importId}`}
              className="rx-btn rx-btn-dark"
            >
              Inspect Import Details & Errors <ArrowRightIcon size={14} />
            </Link>
            <button
              onClick={() => {
                setImportResult(null);
                setSelectedFile(null);
              }}
              className="rx-btn rx-btn-secondary"
            >
              Upload Another CSV
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpload} className="rx-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label htmlFor="source-select" className="rx-label" style={{ fontSize: '0.875rem' }}>
              Target Data Source *
            </label>
            <select
              id="source-select"
              required
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
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

          {/* Drag and Drop Upload Area (Reference 1 & PRD) */}
          <div>
            <label htmlFor="file-input" className="rx-label" style={{ fontSize: '0.875rem' }}>
              CSV File (field: <code>file</code>, max 50MB) *
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
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'var(--rx-transition)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
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
                <UploadIcon size={22} />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--rx-text-primary)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.25rem' }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--rx-text-primary)' }}>
                    Drag and drop your CSV here, or browse
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', marginTop: '0.35rem' }}>
                    CSV format only. Maximum file size 50MB. Headers will be matched against source definition.
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept=".csv,text/csv"
                required={!selectedFile}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files[0]) {
                    setSelectedFile(files[0]);
                  }
                }}
                disabled={uploadMutation.isPending}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploadMutation.isPending || !selectedSourceId || !selectedFile}
            className="rx-btn rx-btn-dark rx-btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {uploadMutation.isPending ? 'Uploading & Processing CSV...' : 'Upload & Start Import'}
          </button>
        </form>
      )}
    </div>
  );
};
