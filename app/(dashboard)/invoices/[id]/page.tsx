import InvoiceDetailClient from "./invoice-detail-client";

export const instant = false;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <InvoiceDetailClient id={id} />;
}