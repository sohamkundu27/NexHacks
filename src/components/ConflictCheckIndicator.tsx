import type { ReactNode } from 'react';

type Result = { hasConflict: boolean; details: string; source?: string };

type Props = {
  isChecking: boolean;
  result: Result | null;
  drug?: string;
};

/**
 * Visual indicator while Browserbase/RxNav runs and when the conflict check completes.
 */
export function ConflictCheckIndicator({ isChecking, result, drug }: Props) {
  if (!isChecking && !result) return null;

  let body: ReactNode = null;
  if (isChecking) {
    body = (
      <div className="conflict-checking">
        <span className="conflict-spinner" />
        <span>Checking for drug conflicts{drug ? ` (${drug})` : ''}…</span>
      </div>
    );
  } else if (result) {
    body = (
      <div className={`conflict-result ${result.hasConflict ? 'conflict' : 'ok'}`}>
        <span className="conflict-icon">{result.hasConflict ? '⚠' : '✓'}</span>
        <div>
          <strong>{result.hasConflict ? 'Potential interaction' : 'No conflicts found'}</strong>
          <p>{result.details}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-indicator">
      {body}
      <style>{`
        .conflict-indicator {
          position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999;
          background: rgba(18,18,24,0.95); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
          padding: 14px 20px; color: #fff; font-size: 13px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .conflict-checking { display: flex; align-items: center; gap: 10px; }
        .conflict-spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #0f8;
          border-radius: 50%; animation: conflict-spin 0.8s linear infinite;
        }
        .conflict-result { display: flex; gap: 10px; align-items: flex-start; }
        .conflict-result.conflict { border-left: 3px solid #f80; padding-left: 4px; }
        .conflict-result.ok { border-left: 3px solid #0a0; padding-left: 4px; }
        .conflict-icon { font-size: 1.2rem; }
        .conflict-result p { margin: 4px 0 0; color: rgba(255,255,255,0.75); font-size: 12px; }
        @keyframes conflict-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
