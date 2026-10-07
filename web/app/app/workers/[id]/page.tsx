import { EmploymentDetail } from "@/components/workforce/employment-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmploymentDetail id={id} />;
}
