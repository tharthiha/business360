import SupplierBillDetailClient from "./supplier-bill-detail-client";

export const instant = false;

export default async function SupplierBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SupplierBillDetailClient
      id={id}
    />
  );
}