"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import {
  useCreateMember,
  useDeleteMember,
  useMembers,
  useSites,
  useUpdateMember,
} from "@/lib/api/hooks/org";
import { listResults } from "@/lib/api/client";
import type { Member, Role, Site } from "@/lib/api/types";
import { handleFormError, toastError, zPhone } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { useSession } from "@/components/providers/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchField } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

const ROLES: Role[] = ["owner", "admin", "hr", "supervisor"];

export function MembersTab() {
  const t = useTranslations();
  const f = useFormat();
  const { me } = useSession();
  const { data, isLoading, error, refetch } = useMembers();
  const sitesQ = useSites();
  const sites = listResults(sitesQ.data);
  const members = listResults(data);
  const del = useDeleteMember();
  const [editing, setEditing] = React.useState<Member | "new" | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-fg-muted">{t("settings.members_intro")}</p>
        <Button onClick={() => setEditing("new")}>
          <UserPlus aria-hidden />
          {t("settings.invite_member")}
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("settings.members_empty")}
          action={
            <Button onClick={() => setEditing("new")}>
              <UserPlus aria-hidden />
              {t("settings.invite_member")}
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>{t("settings.role")}</Th>
                <Th className="max-md:hidden">{t("settings.assigned_sites")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="w-12">
                  <span className="sr-only">{t("common.actions")}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {members.map((m) => {
                const isMe = m.user.id === me.id;
                return (
                  <Tr key={m.id}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={m.user.full_name || m.user.phone} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">
                            {m.user.full_name || "—"}
                            {isMe ? <span className="ml-1.5 text-xs font-normal text-fg-muted">({t("settings.you")})</span> : null}
                          </p>
                          <p className="text-xs text-fg-muted tabular">{f.phone(m.user.phone)}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={m.role === "owner" ? "brand" : m.role === "supervisor" ? "warning" : "neutral"}>
                        {t(`role.${m.role}`)}
                      </Badge>
                    </Td>
                    <Td className="max-md:hidden">
                      {m.role === "supervisor" ? (
                        m.site_ids.length ? (
                          <span className="text-sm">{m.site_ids.map(siteName).join(", ")}</span>
                        ) : (
                          <span className="text-sm text-warning">{t("settings.no_sites_assigned")}</span>
                        )
                      ) : (
                        <span className="text-sm text-fg-muted">{t("settings.all_sites")}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={m.is_active ? "success" : "neutral"} dot>
                        {m.is_active ? t("status.active") : t("settings.inactive")}
                      </Badge>
                    </Td>
                    <Td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={t("common.more_actions")}>
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setEditing(m)}>
                            <Pencil aria-hidden />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem danger disabled={isMe} onSelect={() => setRemoving(m)}>
                            <Trash2 aria-hidden />
                            {t("common.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {editing ? (
        <MemberDialog
          member={editing === "new" ? null : editing}
          sites={sites}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t("settings.remove_member_title")}
        description={t("settings.remove_member_body", { name: removing?.user.full_name || removing?.user.phone || "" })}
        confirmLabel={t("common.remove")}
        danger
        loading={del.isPending}
        onConfirm={() =>
          removing &&
          del.mutate(removing.id, {
            onSuccess: () => {
              toast.success(t("settings.member_removed"));
              setRemoving(null);
            },
            onError: (e) => toastError(e, t),
          })
        }
      />
    </div>
  );
}

function MemberDialog({
  member,
  sites,
  onClose,
}: {
  member: Member | null;
  sites: Site[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const { me } = useSession();
  const create = useCreateMember();
  const update = useUpdateMember();
  const [formError, setFormError] = React.useState<string | null>(null);
  const isEdit = !!member;
  const isMe = member?.user.id === me.id;

  const schema = React.useMemo(
    () =>
      z
        .object({
          phone: isEdit ? z.string() : zPhone(t("errors.invalid_phone")),
          full_name: isEdit ? z.string() : z.string().trim().min(2, t("errors.required")),
          role: z.enum(ROLES as [Role, ...Role[]]),
          site_ids: z.array(z.string()),
          is_active: z.boolean(),
        })
        .refine((v) => v.role !== "supervisor" || v.site_ids.length > 0, {
          path: ["site_ids"],
          message: t("settings.supervisor_needs_site"),
        }),
    [t, isEdit],
  );
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: member?.user.phone ?? "",
      full_name: member?.user.full_name ?? "",
      role: member?.role ?? "supervisor",
      site_ids: member?.site_ids ?? [],
      is_active: member?.is_active ?? true,
    },
  });
  const { control, register, handleSubmit, formState, watch } = form;
  const errors = formState.errors;
  const role = watch("role");
  const pending = create.isPending || update.isPending;

  const onError = (err: unknown) =>
    setFormError(
      handleFormError(err, form.setError, t, {
        fields: ["phone", "full_name", "role", "site_ids", "is_active"],
        toast: false,
      }),
    );

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    const site_ids = v.role === "supervisor" ? v.site_ids : [];
    if (member) {
      update.mutate(
        { id: member.id, role: v.role, site_ids, is_active: v.is_active },
        {
          onSuccess: () => {
            toast.success(t("common.changes_saved"));
            onClose();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { phone: v.phone, full_name: v.full_name, role: v.role, site_ids },
        {
          onSuccess: () => {
            toast.success(t("settings.member_invited"));
            onClose();
          },
          onError,
        },
      );
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t("common.close")}>
        <DialogHeader
          title={isEdit ? t("settings.edit_member") : t("settings.invite_member")}
          description={isEdit ? member.user.full_name || member.user.phone : t("settings.invite_hint")}
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            {!isEdit ? (
              <>
                <Field id="member-phone" label={t("term.phone")} error={errors.phone?.message}>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} name="phone" />}
                  />
                </Field>
                <Field id="member-name" label={t("term.full_name")} error={errors.full_name?.message}>
                  <Input autoComplete="off" {...register("full_name")} />
                </Field>
              </>
            ) : null}
            <Field
              id="member-role"
              label={t("settings.role")}
              hint={t(`settings.role_hint_${role}`)}
              error={errors.role?.message}
            >
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isMe}
                    options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
                  />
                )}
              />
            </Field>
            {role === "supervisor" ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-fg">{t("settings.assigned_sites")}</legend>
                <p className="text-xs text-fg-muted">{t("settings.assigned_sites_hint")}</p>
                {sites.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-fg-muted">
                    {t("settings.no_sites_yet")}
                  </p>
                ) : (
                  <Controller
                    control={control}
                    name="site_ids"
                    render={({ field }) => (
                      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                        {sites.map((s) => {
                          const checked = field.value.includes(s.id);
                          const id = `member-site-${s.id}`;
                          return (
                            <li key={s.id}>
                              <label
                                htmlFor={id}
                                className="flex min-h-10 cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-surface-hover"
                              >
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={(c) =>
                                    field.onChange(
                                      c ? [...field.value, s.id] : field.value.filter((x) => x !== s.id),
                                    )
                                  }
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-fg">{s.name}</span>
                                  {s.address ? (
                                    <span className="block truncate text-xs text-fg-muted">{s.address}</span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  />
                )}
                {errors.site_ids?.message ? (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {errors.site_ids.message}
                  </p>
                ) : null}
              </fieldset>
            ) : null}
            {isEdit && !isMe ? (
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <SwitchField
                    id="member-active"
                    label={t("settings.member_active")}
                    description={t("settings.member_active_hint")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            ) : null}
            <FormError message={formError} />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? t("common.save_changes") : t("settings.send_invite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
