import SupplierDetailClient from "./supplier-detail-client";

export const instant = false;

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SupplierDetailClient id={id} />;
}