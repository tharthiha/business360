import QuotationDetailClient from "./quotation-detail-client";

export const instant = false;

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <QuotationDetailClient id={id} />;
}