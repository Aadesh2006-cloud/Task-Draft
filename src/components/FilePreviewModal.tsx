import React, { useEffect, useState } from 'react';
import { Download, Lock, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface FilePreviewPayload {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  previewText: string | null;
  contentBase64: string;
}

export function FilePreviewModal({
  fileId,
  onClose,
}: {
  fileId: number | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<FilePreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    apiRequest<FilePreviewPayload>(`/api/files/${fileId}/download?format=json`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to preview file.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fileId]);

  if (!fileId) return null;

  const handleDownload = () => {
    if (!data) return;
    const byteChars = atob(data.contentBase64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Private file viewer"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-[#E4E7EC] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#101828] truncate">
              {data ? data.fileName : 'Loading file...'}
            </h3>
            <p className="text-xs text-[#667085] mt-0.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Permission-checked document · {data ? `${Math.max(1, Math.round(data.sizeBytes / 1024))} KB · v${data.version}` : 'Verifying access'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            )}
            <button
              type="button"
              aria-label="Close file viewer"
              onClick={onClose}
              className="p-2 text-[#475467] hover:text-[#101828] rounded-lg hover:bg-[#F2F4F7]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-[#F8F9FB]">
          {loading && <p className="text-sm text-[#475467]">Loading authorized document...</p>}
          {error && (
            <div className="p-4 bg-white border border-[#FECACA] rounded-lg text-sm text-[#B91C1C]">
              {error}
            </div>
          )}
          {data && data.previewText !== null && (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#101828] bg-white border border-[#E4E7EC] rounded-lg p-5">
              {data.previewText}
            </pre>
          )}
          {data && data.mimeType.startsWith('image/') && (
            <img
              src={`data:${data.mimeType};base64,${data.contentBase64}`}
              alt={data.fileName}
              className="max-w-full rounded-lg border border-[#E4E7EC] mx-auto"
            />
          )}
          {data && data.previewText === null && !data.mimeType.startsWith('image/') && (
            <div className="p-6 bg-white border border-[#E4E7EC] rounded-lg text-sm text-[#475467] text-center">
              Binary file ({data.mimeType}) verified for download. Use the Download button above to save it locally.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
