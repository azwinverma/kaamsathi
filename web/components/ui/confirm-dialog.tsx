"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "./button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "./dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  danger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" closeLabel={t("close")}>
        <DialogHeader title={title} description={description} />
        {children ? <DialogBody>{children}</DialogBody> : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
