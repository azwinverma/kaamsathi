"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BsDatePicker, DateText, Money } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/checkbox";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableContainer, TBody, Td, Th, THead, Tr, RowHeader } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DistrictSelect, TradeSelect } from "@/components/shared/selects";
import { errorMessage } from "@/components/ui/feedback";
import { isApiError } from "@/lib/api/errors";
import {
  useDeleteCourse,
  useDeleteProvider,
  useOpsCourses,
  useOpsEnrollments,
  useOpsProviders,
  useSaveCourse,
  useSaveProvider,
  useSetEnrollmentStatus,
  useShortages,
} from "@/lib/api/hooks/training";
import {
  COURSE_LEVELS,
  COURSE_MODES,
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  PROVIDER_KINDS,
  PROVIDER_VERIFICATION_STATUSES,
  type Course,
  type CourseInput,
  type Enrollment,
  type EnrollmentStatus,
  type ProviderInput,
  type ShortageRow,
  type TrainingProvider,
} from "@/lib/api/types-training";
import { toastError } from "@/lib/forms";
import { todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { CourseSessionsSheet } from "./course-sessions";
import { OutcomesTab } from "./outcomes-tab";
import {
  ProviderVerificationCell,
  ProviderVerifiedBadge,
  ProviderVerifyDialog,
} from "./provider-verify";
import { CourseStatusBadge, ENROLLMENT_NEXT, EnrollmentStatusBadge } from "./shared";
import { attendanceSummary, parsePct } from "./utils";

const PAGE_SIZE = 20;
type Tab = "providers" | "courses" | "enrollments" | "outcomes" | "shortages";

function fieldErrors(err: unknown): { fields: Record<string, string>; message: string | null } {
  if (!isApiError(err)) return { fields: {}, message: String(err) };
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.fields ?? {})) fields[k.replace(/_id$/, "")] = v[0];
  return { fields, message: err.message };
}

