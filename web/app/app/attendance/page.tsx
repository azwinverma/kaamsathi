import { Suspense } from "react";
import { AttendancePage } from "@/components/workforce/attendance-page";

export default function Page() {
  return (
    <Suspense>
      <AttendancePage />
    </Suspense>
  );
}
