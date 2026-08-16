"use client";

import { SettingsView } from "@/components/portfolio/settings-view";
import { AddAccountView } from "@/components/portfolio/add-account-view";
import { AddHoldingView } from "@/components/portfolio/add-holding-view";
import { DeleteAccountView } from "@/components/portfolio/delete-account-view";
import { DeleteHoldingView } from "@/components/portfolio/delete-holding-view";
import { DeleteLotView } from "@/components/portfolio/delete-lot-view";
import { EditAccountView } from "@/components/portfolio/edit-account-view";
import { EditHoldingView } from "@/components/portfolio/edit-holding-view";
import { HoldingDetailView } from "@/components/portfolio/holding-detail-view";
import { LotFormView } from "@/components/portfolio/lot-form-view";
import { LotsView } from "@/components/portfolio/lots-view";
import {
  OverlayPanel,
  overlaySize,
  useOverlay,
} from "@/components/portfolio/overlay-context";
import { overlayHref } from "@/lib/overlay";

export function OverlayHost() {
  const { state } = useOverlay();
  if (!state) {
    return null;
  }

  return (
    <OverlayPanel size={overlaySize(state)}>
      <div key={overlayHref(state)}>
        {state.m === "holding" ? <HoldingDetailView /> : null}
        {state.m === "lots" ? <LotsView /> : null}
        {state.m === "holding-new" ? <AddHoldingView /> : null}
        {state.m === "holding-edit" ? <EditHoldingView /> : null}
        {state.m === "holding-delete" ? <DeleteHoldingView /> : null}
        {state.m === "lot-add" ? (
          state.id ? <LotFormView mode="add" /> : <AddHoldingView />
        ) : null}
        {state.m === "lot-edit" ? <LotFormView mode="edit" /> : null}
        {state.m === "lot-delete" ? <DeleteLotView /> : null}
        {state.m === "account-new" ? <AddAccountView /> : null}
        {state.m === "account-edit" ? <EditAccountView /> : null}
        {state.m === "account-delete" ? <DeleteAccountView /> : null}
        {state.m === "settings" ? <SettingsView /> : null}
      </div>
    </OverlayPanel>
  );
}
