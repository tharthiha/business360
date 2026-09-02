import EditExpenseClient from "./edit-expense-client";

export const instant = false;

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <EditExpenseClient id={id} />
  );
}