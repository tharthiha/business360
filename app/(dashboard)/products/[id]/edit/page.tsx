import EditProductClient from "./edit-product-client";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditProductClient id={id} />;
}