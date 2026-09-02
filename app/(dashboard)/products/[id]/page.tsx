import ProductDetailClient from "./product-detail-client";

export const instant = false;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProductDetailClient id={id} />;
}