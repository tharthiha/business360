import EditQuotationClient from "./edit-quotation-client";

export const instant = false;

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditQuotationClient id={id} />;
}