"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Heart, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, errorMessage } from "@/components/ui/feedback";
import { useAddresses, useDeleteAddress, useFavourites, useToggleFavourite } from "@/lib/api/hooks/bolau";
import type { Address } from "@/lib/api/types-bolau";
import { useFormat } from "@/lib/use-format";
import { AddressForm, addressText } from "./address-form";
import { SipaluCard } from "./sipalu-card";

/** Saved addresses CRUD. Exact addresses are shared with a Sipalu only after they accept. */
export function GharAddresses() {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const f = useFormat();
  const q = useAddresses();
  const del = useDeleteAddress();
  const [editing, setEditing] = React.useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Address | null>(null);
  const rows = q.data ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-fg text-2xl font-extrabold">{t("ghar.addresses_title")}</h1>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("ghar.add_address")}
        </Button>
      </div>
      <p className="text-fg-muted mt-2 text-sm">{t("book.address_private", { name: f.locale === "ne" ? "सिपालु" : "the Sipalu" })}</p>
      <div className="mt-4">
        {q.isLoading ? (
          <Skeleton className="h-24 rounded-dense" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={MapPin} title={t("address.empty")} />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-4">
                <MapPin className="text-fg-muted mt-0.5 size-5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-fg flex flex-wrap items-center gap-2 font-semibold">
                    {t(`address.label_${a.label}`)}
                    {a.is_default ? <Badge tone="brand">{t("address.default_badge")}</Badge> : null}
                  </p>
                  <p className="text-fg-body text-sm">{addressText(a, f.locale, t("address.ward"))}</p>
                  {a.landmark ? <p className="text-fg-muted text-sm">{a.landmark}</p> : null}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(a)} aria-label={`${t("ghar.edit_address")}: ${t(`address.label_${a.label}`)}`}>
                  <Pencil aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(a)} aria-label={`${tAll("common.delete")}: ${t(`address.label_${a.label}`)}`}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent closeLabel={tAll("common.close")}>
          <DialogHeader title={editing === "new" ? t("ghar.add_address") : t("ghar.edit_address")} />
          <DialogBody>
            {editing ? (
              <AddressForm
                idPrefix="ghar-addr"
                initial={editing === "new" ? null : editing}
                onSaved={() => {
                  toast.success(t("address.saved"));
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("address.delete_confirm")}
        description={deleting ? addressText(deleting, f.locale, t("address.ward")) : undefined}
        confirmLabel={tAll("common.remove")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("address.deleted"));
              setDeleting(null);
            },
            onError: (e) => toast.error(errorMessage(e, tAll)),
          })
        }
      />
    </div>
  );
}

/** Saved Sipalu (favourites). */
export function GharFavourites() {
  const t = useTranslations("bolau");
  const tAll = useTranslations();
  const q = useFavourites();
  const toggle = useToggleFavourite();
  const rows = q.data ?? [];
  return (
    <div>
      <h1 className="text-fg text-2xl font-extrabold">{t("ghar.favourites_title")}</h1>
      <div className="mt-4">
        {q.isLoading ? (
          <Skeleton className="h-24 rounded-dense" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t("ghar.empty_favourites")}
            action={
              <Button asChild>
                <Link href="/bolau">{t("ghar.find")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((fav, i) => (
              <li key={fav.handle} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SipaluCard s={fav} index={i} headingLevel={2} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative z-10 mt-5"
                  loading={toggle.isPending && toggle.variables?.handle === fav.handle}
                  onClick={() =>
                    toggle.mutate({ handle: fav.handle, on: false }, { onError: (e) => toast.error(errorMessage(e, tAll)) })
                  }
                >
                  {tAll("common.remove")}
                  <span className="sr-only"> {fav.name}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
