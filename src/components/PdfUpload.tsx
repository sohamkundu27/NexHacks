import { useState, useCallback } from 'react';

type Props = {
  onReady: () => void;
  onDrugCount?: (n: number) => void;
};

/**
 * PDF upload step: user drops or selects a medical PDF.
 * Server parses it, extracts text and drugs, stores in temp. On success we enable "Start call".
 */
export function PdfUpload({ onReady, onDrugCount }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [drugCount, setDrugCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(
    async (f: File) => {
      if (!f || f.type !== 'application/pdf') {
        setError('Please select a PDF file.');
        return;
      }
      setFile(f);
      setError(null);
      setStatus('uploading');

      const form = new FormData();
      form.append('pdf', f);

      try {
        const res = await fetch('/upload-pdf', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setError(data?.error || 'Upload failed');
          return;
        }
        setStatus('done');
        const n = data?.drugCount ?? 0;
        setDrugCount(n);
        onDrugCount?.(n);
      } catch {
        setStatus('error');
        setError('Upload failed. Start the backend with: node server.js');
      }
    },
    [onDrugCount]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target?.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="pdf-upload">
      <h2>1. Upload medical data (PDF)</h2>
      <p className="pdf-upload-hint">We extract text and medication names to check for conflicts when the doctor prescribes during the call.</p>

      <div
        className={`pdf-upload-zone ${status === 'uploading' ? 'uploading' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={onSelect}
          disabled={status === 'uploading'}
          id="pdf-input"
        />
        {status === 'idle' && (
          <label htmlFor="pdf-input">
            Drop PDF here or <span>browse</span>
          </label>
        )}
        {status === 'uploading' && <span>Parsing PDF…</span>}
        {status === 'done' && (
          <span>
            ✓ {file?.name} — {drugCount} medication(s) found
          </span>
        )}
      </div>

      {error && <div className="pdf-upload-error">{error}</div>}

      <button
        className="pdf-upload-start"
        disabled={status !== 'done'}
        onClick={onReady}
      >
        Start call
      </button>

      <style>{`
        .pdf-upload { max-width: 420px; margin: 0 auto; text-align: center; padding: 24px; }
        .pdf-upload h2 { font-size: 1.1rem; margin-bottom: 8px; color: #fff; }
        .pdf-upload-hint { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 16px; }
        .pdf-upload-zone {
          border: 2px dashed rgba(255,255,255,0.25); border-radius: 12px; padding: 32px;
          background: rgba(255,255,255,0.04); margin-bottom: 12px; cursor: pointer;
        }
        .pdf-upload-zone.uploading { border-color: rgba(0,200,120,0.5); pointer-events: none; }
        .pdf-upload-zone input[type=file] { display: none; }
        .pdf-upload-zone label span { text-decoration: underline; }
        .pdf-upload-error { color: #f66; font-size: 0.9rem; margin-bottom: 8px; }
        .pdf-upload-start {
          background: #0a0; color: #fff; border: none; padding: 12px 24px; border-radius: 24px;
          font-weight: 600; cursor: pointer;
        }
        .pdf-upload-start:disabled { background: #444; cursor: not-allowed; color: #888; }
      `}</style>
    </div>
  );
}
