"use client";
import * as React from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { errorMessage } from "@/components/ui/feedback";
import { downloadFile } from "@/lib/api/client";
import { useImportEmployments } from "@/lib/api/hooks/workforce";
import type { ImportResult } from "@/lib/api/types";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { CountChip } from "./shared";

const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 5 * 1024 * 1024;

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const ti = useTranslations("workforce.import");
  const f = useFormat();
  const upload = useImportEmployments();
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setFileError(null);
      setResult(null);
      upload.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setResult(null);
    setFileError(null);
    if (next && !/\.(csv|xlsx)$/i.test(next.name)) {
      setFile(null);
      setFileError(ti("bad_type"));
      return;
    }
    if (next && next.size > MAX_BYTES) {
      setFile(null);
      setFileError(ti("too_large"));
      return;
    }
    setFile(next);
  };

  const getTemplate = async () => {
    setDownloading(true);
    try {
      await downloadFile("/org/employments/import-template.xlsx", "kaamsathi-workers-template.xlsx");
    } catch (err) {
      toastError(err, t);
    } finally {
      setDownloading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError(ti("choose_file"));
      return;
    }
    upload.mutate(file, {
      onSuccess: (r) => {
        setResult(r);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader title={ti("title")} description={ti("description")} />
          <DialogBody className="space-y-5">
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg">
                  {f.digits(1)}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium text-fg">{ti("step_template")}</p>
                  <p className="text-fg-muted">{ti("columns_hint")}</p>
                  <p className="text-xs text-fg-muted">{ti("date_hint")}</p>
                  <Button variant="secondary" size="sm" onClick={getTemplate} loading={downloading}>
                    <Download aria-hidden />
                    {ti("download_template")}
                  </Button>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-subtle-fg">
                  {f.digits(2)}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <label htmlFor="import-file" className="font-medium text-fg">
                    {ti("step_upload")}
                  </label>
                  <label
                    htmlFor="import-file"
                    className="flex cursor-pointer flex-col items-center gap-2 rounded-dense border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-center hover:border-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
                  >
                    <FileSpreadsheet className="size-6 text-fg-muted" aria-hidden />
                    <span className="text-sm text-fg">{file ? file.name : ti("drop_hint")}</span>
                    <span className="text-xs text-fg-muted">{ti("file_types")}</span>
                    <input
                      ref={inputRef}
                      id="import-file"
                      type="file"
                      accept={ACCEPT}
                      onChange={pick}
                      className="sr-only"
                      aria-describedby={fileError ? "import-file-error" : undefined}
                    />
                  </label>
                  {fileError ? (
                    <p id="import-file-error" role="alert" className="text-xs font-medium text-danger">
                      {fileError}
                    </p>
                  ) : null}
                </div>
              </li>
            </ol>

            {upload.isError ? <FormError message={errorMessage(upload.error, t)} /> : null}

            {result ? (
              <section aria-live="polite" className="space-y-3 rounded-dense border border-border p-4">
                <p className="flex items-center gap-2 font-medium text-fg">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  {ti("done")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <CountChip tone="success" label={ti("created")} value={f.digits(result.created)} />
                  <CountChip tone="brand" label={ti("updated")} value={f.digits(result.updated)} />
                  <CountChip
                    tone={result.errors.length ? "danger" : "neutral"}
                    label={ti("failed")}
                    value={f.digits(result.errors.length)}
                  />
                </div>
                {result.errors.length ? (
                  <div className="space-y-2">
                    <p className="text-sm text-fg-muted">{ti("errors_hint")}</p>
                    <TableContainer maxHeight="240px">
                      <Table>
                        <THead>
                          <Tr>
                            <Th className="w-20">{ti("row")}</Th>
                            <Th>{ti("problem")}</Th>
                          </Tr>
                        </THead>
                        <TBody>
                          {result.errors.map((e, i) => (
                            <Tr key={`${e.row}-${i}`}>
                              <Td className="h-auto py-2 tabular">{f.digits(e.row)}</Td>
                              <Td className="h-auto py-2 text-danger">{e.message}</Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                    </TableContainer>
                  </div>
                ) : null}
              </section>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
              {result ? t("common.close") : t("common.cancel")}
            </Button>
            <Button type="submit" loading={upload.isPending} disabled={!file}>
              <Upload aria-hidden />
              {ti("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
