"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Crosshair,
  Download,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useCreateSite,
  useDeleteSite,
  useRotateSiteQr,
  useSites,
  useUpdateSite,
} from "@/lib/api/hooks/org";
import { downloadFile, listResults, proxyHref } from "@/lib/api/client";
import type { Site } from "@/lib/api/types";
import { handleFormError, toastError } from "@/lib/forms";
import { toLatinDigits } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, PrefixInput } from "@/components/ui/input";
import { DistrictSelect } from "@/components/shared/selects";

function districtOf(site: Site) {
  const d = site.district;
  if (!d) return null;
  return typeof d === "string" ? { code: d, name_en: d, name_ne: d } : d;
}

export function SitesTab() {
  const t = useTranslations();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useSites();
  const sites = listResults(data);
  const del = useDeleteSite();
  const [editing, setEditing] = React.useState<Site | "new" | null>(null);
  const [qrSite, setQrSite] = React.useState<Site | null>(null);
  const [deleting, setDeleting] = React.useState<Site | null>(null);

  // Keep the QR dialog in sync after a rotate (sites list is refetched).
  const qrCurrent = qrSite ? (sites.find((s) => s.id === qrSite.id) ?? qrSite) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-fg-muted">{t("settings.sites_intro")}</p>
        <Button onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("settings.add_site")}
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t("settings.sites_empty")}
          description={t("settings.sites_empty_body")}
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden />
              {t("settings.add_site")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => {
            const district = districtOf(s);
            const hasGeo = s.lat !== null && s.lat !== "" && s.lng !== null && s.lng !== "";
            return (
              <li key={s.id}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-fg">{s.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">
                        {[s.address, district ? f.name(district) : null].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t("common.more_actions")}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setQrSite(s)}>
                          <QrCode aria-hidden />
                          {t("settings.view_qr")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(s)}>
                          <Pencil aria-hidden />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem danger onSelect={() => setDeleting(s)}>
                          <Trash2 aria-hidden />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={s.is_active ? "success" : "neutral"} dot>
                      {s.is_active ? t("status.active") : t("settings.inactive")}
                    </Badge>
                    {hasGeo ? (
                      <Badge tone="outline">
                        <Crosshair aria-hidden />
                        {t("settings.geofence_badge", { radius: f.digits(s.geofence_radius_m) })}
                      </Badge>
                    ) : (
                      <Badge tone="warning">{t("settings.no_location")}</Badge>
                    )}
                  </div>
                  {hasGeo ? (
                    <p className="mt-2 text-xs text-fg-muted tabular">
                      {f.digits(Number(s.lat).toFixed(5))}, {f.digits(Number(s.lng).toFixed(5))}
                    </p>
                  ) : null}
                  <div className="mt-auto pt-4">
                    <Button variant="secondary" size="sm" onClick={() => setQrSite(s)}>
                      <QrCode aria-hidden />
                      {t("settings.hajiri_qr")}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? <SiteDialog site={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {qrCurrent ? <QrDialog site={qrCurrent} onClose={() => setQrSite(null)} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("settings.delete_site_title")}
        description={t("settings.delete_site_body", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("common.deleted_success"));
              setDeleting(null);
            },
            onError: (e) => toastError(e, t),
          })
        }
      />
    </div>
  );
}

