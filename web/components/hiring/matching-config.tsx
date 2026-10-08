"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { RequireStaffRole } from "@/components/security/require-staff-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, DescriptionList } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormError } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { isApiError } from "@/lib/api/errors";
import {
  useMatchingConfig,
  useResetMatchingConfig,
  useUpdateMatchingConfig,
} from "@/lib/api/hooks/pipeline";
import {
  MATCHING_WEIGHT_KEYS,
  type MatchingConfig,
  type MatchingWeightKey,
} from "@/lib/api/types-pipeline";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { changedWeights, invalidWeights } from "./pipeline-lib";

type Draft = Record<MatchingWeightKey, string>;

function toDraft(cfg: MatchingConfig): Draft {
  return Object.fromEntries(
    MATCHING_WEIGHT_KEYS.map((k) => [k, String(cfg.weights[k] ?? "")]),
  ) as Draft;
}

/** /ops/matching — matching algorithm weights (K001, superadmin; audited). */
export function MatchingConfigPage() {
  return (
    <RequireStaffRole roles={["superadmin"]}>
      <MatchingConfigInner />
    </RequireStaffRole>
  );
}

function MatchingConfigInner() {
  const t = useTranslations();
  const tm = useTranslations("pipeline.matching");
  const f = useFormat();
  const cfg = useMatchingConfig();
  const save = useUpdateMatchingConfig();
  const reset = useResetMatchingConfig();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<MatchingWeightKey, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const data = cfg.data;
  React.useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  if (cfg.isLoading || (data && !draft)) {
    return (
      <>
        <PageHeader title={tm("title")} description={tm("description")} />
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }
  if (cfg.isError || !data || !draft) {
    return (
      <>
        <PageHeader title={tm("title")} description={tm("description")} />
        <ErrorState error={cfg.error} onRetry={() => void cfg.refetch()} />
      </>
    );
  }

  const changed = changedWeights(data.weights, draft);
  const dirty = Object.keys(changed).length > 0;

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const bad = invalidWeights(draft, data.limits);
    if (bad.length) {
      setErrors(
        Object.fromEntries(
          bad.map((k) => [
            k,
            tm("invalid", {
              min: f.digits(data.limits[k]?.min ?? 0),
              max: f.digits(data.limits[k]?.max ?? 0),
            }),
          ]),
        ),
      );
      return;
    }
    setErrors({});
    if (!dirty) {
      toast.info(tm("nothing_changed"));
      return;
    }
    save.mutate(changed, {
      onSuccess: () => toast.success(tm("saved_toast")),
      onError: (err) => {
        if (isApiError(err) && Object.keys(err.fields).length) {
          const fe: Partial<Record<MatchingWeightKey, string>> = {};
          const rest: string[] = [];
          for (const [key, msgs] of Object.entries(err.fields)) {
            const k = key.replace(/^weights\./, "") as MatchingWeightKey;
            if ((MATCHING_WEIGHT_KEYS as readonly string[]).includes(k)) fe[k] = msgs[0];
            else rest.push(msgs[0]);
          }
          setErrors(fe);
          setFormError(rest.length ? rest.join(" ") : null);
        } else {
          toastError(err, t);
        }
      },
    });
  };

  return (
    <>
      <PageHeader
        title={tm("title")}
        description={tm("description")}
        meta={
          <>
            <Badge tone="brand">{tm("version", { version: data.algorithm_version })}</Badge>
            <Badge tone="outline">{tm("revision", { revision: f.digits(data.revision) })}</Badge>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader title={tm("about_title")} />
          <CardBody>
            <DescriptionList
              columns={1}
              items={[
                { label: tm("version_label"), value: data.algorithm_version },
                { label: tm("revision_label"), value: f.digits(data.revision) },
                {
                  label: tm("updated_by"),
                  value: data.updated_by?.full_name ?? tm("updated_never"),
                },
                {
                  label: tm("updated_at"),
                  value: data.updated_at ? f.dateTime(data.updated_at) : "—",
                },
              ]}
            />
            <p className="text-fg-muted mt-4 text-xs">{tm("audit_note")}</p>
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <form onSubmit={onSave} noValidate>
            <CardHeader title={tm("weights_title")} description={tm("weights_hint")} />
            <CardBody className="space-y-4">
              <FormError message={formError} />
              <div className="grid gap-4 sm:grid-cols-2">
                {MATCHING_WEIGHT_KEYS.map((k) => {
                  const lim = data.limits[k];
                  const def = data.defaults[k];
                  const isDefault = String(def) === draft[k].trim();
                  return (
                    <Field
                      key={k}
                      id={`w-${k}`}
                      label={tm(`weights.${k}`)}
                      error={errors[k]}
                      hint={
                        <>
                          {tm(`weight_hints.${k}`)}{" "}
                          <span className="tabular">
                            {tm("default_range", {
                              def: f.digits(def ?? 0),
                              min: f.digits(lim?.min ?? 0),
                              max: f.digits(lim?.max ?? 0),
                            })}
                          </span>
                          {!isDefault ? (
                            <>
                              {" · "}
                              <span className="text-warning font-medium">
                                {tm("changed_from_default")}
                              </span>
                            </>
                          ) : null}
                        </>
                      }
                    >
                      <Input
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={lim?.min}
                        max={lim?.max}
                        value={draft[k]}
                        onChange={(e) => {
                          setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));
                          setErrors((x) => ({ ...x, [k]: undefined }));
                        }}
                        className="tabular sm:w-32"
                      />
                    </Field>
                  );
                })}
              </div>
            </CardBody>
            <CardFooter className="flex-wrap justify-between">
              <Button
                variant="ghost"
                onClick={() => setConfirmReset(true)}
                disabled={save.isPending}
              >
                <RotateCcw aria-hidden />
                {tm("reset")}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft(toDraft(data));
                    setErrors({});
                    setFormError(null);
                  }}
                  disabled={!dirty || save.isPending}
                >
                  {tm("discard")}
                </Button>
                <Button type="submit" loading={save.isPending} disabled={!dirty}>
                  {save.isPending ? null : <Save aria-hidden />}
                  {tm("save")}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={tm("reset_title")}
        description={tm("reset_body")}
        confirmLabel={tm("reset")}
        danger
        loading={reset.isPending}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              toast.success(tm("reset_toast"));
              setConfirmReset(false);
              setErrors({});
              setFormError(null);
            },
            onError: (e) => toastError(e, t),
          })
        }
      />
    </>
  );
}
