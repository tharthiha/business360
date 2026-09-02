export type Business360Role =
  | "owner"
  | "admin"
  | "accountant"
  | "sales"
  | "inventory"
  | "staff"
  | "viewer";

export const ROLE_LABELS: Record<Business360Role, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
  inventory: "Inventory",
  staff: "Staff",
  viewer: "Viewer",
};

const ROLE_PATHS: Record<Business360Role, string[]> = {
  owner: ["/"],

  admin: [
    "/dashboard",
    "/customers",
    "/products",
    "/quotations",
    "/sales",
    "/invoices",
    "/inventory",
    "/purchase",
    "/suppliers",
    "/supplier-bills",
    "/expenses",
    "/reports",
    "/ai",
    "/settings/company",
    "/settings/business",
    "/settings/documents",
  ],

  accountant: [
    "/dashboard",
    "/customers",
    "/invoices",
    "/supplier-bills",
    "/expenses",
    "/reports",
    "/settings/accounting",
  ],

  sales: [
    "/dashboard",
    "/customers",
    "/products",
    "/quotations",
    "/sales",
    "/invoices",
  ],

  inventory: [
    "/dashboard",
    "/products",
    "/inventory",
    "/purchase",
    "/suppliers",
  ],

  staff: [
    "/dashboard",
    "/customers",
    "/products",
    "/quotations",
    "/sales",
    "/inventory",
  ],

  viewer: [
    "/dashboard",
    "/customers",
    "/products",
    "/quotations",
    "/sales",
    "/invoices",
    "/inventory",
    "/purchase",
    "/suppliers",
    "/supplier-bills",
    "/expenses",
    "/reports",
  ],
};

export function normalizeRole(value?: string | null): Business360Role {
  const role = String(value || "").trim().toLowerCase();

  if (
    role === "owner" ||
    role === "admin" ||
    role === "accountant" ||
    role === "sales" ||
    role === "inventory" ||
    role === "staff" ||
    role === "viewer"
  ) {
    return role;
  }

  return "viewer";
}

export function canAccessPath(
  roleValue: string | null | undefined,
  pathname: string
) {
  const role = normalizeRole(roleValue);

  if (role === "owner") {
    return true;
  }

  const cleanPath = pathname.split("?")[0] || "/";

  return ROLE_PATHS[role].some((allowedPath) => {
    if (allowedPath === "/") return true;

    return (
      cleanPath === allowedPath ||
      cleanPath.startsWith(`${allowedPath}/`)
    );
  });
}

export function isReadOnlyRole(roleValue?: string | null) {
  return normalizeRole(roleValue) === "viewer";
}
