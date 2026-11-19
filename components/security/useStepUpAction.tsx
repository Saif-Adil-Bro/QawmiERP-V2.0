"use client";

import { useCallback, useRef, useState } from "react";
import StepUpVerificationModal from "@/components/security/StepUpVerificationModal";

export interface StepUpRunOptions {
  actionLabel?: string;
  actionScope?: string;
}

export function isStepUpRequiredResponse(res: any): boolean {
  if (!res || typeof res !== "object") return false;
  return res.errorCode === "STEP_UP_REQUIRED" || res.code === "STEP_UP_REQUIRED";
}

/**
 * Reusable hook to wrap any Server Action or API call that may return
 * `errorCode: "STEP_UP_REQUIRED"`. When triggered, it opens `StepUpVerificationModal`
 * and automatically retries the action once OTP verification succeeds.
 */
export function useStepUpAction() {
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState("সংবেদনশীল অপারেশন");
  const [actionScope, setActionScope] = useState("CRITICAL");
  const pendingResolveRef = useRef<((verified: boolean) => void) | null>(null);

  const requestStepUp = useCallback((opts?: StepUpRunOptions) => {
    setActionLabel(opts?.actionLabel || "সংবেদনশীল অপারেশন");
    setActionScope(opts?.actionScope || "CRITICAL");
    setModalOpen(true);
    return new Promise<boolean>((resolve) => {
      pendingResolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    if (pendingResolveRef.current) {
      pendingResolveRef.current(false);
      pendingResolveRef.current = null;
    }
  }, []);

  const handleVerified = useCallback((_token: string) => {
    setModalOpen(false);
    if (pendingResolveRef.current) {
      pendingResolveRef.current(true);
      pendingResolveRef.current = null;
    }
  }, []);

  const runWithStepUp = useCallback(
    async <T,>(fn: () => Promise<T>, opts?: StepUpRunOptions): Promise<T> => {
      const first = await fn();
      if (!isStepUpRequiredResponse(first)) {
        return first;
      }

      const verified = await requestStepUp(opts);
      if (!verified) {
        return first;
      }

      return fn();
    },
    [requestStepUp]
  );

  const stepUpModal = (
    <StepUpVerificationModal
      open={modalOpen}
      onClose={handleClose}
      onVerified={handleVerified}
      actionLabel={actionLabel}
      actionScope={actionScope}
    />
  );

  return {
    runWithStepUp,
    stepUpModal,
    isStepUpOpen: modalOpen,
  };
}
