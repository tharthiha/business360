import EditSupplierClient from "./edit-supplier-client";

export const instant = false;

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditSupplierClient id={id} />;
}