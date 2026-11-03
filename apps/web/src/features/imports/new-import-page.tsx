import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importsApi, UploadImportResponse } from '../../api/endpoints/imports';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { ApiError } from '../../api/errors';
import { StatusBadge } from '../../shared/components/status-badge';

export const NewImportPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  if (!orgId) return null;

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/imports`}>&larr; Back to Imports</Link>
      </div>

      <h1>Import Transactions from CSV</h1>
      <p style={{ color: '#666' }}>
        Upload a transaction CSV file into an existing data source. Processing is handled synchronously through the ingestion pipeline.
      </p>

      {uploadError && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {uploadError}
        </div>
      )}

      {importResult ? (
        <div style={{ border: '1px solid green', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'green', margin: '0 0 0.5rem' }}>Import Completed</h3>
          <p>Status: <StatusBadge status={importResult.status} /></p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', margin: '1rem 0' }}>
            <div>Total Records: <strong>{importResult.totalRecords ?? '—'}</strong></div>
            <div>Valid Imported: <strong>{importResult.validRecords ?? '—'}</strong></div>
            <div>Invalid (Errors): <strong>{importResult.invalidRecords ?? '—'}</strong></div>
            <div>Duplicate Candidates: <strong>{importResult.duplicateRecords ?? '—'}</strong></div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <Link to={`/orgs/${orgId}/imports/${importResult.importId}`}>
              Inspect Import Details & Errors &rarr;
            </Link>
            <button
              onClick={() => {
                setImportResult(null);
                setSelectedFile(null);
              }}
            >
              Upload Another CSV
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpload} style={{ border: '1px solid #ccc', padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="source-select" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Target Data Source *
            </label>
            <select
              id="source-select"
              required
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              disabled={sourcesLoading || uploadMutation.isPending}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">-- Choose Data Source --</option>
              {dataSources?.items.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="file-input" style={{ display: 'block', marginBottom: '0.35rem' }}>
              CSV File (field: <code>file</code>, max 50MB) *
            </label>
            <input
              id="file-input"
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(e) => {
                const files = e.target.files;
                if (files && files[0]) {
                  setSelectedFile(files[0]);
                }
              }}
              disabled={uploadMutation.isPending}
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            disabled={uploadMutation.isPending || !selectedSourceId || !selectedFile}
            style={{ padding: '0.6rem 1.25rem' }}
          >
            {uploadMutation.isPending ? 'Uploading & Processing CSV...' : 'Upload & Start Import'}
          </button>
        </form>
      )}
    </div>
  );
};
