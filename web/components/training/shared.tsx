"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { CourseStatus, EnrollmentStatus } from "@/lib/api/types-training";

export const ENROLLMENT_TONE: Record<EnrollmentStatus, BadgeTone> = {
  applied: "warning",
  enrolled: "brand",
  completed: "success",
  dropped: "neutral",
  rejected: "danger",
};

export const COURSE_TONE: Record<CourseStatus, BadgeTone> = {
  open: "brand",
  closed: "neutral",
  completed: "success",
};

/** Mirrors apps.training.services.ALLOWED. */
export const ENROLLMENT_NEXT: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  applied: ["enrolled", "completed", "rejected", "dropped"],
  enrolled: ["completed", "dropped"],
  completed: [],
  dropped: ["enrolled"],
  rejected: ["enrolled"],
};

export function EnrollmentStatusBadge({
  status,
  label,
}: {
  status: EnrollmentStatus;
  label?: string;
}) {
  const t = useTranslations("training.enrollment_status");
  return (
    <Badge tone={ENROLLMENT_TONE[status] ?? "neutral"} dot>
      {label || t(status)}
    </Badge>
  );
}

export function CourseStatusBadge({ status, label }: { status: CourseStatus; label?: string }) {
  const t = useTranslations("training.course_status");
  return (
    <Badge tone={COURSE_TONE[status] ?? "neutral"} dot>
      {label || t(status)}
    </Badge>
  );
}
