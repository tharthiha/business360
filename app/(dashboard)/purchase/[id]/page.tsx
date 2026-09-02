import PurchaseOrderDetailClient from "./purchase-order-detail-client";

export const instant = false;

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PurchaseOrderDetailClient
      id={id}
    />
  );
}