import { BookingDetail } from "@/components/bolau/booking-detail";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <BookingDetail id={id} />;
}
