"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Pencil, Power, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Toolbar } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchInput } from "@/components/ui/search-input";
import { RowHeader, TBody, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useSession } from "@/components/providers/session";
import { isApiError } from "@/lib/api/errors";
import { useCreateStaff, useResetStaffMfa, useStaff, useUpdateStaff } from "@/lib/api/hooks/security";
import { STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/api/types-security";
import { isValidPhone } from "@/lib/format";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { RequireStaffRole } from "./require-staff-role";

const PAGE_SIZE = 25;

export function StaffAdminPage() {
  return (
    <RequireStaffRole roles={["superadmin"]}>
      <StaffAdmin />
    </RequireStaffRole>
  );
}

function StaffAdmin() {
  const t = useTranslations("security.staff");
  const tc = useTranslations();
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffMember | null>(null);
  const [resetting, setResetting] = React.useState<StaffMember | null>(null);
  const [toggling, setToggling] = React.useState<StaffMember | null>(null);
  const update = useUpdateStaff();
  const reset = useResetStaffMfa();

  const query = useStaff({ q: q || undefined, page });
  const rows = query.data?.results ?? [];
  const count = query.data?.count ?? 0;
  const pageSizeRef = React.useRef(PAGE_SIZE);
  if (query.data?.next && rows.length) pageSizeRef.current = rows.length;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        meta={query.data ? <Badge tone="neutral">{t("count", { count })}</Badge> : null}
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden />
            {t("add")}
          </Button>
        }
      />
      <Toolbar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={t("search")}
        />
      </Toolbar>

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={q ? tc("common.no_results") : t("empty")} />
      ) : (
        <>
          <TableContainer className={query.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <Table>
              <THead>
                <tr>
                  <Th>{t("col_person")}</Th>
                  <Th>{t("col_roles")}</Th>
                  <Th>{t("col_mfa")}</Th>
                  <Th className="max-md:hidden">{t("col_last_login")}</Th>
                  <Th>{t("col_status")}</Th>
                  <Th className="text-right">{tc("common.actions")}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((m) => (
                  <StaffRow
                    key={m.id}
                    member={m}
                    onEdit={() => setEditing(m)}
                    onReset={() => setResetting(m)}
                    onToggle={() => setToggling(m)}
                  />
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <Pagination page={page} pageSize={pageSizeRef.current} count={count} onPageChange={setPage} />
        </>
      )}

      <AddStaffDialog open={adding} onOpenChange={setAdding} />
      <EditRolesDialog member={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title={t("reset_mfa_title")}
        description={resetting ? t("reset_mfa_body", { name: resetting.full_name || resetting.phone }) : undefined}
        confirmLabel={t("reset_mfa")}
        danger
        loading={reset.isPending}
        onConfirm={() =>
          resetting &&
          reset.mutate(resetting.id, {
            onSuccess: () => {
              toast.success(t("reset_mfa_toast"));
              setResetting(null);
            },
            onError: (e) => toastError(e, tc),
          })
        }
      />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.is_active ? t("deactivate_title") : t("activate_title")}
        description={
          toggling
            ? toggling.is_active
              ? t("deactivate_body", { name: toggling.full_name || toggling.phone })
              : t("activate_body", { name: toggling.full_name || toggling.phone })
            : undefined
        }
        confirmLabel={toggling?.is_active ? t("deactivate") : t("activate")}
        danger={!!toggling?.is_active}
        loading={update.isPending}
        onConfirm={() =>
          toggling &&
          update.mutate(
            { id: toggling.id, is_active: !toggling.is_active },
            {
              onSuccess: (m) => {
                toast.success(m.is_active ? t("activated_toast") : t("deactivated_toast"));
                setToggling(null);
              },
              onError: (e) => toastError(e, tc),
            },
          )
        }
      />
    </>
  );
}

function RoleBadges({ roles }: { roles: StaffRole[] }) {
  const t = useTranslations("security.roles");
  const tt = useTranslations("security.staff");
  if (!roles.length) return <span className="text-xs text-fg-subtle">{tt("no_roles")}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <Badge key={r} tone={r === "superadmin" ? "accent" : "brand"}>
          {t.has(r) ? t(r) : r}
        </Badge>
      ))}
    </div>
  );
}