function QrDialog({ site, onClose }: { site: Site; onClose: () => void }) {
  const t = useTranslations();
  const rotate = useRotateSiteQr();
  const [confirm, setConfirm] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const src = proxyHref(`/org/sites/${site.id}/qr.png`, { v: site.qr_token });
  React.useEffect(() => setImgError(false), [src]);

  const download = async () => {
    setDownloading(true);
    try {
      const slug = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
      await downloadFile(`/org/sites/${site.id}/qr.png`, `${slug}-hajiri-qr.png`);
    } catch (e) {
      toastError(e, t);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="sm" closeLabel={t("common.close")}>
          <DialogHeader title={t("settings.qr_title", { name: site.name })} description={t("settings.qr_hint")} />
          <DialogBody className="flex flex-col items-center gap-3">
            <div className="flex size-60 items-center justify-center rounded-dense border border-border bg-white p-2">
              {imgError ? (
                <p className="px-4 text-center text-sm text-hero">{t("settings.qr_error")}</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={t("settings.qr_alt", { name: site.name })}
                  className="size-full object-contain"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
            <p className="text-center text-xs text-fg-muted">{t("settings.qr_print_hint")}</p>
          </DialogBody>
          <DialogFooter className="sm:justify-between">
            <Button variant="danger-outline" onClick={() => setConfirm(true)}>
              <RefreshCw aria-hidden />
              {t("settings.rotate_qr")}
            </Button>
            <Button onClick={download} loading={downloading}>
              <Download aria-hidden />
              {t("settings.download_png")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("settings.rotate_qr_title")}
        description={t("settings.rotate_qr_body")}
        confirmLabel={t("settings.rotate_qr")}
        danger
        loading={rotate.isPending}
        onConfirm={() =>
          rotate.mutate(site.id, {
            onSuccess: () => {
              toast.success(t("settings.qr_rotated"));
              setConfirm(false);
            },
            onError: (e) => toastError(e, t),
          })
        }
      />
    </>
  );
}

const SITE_FIELDS = ["name", "address", "district", "lat", "lng", "geofence_radius_m", "is_active"] as const;

function SiteDialog({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const t = useTranslations();
  const create = useCreateSite();
  const update = useUpdateSite();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [locating, setLocating] = React.useState(false);

  const schema = React.useMemo(() => {
    const coord = (min: number, max: number) =>
      z
        .string()
        .transform((v) => toLatinDigits(v).trim())
        .refine((v) => v === "" || (/^-?\d+(\.\d+)?$/.test(v) && Number(v) >= min && Number(v) <= max), {
          message: t("errors.invalid_number"),
        });
    return z
        .object({
          name: z.string().trim().min(2, t("errors.required")),
          address: z.string().trim(),
          district: z.string(),
          lat: coord(-90, 90),
          lng: coord(-180, 180),
          geofence_radius_m: z
            .string()
            .transform((v) => toLatinDigits(v).trim())
            .refine((v) => /^\d+$/.test(v) && Number(v) >= 20 && Number(v) <= 5000, {
              message: t("settings.radius_invalid"),
            }),
          is_active: z.boolean(),
        })
        .refine((v) => (v.lat === "") === (v.lng === ""), { path: ["lng"], message: t("settings.latlng_both") });
  }, [t]);
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const d = site ? districtOf(site) : null;
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: site?.name ?? "",
      address: site?.address ?? "",
      district: d?.code ?? "",
      lat: site?.lat !== null && site?.lat !== undefined ? String(site.lat) : "",
      lng: site?.lng !== null && site?.lng !== undefined ? String(site.lng) : "",
      geofence_radius_m: String(site?.geofence_radius_m ?? 200),
      is_active: site?.is_active ?? true,
    },
  });
  const { register, control, handleSubmit, formState, setValue } = form;
  const errors = formState.errors;
  const pending = create.isPending || update.isPending;

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("settings.location_unavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("lat", pos.coords.latitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setValue("lng", pos.coords.longitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setLocating(false);
      },
      () => {
        toast.error(t("settings.location_denied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const body = {
      name: v.name,
      address: v.address,
      district: v.district || null,
      lat: v.lat === "" ? null : Number(Number(v.lat).toFixed(6)),
      lng: v.lng === "" ? null : Number(Number(v.lng).toFixed(6)),
      geofence_radius_m: Number(v.geofence_radius_m),
      is_active: v.is_active,
    };
    const opts = {
      onSuccess: () => {
        toast.success(site ? t("common.changes_saved") : t("settings.site_created"));
        onClose();
      },
      onError: (err: unknown) =>
        setFormError(handleFormError(err, form.setError, t, { fields: SITE_FIELDS, toast: false })),
    };
    if (site) update.mutate({ id: site.id, ...body }, opts);
    else create.mutate(body, opts);
  });

  const opt = { optional: true, optionalLabel: t("common.optional") };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader title={site ? t("settings.edit_site") : t("settings.add_site")} />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <Field id="site-name" label={t("settings.site_name")} error={errors.name?.message} hint={t("settings.site_name_hint")}>
              <Input {...register("name")} />
            </Field>
            <Field id="site-address" label={t("term.address")} error={errors.address?.message} {...opt}>
              <Input {...register("address")} />
            </Field>
            <Field id="site-district" label={t("term.district")} error={errors.district?.message} {...opt}>
              <Controller
                control={control}
                name="district"
                render={({ field }) => <DistrictSelect value={field.value} onChange={field.onChange} />}
              />
            </Field>
            <fieldset className="space-y-3 rounded-dense border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-fg">{t("settings.geofence")}</legend>
              <p className="text-xs text-fg-muted">{t("settings.geofence_hint")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="site-lat" label={t("settings.latitude")} error={errors.lat?.message}>
                  <Input inputMode="decimal" placeholder="27.7172" className="tabular" {...register("lat")} />
                </Field>
                <Field id="site-lng" label={t("settings.longitude")} error={errors.lng?.message}>
                  <Input inputMode="decimal" placeholder="85.3240" className="tabular" {...register("lng")} />
                </Field>
              </div>
              <Button variant="secondary" size="sm" onClick={locateMe} loading={locating}>
                <Crosshair aria-hidden />
                {t("settings.use_my_location")}
              </Button>
              <Field id="site-radius" label={t("settings.geofence_radius")} error={errors.geofence_radius_m?.message}>
                <PrefixInput prefix={t("settings.meters")} inputMode="numeric" className="sm:max-w-48" {...register("geofence_radius_m")} />
              </Field>
            </fieldset>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <SwitchField
                  id="site-active"
                  label={t("settings.site_active")}
                  description={t("settings.site_active_hint")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormError message={formError} />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {site ? t("common.save_changes") : t("settings.add_site")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