/** /ops/training */
export function OpsTrainingPage() {
  const t = useTranslations("training.ops");
  const [tab, setTab] = React.useState<Tab>("courses");
  const [courseDraft, setCourseDraft] = React.useState<Partial<CourseInput> | null>(null);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="courses">
            <BookOpen aria-hidden />
            {t("tab_courses")}
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Building2 aria-hidden />
            {t("tab_providers")}
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <Users aria-hidden />
            {t("tab_enrollments")}
          </TabsTrigger>
          <TabsTrigger value="outcomes">
            <TrendingUp aria-hidden />
            {t("tab_outcomes")}
          </TabsTrigger>
          <TabsTrigger value="shortages">
            <BarChart3 aria-hidden />
            {t("tab_shortages")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="courses">
          <CoursesTab draft={courseDraft} onDraftConsumed={() => setCourseDraft(null)} />
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersTab />
        </TabsContent>
        <TabsContent value="enrollments">
          <EnrollmentsTab />
        </TabsContent>
        <TabsContent value="outcomes">
          <OutcomesTab />
        </TabsContent>
        <TabsContent value="shortages">
          <ShortagesTab
            onPlanCourse={(trade, district) => {
              setCourseDraft({ trade, district: district || undefined });
              setTab("courses");
            }}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

// =========================================================================== providers

function ProvidersTab() {
  const t = useTranslations("training.providers");
  const tk = useTranslations("training.kind");
  const tc = useTranslations("common");
  const tv = useTranslations("training.verify");
  const tRoot = useTranslations();
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [verification, setVerification] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<TrainingProvider | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<TrainingProvider | null>(null);
  const [verifying, setVerifying] = React.useState<TrainingProvider | null>(null);
  React.useEffect(() => setPage(1), [q, verification]);
  const query = useOpsProviders({
    q: q || undefined,
    verification_status: verification || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const del = useDeleteProvider();
  const rows = query.data?.results ?? [];

  return (
    <div>
      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("search")}
          className="sm:max-w-xs sm:flex-1"
        />
        <NativeSelect
          aria-label={tv("filter_label")}
          value={verification}
          onChange={(e) => setVerification(e.target.value)}
          placeholder={tv("all")}
          className="sm:w-48"
          options={PROVIDER_VERIFICATION_STATUSES.map((s) => ({
            value: s,
            label: tRoot(`status.${s}`),
          }))}
        />
        <Button className="sm:ml-auto" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={q || verification ? tc("no_results") : t("empty_title")}
          description={q || verification ? undefined : t("empty_body")}
          action={
            q || verification ? undefined : (
              <Button onClick={() => setEditing("new")}>{t("add")}</Button>
            )
          }
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("name")}</Th>
                  <Th>{t("kind")}</Th>
                  <Th>{t("district")}</Th>
                  <Th>{t("phone")}</Th>
                  <Th numeric>{tRoot("training.ops.tab_courses")}</Th>
                  <Th>{tv("column")}</Th>
                  <Th>{tc("status")}</Th>
                  <Th className="w-12">
                    <span className="sr-only">{tc("actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <Tr key={p.id}>
                    <RowHeader>
                      <span className="block">{p.name}</span>
                      {p.name_ne ? (
                        <span className="text-fg-muted block text-xs font-normal" lang="ne">
                          {p.name_ne}
                        </span>
                      ) : null}
                    </RowHeader>
                    <Td>
                      <span className="block">{p.kind_label || tk(p.kind)}</span>
                      {p.ctevt_affiliation_no ? (
                        <span className="text-fg-muted tabular block text-xs">
                          {p.ctevt_affiliation_no}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{f.name(p.district)}</Td>
                    <Td className="tabular">{f.phone(p.phone)}</Td>
                    <Td numeric>{f.digits(p.courses_count)}</Td>
                    <Td>
                      <ProviderVerificationCell provider={p} />
                    </Td>
                    <Td>
                      <Badge tone={p.is_active ? "success" : "neutral"} dot>
                        {p.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </Td>
                    <Td>
                      <RowMenu
                        label={tc("more_actions")}
                        items={[
                          { label: tc("edit"), icon: Pencil, onSelect: () => setEditing(p) },
                          {
                            label: tv("action"),
                            icon: ShieldCheck,
                            onSelect: () => setVerifying(p),
                          },
                          {
                            label: tc("delete"),
                            icon: Trash2,
                            danger: true,
                            onSelect: () => setDeleting(p),
                          },
                        ]}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
      <ProviderDialog provider={editing} onClose={() => setEditing(null)} />
      <ProviderVerifyDialog provider={verifying} onClose={() => setVerifying(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={tc("are_you_sure")}
        description={deleting ? t("delete_confirm", { name: deleting.name }) : undefined}
        confirmLabel={tc("delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setDeleting(null);
            },
            onError: (e) => {
              toastError(e, tRoot);
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

function ProviderDialog({
  provider,
  onClose,
}: {
  provider: TrainingProvider | "new" | null;
  onClose: () => void;
}) {
  const t = useTranslations("training.providers");
  const tk = useTranslations("training.kind");
  const tc = useTranslations("common");
  const save = useSaveProvider();
  const open = provider !== null;
  const existing = provider && provider !== "new" ? provider : null;
  const empty: ProviderInput = {
    name: "",
    name_ne: "",
    kind: "ctevt_affiliated",
    ctevt_affiliation_no: "",
    district: "",
    address: "",
    phone: "",
    email: "",
    is_active: true,
  };
  const [form, setForm] = React.useState<ProviderInput>(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setForm(
      existing
        ? {
            name: existing.name,
            name_ne: existing.name_ne ?? "",
            kind: existing.kind,
            ctevt_affiliation_no: existing.ctevt_affiliation_no ?? "",
            district: existing.district.code,
            address: existing.address ?? "",
            phone: existing.phone,
            email: existing.email ?? "",
            is_active: existing.is_active,
          }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const set = <K extends keyof ProviderInput>(k: K, v: ProviderInput[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t("name_required");
    if (!form.phone.trim()) errs.phone = t("phone_required");
    if (!form.district) errs.district = t("district_required");
    if (form.kind === "ctevt_affiliated" && !form.ctevt_affiliation_no?.trim())
      errs.ctevt_affiliation_no = t("affiliation_required");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: ProviderInput = {
      ...form,
      name_ne: form.name_ne || null,
      ctevt_affiliation_no: form.ctevt_affiliation_no || null,
      address: form.address || null,
      email: form.email || null,
    };
    save.mutate(
      { ...body, id: existing?.id },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          const fe = fieldErrors(err);
          setErrors(fe.fields);
          setFormError(fe.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader title={existing ? t("edit") : t("add")} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pv-name" label={t("name")} error={errors.name}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field
                id="pv-name-ne"
                label={t("name_ne")}
                error={errors.name_ne}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  lang="ne"
                  value={form.name_ne ?? ""}
                  onChange={(e) => set("name_ne", e.target.value)}
                />
              </Field>
              <Field id="pv-kind" label={t("kind")} error={errors.kind}>
                <NativeSelect
                  value={form.kind}
                  onChange={(e) => set("kind", e.target.value as ProviderInput["kind"])}
                  options={PROVIDER_KINDS.map((k) => ({ value: k, label: tk(k) }))}
                />
              </Field>
              <Field
                id="pv-aff"
                label={t("affiliation_no")}
                error={errors.ctevt_affiliation_no}
                optional={form.kind !== "ctevt_affiliated"}
                optionalLabel={tc("optional")}
              >
                <Input
                  value={form.ctevt_affiliation_no ?? ""}
                  onChange={(e) => set("ctevt_affiliation_no", e.target.value)}
                />
              </Field>
              <Field id="pv-district" label={t("district")} error={errors.district}>
                <DistrictSelect value={form.district} onChange={(v) => set("district", v)} />
              </Field>
              <Field id="pv-phone" label={t("phone")} error={errors.phone}>
                <Input
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field
                id="pv-address"
                label={t("address")}
                error={errors.address}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field
                id="pv-email"
                label={t("email")}
                error={errors.email}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </div>
            <SwitchField
              id="pv-active"
              label={t("active")}
              description={t("active_hint")}
              checked={!!form.is_active}
              onCheckedChange={(v) => set("is_active", v)}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================== courses

function CoursesTab({
  draft,
  onDraftConsumed,
}: {
  draft: Partial<CourseInput> | null;
  onDraftConsumed: () => void;
}) {
  const t = useTranslations("training.courses");
  const ts = useTranslations("training.course_status");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const f = useFormat();
  const [q, setQ] = React.useState("");
  const [provider, setProvider] = React.useState("");
  const [status, setStatus] = React.useState("open");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<Course | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Course | null>(null);
  const [sessionsFor, setSessionsFor] = React.useState<Course | null>(null);
  React.useEffect(() => setPage(1), [q, provider, status]);
  React.useEffect(() => {
    if (draft) setEditing("new");
  }, [draft]);
  const providers = useOpsProviders({ page_size: 100 });
  const query = useOpsCourses({
    q: q || undefined,
    provider: provider || undefined,
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const del = useDeleteCourse();
  const rows = query.data?.results ?? [];

  return (
    <div>
      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={t("search")}
          className="sm:max-w-xs sm:flex-1"
        />
        <NativeSelect
          aria-label={t("provider")}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder={t("all_providers")}
          className="sm:w-56"
          options={(providers.data?.results ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder={tc("all")}
          className="sm:w-40"
          options={COURSE_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
        />
        <Button className="sm:ml-auto" onClick={() => setEditing("new")}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={q || provider ? tc("no_results") : t("empty_title")}
          description={q || provider ? undefined : t("empty_body")}
          action={<Button onClick={() => setEditing("new")}>{t("add")}</Button>}
        />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("title_en")}</Th>
                  <Th>{t("provider")}</Th>
                  <Th>{t("starts_on")}</Th>
                  <Th numeric>{t("fee")}</Th>
                  <Th numeric>{t("seats")}</Th>
                  <Th>{t("status")}</Th>
                  <Th className="w-12">
                    <span className="sr-only">{tc("actions")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <Tr key={c.id}>
                    <RowHeader className="min-w-56">
                      <span className="block">{c.title}</span>
                      <span className="text-fg-muted mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal">
                        {f.name(c.trade)} · {c.level_label} ·{" "}
                        {t("days", { count: c.duration_days })}
                        {c.leads_to_nstb ? <Badge tone="brand">{t("nstb_badge")}</Badge> : null}
                      </span>
                    </RowHeader>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {c.provider.name}
                        <ProviderVerifiedBadge verified={c.provider.verified} />
                      </span>
                      <span className="text-fg-muted block text-xs">
                        {f.name(c.district)} · {c.mode_label}
                      </span>
                    </Td>
                    <Td>
                      <DateText ad={c.starts_on} bs={c.starts_on_bs} />
                    </Td>
                    <Td numeric>{Number(c.fee) ? <Money value={c.fee} /> : t("free")}</Td>
                    <Td numeric>
                      <span className="block">
                        {t("seats_taken", {
                          taken: f.digits(c.seats_taken),
                          seats: f.digits(c.seats),
                        })}
                      </span>
                      {c.applied_count ? (
                        <span className="text-warning block text-xs">
                          {t("applied", { count: f.digits(c.applied_count) })}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <CourseStatusBadge status={c.status} label={c.status_label} />
                    </Td>
                    <Td>
                      <RowMenu
                        label={tc("more_actions")}
                        items={[
                          { label: tc("edit"), icon: Pencil, onSelect: () => setEditing(c) },
                          {
                            label: tRoot("training.sessions.title"),
                            icon: CalendarDays,
                            onSelect: () => setSessionsFor(c),
                          },
                          {
                            label: tc("delete"),
                            icon: Trash2,
                            danger: true,
                            onSelect: () => setDeleting(c),
                          },
                        ]}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
      <CourseSessionsSheet course={sessionsFor} onClose={() => setSessionsFor(null)} />
      <CourseDialog
        course={editing}
        draft={editing === "new" ? draft : null}
        providers={providers.data?.results ?? []}
        onClose={() => {
          setEditing(null);
          onDraftConsumed();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={tc("are_you_sure")}
        description={deleting ? t("delete_confirm", { title: deleting.title }) : undefined}
        confirmLabel={tc("delete")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              setDeleting(null);
            },
            onError: (e) => {
              toastError(e, tRoot);
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}

type CourseForm = Omit<CourseInput, "duration_days" | "seats" | "fee" | "min_attendance_pct"> & {
  duration_days: string;
  seats: string;
  fee: string;
  min_attendance_pct: string;
};

function CourseDialog({
  course,
  draft,
  providers,
  onClose,
}: {
  course: Course | "new" | null;
  draft: Partial<CourseInput> | null;
  providers: TrainingProvider[];
  onClose: () => void;
}) {
  const t = useTranslations("training.courses");
  const tl = useTranslations("training.level");
  const tm = useTranslations("training.mode");
  const ts = useTranslations("training.course_status");
  const tc = useTranslations("common");
  const save = useSaveCourse();
  const open = course !== null;
  const existing = course && course !== "new" ? course : null;
  const [form, setForm] = React.useState<CourseForm | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setForm(
      existing
        ? {
            provider_id: existing.provider.id,
            trade: existing.trade.code,
            title: existing.title,
            title_ne: existing.title_ne ?? "",
            description: existing.description ?? "",
            level: existing.level,
            duration_days: String(existing.duration_days),
            fee: String(Number(existing.fee)),
            sponsor_note: existing.sponsor_note ?? "",
            mode: existing.mode,
            district: existing.district.code,
            starts_on: existing.starts_on,
            seats: String(existing.seats),
            status: existing.status,
            leads_to_nstb: existing.leads_to_nstb,
            min_attendance_pct: String(existing.min_attendance_pct ?? 0),
          }
        : {
            provider_id: "",
            trade: draft?.trade ?? "",
            title: "",
            title_ne: "",
            description: "",
            level: "level1",
            duration_days: "30",
            fee: "0",
            sponsor_note: "",
            mode: "classroom",
            district: draft?.district ?? "",
            starts_on: todayIso(),
            seats: "20",
            status: "open",
            leads_to_nstb: false,
            min_attendance_pct: "0",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  if (!form) return null;
  const set = <K extends keyof CourseForm>(k: K, v: CourseForm[K]) =>
    setForm((s) => (s ? { ...s, [k]: v } : s));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const k of ["provider_id", "trade", "title", "district", "starts_on"] as const) {
      if (!String(form[k] ?? "").trim()) errs[k.replace(/_id$/, "")] = t("required");
    }
    for (const k of ["duration_days", "seats"] as const) {
      const n = Number(form[k]);
      if (!Number.isInteger(n) || n < 1) errs[k] = t("invalid_number");
    }
    if (!(Number(form.fee) >= 0)) errs.fee = t("invalid_number");
    const minPct = parsePct(form.min_attendance_pct);
    if (minPct === null) errs.min_attendance_pct = t("invalid_pct");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Provider district is the natural default for a new course.
    save.mutate(
      {
        ...form,
        id: existing?.id,
        duration_days: Number(form.duration_days),
        seats: Number(form.seats),
        fee: String(form.fee || "0"),
        min_attendance_pct: minPct ?? 0,
        title_ne: form.title_ne || null,
        description: form.description || null,
        sponsor_note: form.sponsor_note || null,
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (err) => {
          const fe = fieldErrors(err);
          setErrors(fe.fields);
          setFormError(fe.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader title={existing ? t("edit") : t("add")} />
        <form onSubmit={submit} className="contents" noValidate>
          <DialogBody className="space-y-4">
            <FormError message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cs-provider" label={t("provider")} error={errors.provider}>
                <NativeSelect
                  value={form.provider_id}
                  onChange={(e) => {
                    const p = providers.find((x) => x.id === e.target.value);
                    setForm((s) =>
                      s
                        ? {
                            ...s,
                            provider_id: e.target.value,
                            district: s.district || p?.district.code || "",
                          }
                        : s,
                    );
                  }}
                  placeholder={tc("select")}
                  options={providers
                    .filter((p) => p.is_active || p.id === form.provider_id)
                    .map((p) => ({ value: p.id, label: p.name }))}
                />
              </Field>
              <Field id="cs-trade" label={t("trade")} error={errors.trade}>
                <TradeSelect value={form.trade} onChange={(v) => set("trade", v)} />
              </Field>
              <Field id="cs-title" label={t("title_en")} error={errors.title}>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field
                id="cs-title-ne"
                label={t("title_ne")}
                error={errors.title_ne}
                optional
                optionalLabel={tc("optional")}
              >
                <Input
                  lang="ne"
                  value={form.title_ne ?? ""}
                  onChange={(e) => set("title_ne", e.target.value)}
                />
              </Field>
              <Field id="cs-level" label={t("level")} error={errors.level}>
                <NativeSelect
                  value={form.level}
                  onChange={(e) => set("level", e.target.value as CourseForm["level"])}
                  options={COURSE_LEVELS.map((l) => ({ value: l, label: tl(l) }))}
                />
              </Field>
              <Field id="cs-mode" label={t("mode")} error={errors.mode}>
                <NativeSelect
                  value={form.mode}
                  onChange={(e) => set("mode", e.target.value as CourseForm["mode"])}
                  options={COURSE_MODES.map((m) => ({ value: m, label: tm(m) }))}
                />
              </Field>
              <Field id="cs-district" label={t("district")} error={errors.district}>
                <DistrictSelect value={form.district} onChange={(v) => set("district", v)} />
              </Field>
              <Field id="cs-starts" label={t("starts_on")} error={errors.starts_on}>
                <BsDatePicker value={form.starts_on} onChange={(v) => set("starts_on", v)} />
              </Field>
              <Field id="cs-days" label={t("duration_days")} error={errors.duration_days}>
                <Input
                  inputMode="numeric"
                  value={form.duration_days}
                  onChange={(e) => set("duration_days", e.target.value)}
                />
              </Field>
              <Field id="cs-seats" label={t("seats")} error={errors.seats}>
                <Input
                  inputMode="numeric"
                  value={form.seats}
                  onChange={(e) => set("seats", e.target.value)}
                />
              </Field>
              <Field
                id="cs-fee"
                label={t("fee")}
                error={errors.fee}
                hint={Number(form.fee) === 0 ? t("free") : undefined}
              >
                <Input
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => set("fee", e.target.value)}
                />
              </Field>
              <Field
                id="cs-min-att"
                label={t("min_attendance_pct")}
                error={errors.min_attendance_pct}
                hint={t("min_attendance_hint")}
              >
                <Input
                  inputMode="numeric"
                  value={form.min_attendance_pct}
                  onChange={(e) => set("min_attendance_pct", e.target.value)}
                />
              </Field>
              <Field id="cs-status" label={t("status")} error={errors.status}>
                <NativeSelect
                  value={form.status ?? "open"}
                  onChange={(e) => set("status", e.target.value as CourseForm["status"])}
                  options={COURSE_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
                />
              </Field>
            </div>
            <Field
              id="cs-sponsor"
              label={t("sponsor_note")}
              error={errors.sponsor_note}
              optional
              optionalLabel={tc("optional")}
            >
              <Input
                value={form.sponsor_note ?? ""}
                onChange={(e) => set("sponsor_note", e.target.value)}
                placeholder={t("sponsor_note_placeholder")}
              />
            </Field>
            <Field
              id="cs-desc"
              label={t("description")}
              error={errors.description}
              optional
              optionalLabel={tc("optional")}
            >
              <Textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <SwitchField
              id="cs-nstb"
              label={t("leads_to_nstb")}
              checked={!!form.leads_to_nstb}
              onCheckedChange={(v) => set("leads_to_nstb", v)}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================== enrolments

function EnrollmentsTab() {
  const t = useTranslations("training.enrollments");
  const ts = useTranslations("training.enrollment_status");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const f = useFormat();
  const [course, setCourse] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [completing, setCompleting] = React.useState<Enrollment | null>(null);
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  React.useEffect(() => setPage(1), [course, status, q]);
  React.useEffect(() => setCompleteError(null), [completing]);
  const courses = useOpsCourses({ page_size: 100 });
  const query = useOpsEnrollments({
    course: course || undefined,
    status: status || undefined,
    q: q || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const setStatusM = useSetEnrollmentStatus();
  const rows = query.data?.results ?? [];

  const move = (e: Enrollment, to: EnrollmentStatus) => {
    if (to === "completed") {
      setCompleting(e);
      return;
    }
    setStatusM.mutate(
      { id: e.id, status: to },
      {
        onSuccess: () =>
          toast.success(t("status_toast", { name: e.worker.full_name, status: ts(to) })),
        onError: (err) => toastError(err, tRoot),
      },
    );
  };

  return (
    <div>
      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={tc("search_placeholder")}
          className="sm:max-w-xs sm:flex-1"
        />
        <NativeSelect
          aria-label={t("course")}
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          placeholder={t("all_courses")}
          className="sm:w-64"
          options={(courses.data?.results ?? []).map((c) => ({
            value: c.id,
            label: `${c.title} — ${c.provider.name}`,
          }))}
        />
        <NativeSelect
          aria-label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder={t("all_statuses")}
          className="sm:w-44"
          options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: ts(s) }))}
        />
      </Toolbar>
      {query.isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <>
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <Th>{t("worker")}</Th>
                  <Th>{t("course")}</Th>
                  <Th>{t("sponsor")}</Th>
                  <Th>{t("applied_at")}</Th>
                  <Th numeric>{t("attendance")}</Th>
                  <Th>{t("status")}</Th>
                  <Th className="w-12">
                    <span className="sr-only">{t("change_status")}</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((e) => {
                  const next = ENROLLMENT_NEXT[e.status] ?? [];
                  return (
                    <Tr key={e.id}>
                      <RowHeader>
                        <Link
                          href={`/ops/workers/${e.worker.id}`}
                          className="block hover:underline"
                        >
                          {e.worker.full_name}
                        </Link>
                        {e.worker.phone ? (
                          <span className="text-fg-muted tabular block text-xs font-normal">
                            {f.phone(e.worker.phone)}
                          </span>
                        ) : null}
                      </RowHeader>
                      <Td>
                        <span className="block">{e.course.title}</span>
                        <span className="text-fg-muted block text-xs">
                          {e.course.provider.name}
                        </span>
                      </Td>
                      <Td>
                        {e.sponsored_by_org?.name ?? (
                          <span className="text-fg-muted">{t("self_applied")}</span>
                        )}
                      </Td>
                      <Td>
                        <DateText ad={e.applied_at.slice(0, 10)} inline />
                      </Td>
                      <Td numeric>
                        <AttendanceCell enrollment={e} />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <EnrollmentStatusBadge status={e.status} label={e.status_label} />
                          {e.credential_id ? <Badge tone="success">{t("credential")}</Badge> : null}
                        </div>
                      </Td>
                      <Td>
                        {next.length ? (
                          <RowMenu
                            label={t("change_status")}
                            items={next.map((s) => ({
                              label: t(`to.${s}`),
                              onSelect: () => move(e, s),
                            }))}
                          />
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
      <ConfirmDialog
        open={!!completing}
        onOpenChange={(v) => !v && setCompleting(null)}
        title={t("complete_confirm_title")}
        description={
          completing
            ? t("complete_confirm_body", {
                name: completing.worker.full_name,
                course: completing.course.title,
              })
            : undefined
        }
        confirmLabel={t("to.completed")}
        loading={setStatusM.isPending}
        onConfirm={() =>
          completing &&
          setStatusM.mutate(
            { id: completing.id, status: "completed" },
            {
              onSuccess: () => {
                toast.success(t("completed_toast", { name: completing.worker.full_name }));
                setCompleting(null);
              },
              onError: (err) => {
                // invalid_state = below the course's minimum attendance: keep the dialog open.
                if (isApiError(err) && err.code === "invalid_state") {
                  setCompleteError(errorMessage(err, tRoot));
                  return;
                }
                toastError(err, tRoot);
                setCompleting(null);
              },
            },
          )
        }
      >
        {completeError ? <FormError message={completeError} /> : null}
      </ConfirmDialog>
    </div>
  );
}

function AttendanceCell({ enrollment: e }: { enrollment: Enrollment }) {
  const t = useTranslations("training.enrollments");
  const f = useFormat();
  const text = attendanceSummary(e.attendance);
  if (!text) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="tabular whitespace-nowrap" title={t("attendance_hint")}>
      {f.digits(text)}
    </span>
  );
}

// =========================================================================== shortages

function ShortagesTab({
  onPlanCourse,
}: {
  onPlanCourse: (trade: string, district: string) => void;
}) {
  const t = useTranslations("training.shortages");
  const f = useFormat();
  const [district, setDistrict] = React.useState("");
  const [days, setDays] = React.useState<"30" | "90" | "180">("90");
  const query = useShortages({ district: district || undefined, days });
  const rows = query.data?.results ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.max(r.demand, r.supply)));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-fg text-lg font-semibold">{t("title")}</h2>
        <p className="text-fg-muted text-sm">{t("subtitle")}</p>
      </div>
      <Toolbar>
        <div className="sm:w-60">
          <DistrictSelect
            value={district}
            onChange={setDistrict}
            placeholder={t("all_districts")}
            aria-label={t("district")}
          />
        </div>
        <Segmented
          size="sm"
          label={t("window")}
          value={days}
          onChange={setDays}
          options={(["30", "90", "180"] as const).map((d) => ({
            value: d,
            label: t("days", { count: f.digits(d) }),
          }))}
        />
        <div className="text-fg-muted flex items-center gap-4 text-xs sm:ml-auto">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-accent size-2.5 rounded-sm" aria-hidden />
            {t("legend_demand")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-brand size-2.5 rounded-sm" aria-hidden />
            {t("legend_supply")}
          </span>
        </div>
      </Toolbar>
      {query.isLoading ? (
        <Card>
          <CardBody className="space-y-4 pt-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardBody>
        </Card>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={BarChart3} title={t("empty_title")} description={t("empty_body")} />
      ) : (
        <Card>
          <ul className="divide-border divide-y" aria-label={t("title")}>
            {rows.map((r) => (
              <ShortageBar
                key={r.trade.code}
                row={r}
                max={max}
                onPlan={() => onPlanCourse(r.trade.code, district)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ShortageBar({
  row: r,
  max,
  onPlan,
}: {
  row: ShortageRow;
  max: number;
  onPlan: () => void;
}) {
  const t = useTranslations("training.shortages");
  const f = useFormat();
  const pct = (n: number) => `${Math.round((n / max) * 100)}%`;
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-fg truncate font-medium">{f.name(r.trade)}</p>
        <p className="text-fg-muted text-xs">
          {t("open_jobs", { count: r.open_jobs })}
          {r.fill_rate !== null
            ? ` · ${t("fill_rate")} ${f.digits(Math.round(r.fill_rate * 100))}%`
            : ""}
        </p>
      </div>
      <div
        className="space-y-1.5"
        role="img"
        aria-label={`${f.name(r.trade)}: ${t("demand")} ${r.demand}, ${t("supply")} ${r.supply}, ${t("shortage")} ${r.shortage}`}
      >
        <div className="flex items-center gap-2">
          <div className="bg-surface-hover h-2.5 flex-1 overflow-hidden rounded-full">
            <div className="bg-accent h-full rounded-full" style={{ width: pct(r.demand) }} />
          </div>
          <span className="text-fg-muted tabular w-10 text-right text-xs">
            {f.digits(r.demand)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-surface-hover h-2.5 flex-1 overflow-hidden rounded-full">
            <div className="bg-brand h-full rounded-full" style={{ width: pct(r.supply) }} />
          </div>
          <span className="text-fg-muted tabular w-10 text-right text-xs">
            {f.digits(r.supply)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span
          className={cn(
            "tabular text-sm font-semibold",
            r.shortage ? "text-danger" : "text-success",
          )}
        >
          {t("shortage")}: {f.digits(r.shortage)}
        </span>
        {r.shortage ? (
          <Button variant="secondary" size="sm" onClick={onPlan}>
            <Plus aria-hidden />
            {t("plan_course")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

// =========================================================================== shared row menu

function RowMenu({
  label,
  items,
}: {
  label: string;
  items: {
    label: string;
    icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    danger?: boolean;
    onSelect: () => void;
  }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} title={label}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ label: l, icon: Icon, danger, onSelect }) => (
          <DropdownMenuItem key={l} onSelect={onSelect} danger={danger}>
            {Icon ? <Icon aria-hidden /> : null}
            {l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
