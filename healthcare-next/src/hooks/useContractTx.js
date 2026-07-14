"use client";

import { useCallback } from "react";
import { useToast } from "@/context/ToastContext";

// Every contract write in this app should go through here rather than being
// awaited directly — it's what turns "did my click do anything?" into a
// visible Awaiting wallet confirmation -> Submitted -> Confirmed/Reverted
// sequence, which is the difference between a blockchain app feeling
// trustworthy and feeling janky (see docs/ARCHITECTURE.md's UI notes).
export function useContractTx() {
  const { push, update, autoDismiss } = useToast();

  const runTx = useCallback(
    async (sendTx, { pendingLabel = "Awaiting wallet confirmation…", successLabel = "Confirmed" } = {}) => {
      const id = push({ status: "pending", label: pendingLabel });

      let tx;
      try {
        tx = await sendTx();
      } catch (error) {
        if (error?.code === 4001 || error?.code === "ACTION_REJECTED") {
          update(id, { status: "rejected", label: "Rejected in wallet" });
        } else {
          update(id, { status: "reverted", label: extractRevertReason(error) });
        }
        autoDismiss(id, 5000);
        throw error;
      }

      update(id, {
        status: "submitted",
        label: "Submitted — waiting for confirmation…",
        txHash: tx.hash,
      });

      try {
        const receipt = await tx.wait();
        update(id, { status: "confirmed", label: successLabel, txHash: receipt.transactionHash });
        autoDismiss(id, 4000);
        return receipt;
      } catch (error) {
        update(id, { status: "reverted", label: extractRevertReason(error), txHash: tx.hash });
        autoDismiss(id, 6000);
        throw error;
      }
    },
    [push, update, autoDismiss]
  );

  return { runTx };
}

// ethers v5 surfaces a require()'s revert string as `error.reason` when the
// node supports revert-reason decoding (Hardhat's local node does) — fall
// back to the raw message so something legible always shows either way.
function extractRevertReason(error) {
  return error?.reason || error?.data?.message || error?.message || "Transaction failed";
}
