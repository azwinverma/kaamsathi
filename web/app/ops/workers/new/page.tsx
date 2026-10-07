"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { WorkerForm } from "@/components/ops/worker-form";
import { useCreateOpsWorker } from "@/lib/api/hooks/ops";

export default function NewOpsWorkerPage() {
  const t = useTranslations("ops.worker_form");
  const tn = useTranslations("nav");
  const router = useRouter();
  const create = useCreateOpsWorker();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("create_title")}
        description={t("create_subtitle")}
        back={{ href: "/ops/workers", label: tn("ops_workers") }}
      />
      <WorkerForm
        submitLabel={t("create_submit")}
        submitting={create.isPending}
        onCancel={() => router.push("/ops/workers")}
        onSubmit={async (body) => {
          const w = await create.mutateAsync(body);
          toast.success(t("created", { name: w.full_name }));
          router.push(`/ops/workers/${w.id}`);
        }}
      />
    </div>
  );
}
