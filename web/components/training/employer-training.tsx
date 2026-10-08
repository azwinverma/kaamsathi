"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  GraduationCap,
  MapPin,
  Phone,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useSession } from "@/components/providers/session";
import { NoAccess } from "@/components/org/no-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateText, Money } from "@/components/ui/date";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Table, TableContainer, TBody, Td, Th, THead, Tr, RowHeader } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeSelect } from "@/components/shared/selects";
import { useEmployments } from "@/lib/api/hooks/workforce";
import { useOrgCourses, useOrgEnrollments, useSponsorEnrollments } from "@/lib/api/hooks/training";
import type { Course } from "@/lib/api/types-training";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { EnrollmentStatusBadge } from "./shared";

const PAGE_SIZE = 12;

/** /app/training — browse courses, sponsor workers, see sponsored enrolments. */
export function EmployerTrainingPage() {
  const session = useSession();
  const t = useTranslations("training.employer");
  const [tab, setTab] = React.useState("browse");
  if (!session.canManage) return <NoAccess />;
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="browse">
            <GraduationCap aria-hidden />
            {t("tab_browse")}
          </TabsTrigger>
          <TabsTrigger value="sponsored">
            <Users aria-hidden />
            {t("tab_sponsored")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="browse">
          <BrowseCourses />
        </TabsContent>
        <TabsContent value="sponsored">
          <SponsoredEnrollments />
        </TabsContent>
      </Tabs>
    </>
  );
}

