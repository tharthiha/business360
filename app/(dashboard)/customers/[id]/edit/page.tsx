import EditCustomerClient from "./edit-customer-client";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditCustomerClient id={id} />;
}