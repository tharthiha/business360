import SalesOrderDetailClient from "./sales-order-detail-client";

export const instant = false;

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SalesOrderDetailClient id={id} />;
}