function BrowseCourses() {
  const t = useTranslations("training.employer");
  const tc = useTranslations("common");
  const [trade, setTrade] = React.useState("");
  const [only, setOnly] = React.useState<"all" | "recommended">("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [sponsoring, setSponsoring] = React.useState<Course | null>(null);
  React.useEffect(() => setPage(1), [trade, only, q]);
  const query = useOrgCourses({
    trade: trade || undefined,
    q: q || undefined,
    recommended: only === "recommended" ? "true" : undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = query.data?.results ?? [];
  const filtered = !!(trade || q || only === "recommended");

  return (
    <div>
      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={tc("search_placeholder")}
          className="sm:max-w-xs sm:flex-1"
        />
        <div className="sm:w-56">
          <TradeSelect
            value={trade}
            onChange={setTrade}
            allowEmpty
            placeholder={t("all_trades")}
            aria-label={t("all_trades")}
          />
        </div>
        <Segmented
          size="sm"
          label={t("recommended")}
          value={only}
          onChange={setOnly}
          options={[
            { value: "all", label: tc("all") },
            { value: "recommended", label: t("only_recommended") },
          ]}
        />
      </Toolbar>
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-dense" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={filtered ? tc("no_results") : t("empty_title")}
          description={filtered ? undefined : t("empty_body")}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} onSponsor={() => setSponsoring(c)} />
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            count={query.data?.count ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
      <SponsorDialog course={sponsoring} onClose={() => setSponsoring(null)} />
    </div>
  );
}

export function CourseCard({ course: c, onSponsor }: { course: Course; onSponsor?: () => void }) {
  const t = useTranslations("training.employer");
  const tcs = useTranslations("training.courses");
  const f = useFormat();
  const ne = f.locale === "ne";
  const left = Math.max(0, c.seats - c.seats_taken);
  const title = ne && c.title_ne ? c.title_ne : c.title;
  const provider = ne && c.provider.name_ne ? c.provider.name_ne : c.provider.name;
  return (
    <Card className="flex h-full flex-col">
      <div className="flex-1 space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {c.recommended ? (
            <Badge tone="accent" title={t("recommended_hint")}>
              <Sparkles aria-hidden />
              {t("recommended")}
            </Badge>
          ) : null}
          {c.leads_to_nstb ? <Badge tone="brand">{tcs("nstb_badge")}</Badge> : null}
          <Badge tone="outline">{c.level_label}</Badge>
        </div>
        <div>
          <h3 className="text-fg text-base font-semibold">{title}</h3>
          <p className="text-fg-muted text-sm">
            {provider} · {c.provider.kind_label}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Fact icon={CalendarDays} label={tcs("starts_on")}>
            {f.date(c.starts_on, c.starts_on_bs).bs}
          </Fact>
          <Fact icon={Clock} label={tcs("duration_days")}>
            {tcs("days", { count: c.duration_days })}
          </Fact>
          <Fact icon={MapPin} label={tcs("district")}>
            {f.name(c.district)} · {c.mode_label}
          </Fact>
          <Fact icon={BadgeCheck} label={tcs("fee")}>
            {Number(c.fee) ? (
              <Money value={c.fee} />
            ) : (
              <span className="text-success font-medium">{tcs("free")}</span>
            )}
          </Fact>
        </dl>
        {c.sponsor_note ? (
          <p className="bg-surface-muted text-fg-body rounded-md px-3 py-2 text-xs">
            {c.sponsor_note}
          </p>
        ) : null}
      </div>
      <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
        <span className={cn("text-xs font-medium", left ? "text-fg-muted" : "text-danger")}>
          {t("seats_left", { count: left })}
        </span>
        {onSponsor ? (
          <Button size="sm" onClick={onSponsor} disabled={!left}>
            <UserPlus aria-hidden />
            {t("sponsor")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="text-fg-subtle mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="text-fg-body truncate">{children}</dd>
      </div>
    </div>
  );
}

function SponsorDialog({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const t = useTranslations("training.employer");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const f = useFormat();
  const open = !!course;
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const employments = useEmployments({ status: "active", q: q || undefined, page_size: 100 }, open);
  const sponsor = useSponsorEnrollments();
  React.useEffect(() => {
    if (open) {
      setSelected(new Set());
      setQ("");
    }
  }, [open, course?.id]);
  const rows = employments.data?.results ?? [];
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = () => {
    if (!course || !selected.size) return;
    sponsor.mutate(
      { course_id: course.id, worker_ids: [...selected] },
      {
        onSuccess: (res) => {
          if (res.created.length)
            toast.success(t("sponsored_toast", { count: res.created.length }));
          if (res.skipped.length) toast.info(t("skipped", { count: res.skipped.length }));
          onClose();
        },
        onError: (e) => toastError(e, tRoot),
      },
    );
  };

  const feeTotal = course ? Number(course.fee) * selected.size : 0;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg" closeLabel={tc("close")}>
        <DialogHeader
          title={course ? t("sponsor_title", { course: course.title }) : ""}
          description={t("sponsor_desc")}
        />
        <DialogBody className="space-y-3">
          <SearchInput value={q} onChange={setQ} placeholder={t("search_workers")} />
          {employments.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : employments.isError ? (
            <ErrorState error={employments.error} onRetry={() => employments.refetch()} />
          ) : rows.length === 0 ? (
            <p className="text-fg-muted py-6 text-center text-sm">{t("no_workers")}</p>
          ) : (
            <ul className="divide-border border-border max-h-[45dvh] divide-y overflow-y-auto rounded-dense border">
              {rows.map((e) => {
                const id = `sp-${e.worker.id}`;
                const match = course && e.trade?.code === course.trade.code;
                return (
                  <li key={e.id}>
                    <label
                      htmlFor={id}
                      className="hover:bg-surface-hover flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2"
                    >
                      <Checkbox
                        id={id}
                        checked={selected.has(e.worker.id)}
                        onCheckedChange={() => toggle(e.worker.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-fg block truncate text-sm font-medium">
                          {e.worker.full_name}
                        </span>
                        <span className="text-fg-muted block truncate text-xs">
                          {e.designation || (e.trade ? f.name(e.trade) : "")}
                          {e.site ? ` · ${e.site.name}` : ""}
                        </span>
                      </span>
                      {match ? (
                        <Badge tone="accent">
                          <Sparkles aria-hidden />
                          {t("recommended")}
                        </Badge>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-border bg-surface-muted/60 rounded-md border px-3 py-2.5 text-sm">
            <p className="text-fg font-medium">
              {t("selected", { count: f.digits(selected.size) })}
              {feeTotal ? ` · ${t("fee_total", { amount: f.money(feeTotal) })}` : ""}
            </p>
            <p className="text-fg-muted mt-0.5 text-xs">{t("fee_note")}</p>
            {course?.provider.phone ? (
              <p className="text-fg-muted mt-1 inline-flex items-center gap-1 text-xs">
                <Phone className="size-3.5" aria-hidden />
                {t("provider_contact")}:{" "}
                <span className="tabular">{f.phone(course.provider.phone)}</span>
              </p>
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} disabled={!selected.size} loading={sponsor.isPending}>
            <UserPlus aria-hidden />
            {t("sponsor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SponsoredEnrollments() {
  const t = useTranslations("training.employer");
  const te = useTranslations("training.enrollments");
  const [page, setPage] = React.useState(1);
  const query = useOrgEnrollments({ page, page_size: 20 });
  const rows = query.data?.results ?? [];
  if (query.isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!rows.length) {
    return (
      <EmptyState
        icon={Users}
        title={t("sponsored_empty_title")}
        description={t("sponsored_empty_body")}
      />
    );
  }
  return (
    <>
      <TableContainer>
        <Table>
          <THead>
            <tr>
              <Th>{te("worker")}</Th>
              <Th>{te("course")}</Th>
              <Th>{te("applied_at")}</Th>
              <Th>{te("status")}</Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((e) => (
              <Tr key={e.id}>
                <RowHeader>{e.worker.full_name}</RowHeader>
                <Td>
                  <span className="block">{e.course.title}</span>
                  <span className="text-fg-muted block text-xs">
                    {e.course.provider.name} ·{" "}
                    <DateText ad={e.course.starts_on} bs={e.course.starts_on_bs} inline />
                  </span>
                </Td>
                <Td>
                  <DateText ad={e.applied_at.slice(0, 10)} inline />
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EnrollmentStatusBadge status={e.status} label={e.status_label} />
                    {e.credential_id ? (
                      <Badge tone="success">
                        <BadgeCheck aria-hidden />
                        {t("trained_badge")}
                      </Badge>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      <Pagination page={page} pageSize={20} count={query.data?.count ?? 0} onPageChange={setPage} />
    </>
  );
}
