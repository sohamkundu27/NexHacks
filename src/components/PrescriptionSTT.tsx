import { useState, useRef, useEffect, useCallback } from 'react';

const TRIGGERS = /\b(prescrib|prescription|recommend|prescribing|take\s+\w+|start\s+\w+|put you on|give you|we'll add|adding)\b/i;
const DRUG_SUFFIX = /(olol|pril|cin|dipine|statin|cycline|mycin|prazole|formin|artan|azepam|oxetine|ide|done|pine|tidine|olone|tadine)$/i;
const STOP = new Set(['the', 'a', 'an', 'and', 'for', 'with', 'you', 'your', 'some', 'twice', 'once', 'daily', 'mg', 'mcg', 'tablet', 'tablets', 'capsule', 'capsules', 'medicine', 'medication', 'drug']);

/**
 * Heuristic: find a likely drug name in transcript after a prescription-like trigger.
 */
function extractDrug(transcript: string): string | null {
  if (!transcript || transcript.length < 4) return null;
  const lower = transcript.toLowerCase();
  if (!TRIGGERS.test(lower)) return null;

  const words = transcript.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-zA-Z]/g, '');
    if (w.length < 3 || STOP.has(w.toLowerCase())) continue;
    if (DRUG_SUFFIX.test(w)) return w;
    // Capitalized (brand-style) or first word after "prescribe"/"recommend"
    if (i > 0 && /^[A-Z]/.test(words[i])) return w;
  }
  // Fallback: first long alpha word after a trigger
  const m = lower.match(/(?:prescrib|recommend|prescription|take|start|put you on|give you|adding)\s+(?:you\s+)?(?:some\s+)?(\w{4,})/i);
  if (m && !STOP.has(m[1].toLowerCase())) return m[1];
  return null;
}

type Props = {
  onPrescriptionDetected: (drug: string) => void;
  disabled?: boolean;
};

/**
 * STT via Web Speech API. Listens for prescription-like phrases and extracts drug names.
 * When detected, calls onPrescriptionDetected(drug). Runs alongside the LiveKit call (same mic).
 */
export function PrescriptionSTT({ onPrescriptionDetected, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const recRef = useRef<{ start?: () => void; stop?: () => void } | null>(null);
  const lastDrugRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningRef = useRef(false);
  listeningRef.current = listening;

  const onResult = useCallback(
    (e: { results?: { [i: number]: { [j: number]: { transcript?: string } } }; resultIndex?: number }) => {
      const idx = e.resultIndex ?? 0;
      const t = (e.results?.[idx]?.[0]?.transcript || '').trim();
      if (!t) return;
      setLastTranscript(t);
      const drug = extractDrug(t);
      if (drug) {
        // Debounce: avoid firing for the same drug within 8s
        const key = drug.toLowerCase();
        if (lastDrugRef.current === key) return;
        lastDrugRef.current = key;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          lastDrugRef.current = null;
        }, 8000);
        onPrescriptionDetected(drug);
      }
    },
    [onPrescriptionDetected]
  );

  useEffect(() => {
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition not supported (use Chrome)');
      return;
    }
    const rec = new SR() as {
      continuous?: boolean; interimResults?: boolean; lang?: string;
      onresult: (e: { results?: { [i: number]: { [j: number]: { transcript?: string } } }; resultIndex?: number }) => void;
      onerror: (e: { error?: string }) => void; onend: () => void; start?: () => void; stop?: () => void;
    };
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = onResult;
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone access denied');
      else if (e.error !== 'aborted') setError(`STT: ${e.error}`);
    };
    rec.onend = () => {
      if (listeningRef.current && !disabled) rec.start?.();
    };
    recRef.current = rec;
    return () => {
      try { rec.stop?.(); } catch { /* ignore */ }
      recRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [onResult, disabled]);

  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening && !disabled) {
      try { rec.start?.(); } catch { setError('Could not start microphone'); }
    } else {
      try { rec.stop?.(); } catch { /* ignore */ }
    }
  }, [listening, disabled]);

  return (
    <div className="stt-widget">
      <div className="stt-header">
        <span className={`stt-dot ${listening ? 'on' : ''}`} />
        <span className="stt-label">Prescription listener</span>
        <button
          type="button"
          className="stt-btn"
          onClick={() => setListening((v) => !v)}
          disabled={!!error || disabled}
        >
          {listening ? 'Stop' : 'Start'}
        </button>
      </div>
      {error && <div className="stt-err">{error}</div>}
      {listening && lastTranscript && (
        <div className="stt-transcript" title="Latest speech">{lastTranscript.slice(-80)}</div>
      )}
      <style>{`
        .stt-widget {
          position: fixed; bottom: 80px; left: 20px; z-index: 9998;
          background: rgba(20,20,28,0.9); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 14px;
          color: #fff; font-size: 12px; max-width: 260px;
        }
        .stt-header { display: flex; align-items: center; gap: 8px; }
        .stt-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }
        .stt-dot.on { background: #0f8; box-shadow: 0 0 8px #0f8; }
        .stt-label { flex: 1; }
        .stt-btn { background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 4px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; }
        .stt-err { color: #f66; margin-top: 6px; }
        .stt-transcript { margin-top: 6px; color: rgba(255,255,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}
