import ExpenseDetailClient from "./expense-detail-client";

export const instant = false;

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ExpenseDetailClient id={id} />;
}