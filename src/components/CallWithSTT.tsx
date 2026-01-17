import { useState, useCallback } from 'react';
import { PrescriptionSTT } from './PrescriptionSTT';
import { ConflictCheckIndicator } from './ConflictCheckIndicator';

/**
 * In-call layer: runs PrescriptionSTT and, when a drug is detected,
 * calls /check-interactions (Browserbase or RxNav) and shows ConflictCheckIndicator.
 */
export function CallWithSTT() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ hasConflict: boolean; details: string; source?: string } | null>(null);
  const [currentDrug, setCurrentDrug] = useState<string | undefined>();

  const onPrescriptionDetected = useCallback(async (drug: string) => {
    setCurrentDrug(drug);
    setIsChecking(true);
    setResult(null);
    try {
      const res = await fetch('/check-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDrug: drug }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ hasConflict: false, details: 'Conflict check request failed.' });
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <>
      <PrescriptionSTT onPrescriptionDetected={onPrescriptionDetected} />
      <ConflictCheckIndicator isChecking={isChecking} result={result} drug={currentDrug} />
    </>
  );
}
