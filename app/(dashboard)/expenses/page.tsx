import { connection } from "next/server";
import ExpensesClient from "./expenses-client";

export const instant = false;

export default async function ExpensesPage() {
  await connection();

  return <ExpensesClient />;
}