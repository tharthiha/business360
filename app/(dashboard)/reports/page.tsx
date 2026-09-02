import { connection } from "next/server";
import ReportsClient from "./reports-client";

export const instant = false;

export default async function ReportsPage() {
  await connection();

  return <ReportsClient />;
}