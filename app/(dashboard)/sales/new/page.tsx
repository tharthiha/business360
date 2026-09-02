import { connection } from "next/server";
import NewSalesOrderClient from "./new-sales-order-client";

export const instant = false;

export default async function NewSalesOrderPage() {
  await connection();

  return <NewSalesOrderClient />;
}