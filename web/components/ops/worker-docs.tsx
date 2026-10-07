"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadOpsWorkerDoc } from "@/lib/api/hooks/ops";
import type { OpsWorker, OpsWorkerDocField } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { DocImage } from "./ops-ui";

const DOCS: { field: OpsWorkerDocField; key: "photo" | "id_front" | "id_back"; tall?: boolean }[] = [
  { field: "photo", key: "photo", tall: true },
  { field: "id_front", key: "id_front" },
  { field: "id_back", key: "id_back" },
];

const MAX_BYTES = 8 * 1024 * 1024;

/** ID front / back + photo, viewable; `editable` adds upload/replace buttons. */
export function WorkerDocs({ worker, editable }: { worker: OpsWorker; editable?: boolean }) {
  const t = useTranslations();
  const td = useTranslations("ops.docs");
  const upload = useUploadOpsWorkerDoc();
  const [busy, setBusy] = React.useState<OpsWorkerDocField | null>(null);
  const inputs = React.useRef<Partial<Record<OpsWorkerDocField, HTMLInputElement | null>>>({});

  const onFile = (field: OpsWorkerDocField, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(td("not_image"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(td("too_large", { mb: 8 }));
      return;
    }
    setBusy(field);
    upload.mutate(
      { id: worker.id, field, file },
      {
        onSuccess: () => toast.success(td("uploaded")),
        onError: (e) => toastError(e, t),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {DOCS.map((d) => {
        const src = worker[d.field];
        return (
          <div key={d.field} className="space-y-2">
            <DocImage src={src} label={td(d.key)} tall={d.tall} />
            {editable ? (
              <>
                <input
                  ref={(el) => {
                    inputs.current[d.field] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    onFile(d.field, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  loading={busy === d.field}
                  disabled={!!busy && busy !== d.field}
                  onClick={() => inputs.current[d.field]?.click()}
                >
                  <Upload aria-hidden />
                  {src ? td("replace") : td("upload")}
                </Button>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