function StaffRow({
  member: m,
  onEdit,
  onReset,
  onToggle,
}: {
  member: StaffMember;
  onEdit: () => void;
  onReset: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations("security.staff");
  const f = useFormat();
  const { me } = useSession();
  const self = me.id === m.id;
  return (
    <Tr>
      <RowHeader className="min-w-44">
        <span className="block truncate font-medium text-fg">
          {m.full_name || "—"}
          {self ? <span className="ml-1.5 text-xs font-normal text-fg-muted">({t("you")})</span> : null}
        </span>
        <span className="block text-xs font-normal text-fg-muted tabular">{f.phone(m.phone)}</span>
      </RowHeader>
      <Td className="min-w-40">
        <RoleBadges roles={m.roles} />
      </Td>
      <Td className="whitespace-nowrap">
        {m.mfa_enabled ? (
          <Badge tone="success" dot title={m.mfa_enrolled_at ? f.dateTime(m.mfa_enrolled_at) : undefined}>
            {t("mfa_on")}
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            {t("mfa_off")}
          </Badge>
        )}
      </Td>
      <Td className="tabular whitespace-nowrap text-sm max-md:hidden">
        {m.last_login ? f.dateTime(m.last_login) : <span className="text-fg-subtle">{t("never")}</span>}
      </Td>
      <Td>
        <Badge tone={m.is_active ? "success" : "neutral"}>{m.is_active ? t("active") : t("inactive")}</Badge>
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Pencil aria-hidden />
            {t("edit_roles")}
          </Button>
          {m.mfa_enabled ? (
            <Button size="sm" variant="secondary" onClick={onReset} aria-label={t("reset_mfa_for", { name: m.full_name || m.phone })}>
              <KeyRound aria-hidden />
              <span className="max-xl:sr-only">{t("reset_mfa")}</span>
            </Button>
          ) : null}
          {!self ? (
            <Button
              size="sm"
              variant={m.is_active ? "danger-outline" : "secondary"}
              onClick={onToggle}
              aria-label={(m.is_active ? t("deactivate") : t("activate")) + ` — ${m.full_name || m.phone}`}
            >
              <Power aria-hidden />
              <span className="max-xl:sr-only">{m.is_active ? t("deactivate") : t("activate")}</span>
            </Button>
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}

function RoleCheckboxes({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: StaffRole[];
  onChange: (v: StaffRole[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("security.roles");
  const td = useTranslations("security.role_desc");
  const tt = useTranslations("security.staff");
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium text-fg">{tt("roles")}</legend>
      {STAFF_ROLES.map((r) => {
        const id = `${idPrefix}-${r}`;
        const checked = value.includes(r);
        return (
          <div key={r} className="flex items-start gap-2.5 rounded-md border border-border p-2.5">
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(c) =>
                onChange(c === true ? STAFF_ROLES.filter((x) => x === r || value.includes(x)) : value.filter((x) => x !== r))
              }
              aria-describedby={`${id}-desc`}
              className="mt-0.5"
            />
            <div>
              <label htmlFor={id} className="text-sm font-medium text-fg">
                {t(r)}
              </label>
              <p id={`${id}-desc`} className="text-xs text-fg-muted">
                {td(r)}
              </p>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

function AddStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("security.staff");
  const tc = useTranslations();
  const create = useCreateStaff();
  const [phone, setPhone] = React.useState("");
  const [name, setName] = React.useState("");
  const [roles, setRoles] = React.useState<StaffRole[]>([]);
  const [errors, setErrors] = React.useState<{ phone?: string; full_name?: string; roles?: string; form?: string }>({});

  React.useEffect(() => {
    if (open) {
      setPhone("");
      setName("");
      setRoles([]);
      setErrors({});
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidPhone(phone)) next.phone = tc("errors.invalid_phone");
    if (!name.trim()) next.full_name = tc("errors.required");
    if (!roles.length) next.roles = t("roles_required");
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate(
      { phone, full_name: name.trim(), roles },
      {
        onSuccess: () => {
          toast.success(t("added_toast"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fields).length) {
            setErrors({
              phone: err.fieldError("phone"),
              full_name: err.fieldError("full_name"),
              roles: err.fieldError("roles"),
              form: err.fields.non_field_errors?.[0],
            });
          } else if (isApiError(err)) {
            setErrors({ form: err.message || tc(`errors.${err.code}`) });
          } else {
            setErrors({ form: tc("errors.server_error") });
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent size="md" closeLabel={tc("common.close")}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader title={t("add_title")} description={t("add_body")} />
          <DialogBody className="space-y-4 overflow-y-auto">
            <Field id="staff-phone" label={t("phone")} error={errors.phone}>
              <PhoneInput value={phone} onChange={setPhone} required />
            </Field>
            <Field id="staff-name" label={t("full_name")} error={errors.full_name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={150} />
            </Field>
            <RoleCheckboxes idPrefix="add-role" value={roles} onChange={setRoles} />
            <FormError message={errors.roles ?? errors.form} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {tc("common.cancel")}
            </Button>
            <Button type="submit" loading={create.isPending}>
              <UserPlus aria-hidden />
              {t("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({
  member,
  onOpenChange,
}: {
  member: StaffMember | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("security.staff");
  const tc = useTranslations();
  const update = useUpdateStaff();
  const { me } = useSession();
  const [roles, setRoles] = React.useState<StaffRole[]>([]);
  const [active, setActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (member) {
      setRoles(member.roles);
      setActive(member.is_active);
      setError(null);
    }
  }, [member]);

  if (!member) return null;
  const self = member.id === me.id;
  const losingSuperadmin = self && member.roles.includes("superadmin") && !roles.includes("superadmin");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: { roles?: StaffRole[]; is_active?: boolean } = {};
    const sorted = (x: StaffRole[]) => [...x].sort().join(",");
    if (sorted(roles) !== sorted(member.roles)) body.roles = roles;
    if (active !== member.is_active) body.is_active = active;
    if (!Object.keys(body).length) {
      onOpenChange(false);
      return;
    }
    update.mutate(
      { id: member.id, ...body },
      {
        onSuccess: () => {
          toast.success(t("updated_toast"));
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err)) setError(err.fieldError("roles") ?? (err.message || tc(`errors.${err.code}`)));
          else setError(tc("errors.server_error"));
        },
      },
    );
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
      <DialogContent size="md" closeLabel={tc("common.close")}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader
            title={t("edit_title", { name: member.full_name || member.phone })}
            description={t("edit_body")}
          />
          <DialogBody className="space-y-4 overflow-y-auto">
            <RoleCheckboxes idPrefix={`edit-role-${member.id}`} value={roles} onChange={setRoles} />
            {!self ? (
              <SwitchField
                id={`staff-active-${member.id}`}
                label={t("active")}
                description={t("active_hint")}
                checked={active}
                onCheckedChange={setActive}
              />
            ) : null}
            {losingSuperadmin ? <FormError message={t("self_superadmin_warning")} /> : null}
            <FormError message={error} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={update.isPending}>
              {tc("common.cancel")}
            </Button>
            <Button type="submit" loading={update.isPending}>
              {tc("common.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
