import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Quotation = {
  id: number;
  company_id: number;
  customer_id: number;
  quotation_no: string;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  template_name: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
};

type Company = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  tax_id: string | null;
  logo_path: string | null;
};

type Customer = {
  customer_name: string;
  customer_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
};

type QuotationItem = {
  id: number;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
};

export default async function QuotationPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const quotationId = Number(id);

  if (!Number.isFinite(quotationId)) {
    return <ErrorBox message="Invalid quotation ID." />;
  }

  const supabase = await createClient();

  const {
    data: quotationData,
    error: quotationError,
  } = await supabase
    .from("quotations")
    .select(`
      id,
      company_id,
      customer_id,
      quotation_no,
      quotation_date,
      valid_until,
      status,
      template_name,
      currency,
      subtotal,
      discount_amount,
      tax_amount,
      total_amount,
      notes,
      terms
    `)
    .eq("id", quotationId)
    .maybeSingle();

  if (quotationError || !quotationData) {
    return (
      <ErrorBox
        message={
          quotationError?.message ||
          "Quotation not found."
        }
      />
    );
  }

  const quotation = quotationData as Quotation;

  const {
    data: companyData,
    error: companyError,
  } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      email,
      phone,
      address,
      website,
      tax_id,
      logo_path
    `)
    .eq("id", quotation.company_id)
    .maybeSingle();

  if (companyError) {
    return <ErrorBox message={companyError.message} />;
  }

  const company = companyData as Company | null;

  const {
    data: customerData,
    error: customerError,
  } = await supabase
    .from("customers")
    .select(`
      customer_name,
      customer_code,
      contact_name,
      phone,
      email,
      address,
      tax_id
    `)
    .eq("id", quotation.customer_id)
    .maybeSingle();

  if (customerError) {
    return <ErrorBox message={customerError.message} />;
  }

  const customer = customerData as Customer | null;

  const {
    data: itemData,
    error: itemError,
  } = await supabase
    .from("quotation_items")
    .select(`
      id,
      description,
      qty,
      unit_price,
      discount_percent,
      tax_percent,
      line_total
    `)
    .eq("quotation_id", quotationId)
    .order("sort_order", {
      ascending: true,
    });

  if (itemError) {
    return <ErrorBox message={itemError.message} />;
  }

  const items = (itemData || []) as QuotationItem[];

  let logoUrl = "";

  if (company?.logo_path) {
    const { data: logoData } = await supabase.storage
      .from("company-assets")
      .createSignedUrl(company.logo_path, 3600);

    logoUrl = logoData?.signedUrl || "";
  }

  const template = quotation.template_name || "classic";

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex w-full max-w-[210mm] items-center justify-between px-1 print:hidden">
        <Link
          href={`/quotations/${quotation.id}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Back
        </Link>

        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500">
            {templateLabel(template)}
          </span>

          <span className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
            Press ⌘P to Print / Save PDF
          </span>
        </div>
      </div>

      {template === "modern" ? (
        <ModernTemplate
          quotation={quotation}
          company={company}
          customer={customer}
          items={items}
          logoUrl={logoUrl}
        />
      ) : template === "commercial" ? (
        <CommercialTemplate
          quotation={quotation}
          company={company}
          customer={customer}
          items={items}
          logoUrl={logoUrl}
        />
      ) : (
        <ClassicTemplate
          quotation={quotation}
          company={company}
          customer={customer}
          items={items}
          logoUrl={logoUrl}
        />
      )}
    </div>
  );
}

function ClassicTemplate({
  quotation,
  company,
  customer,
  items,
  logoUrl,
}: {
  quotation: Quotation;
  company: Company | null;
  customer: Customer | null;
  items: QuotationItem[];
  logoUrl: string;
}) {
  return (
    <Document>
      <div className="flex items-start justify-between gap-10 border-b-2 border-gray-900 pb-8">
        <CompanyBlock
          company={company}
          logoUrl={logoUrl}
        />

        <div className="min-w-[220px] pt-1 text-right">
          <div className="text-3xl font-bold tracking-tight text-gray-900">
            QUOTATION
          </div>

          <div className="mt-4 space-y-1.5 text-sm text-gray-600">
            <div>
              <strong>No:</strong> {quotation.quotation_no}
            </div>

            <div>
              <strong>Date:</strong>{" "}
              {formatDate(quotation.quotation_date)}
            </div>

            <div>
              <strong>Valid Until:</strong>{" "}
              {quotation.valid_until
                ? formatDate(quotation.valid_until)
                : "-"}
            </div>
          </div>
        </div>
      </div>

      <CustomerBlock customer={customer} />

      <QuotationTable
        quotation={quotation}
        items={items}
        showDiscountTax
        darkHeader
      />

      <BottomSection quotation={quotation} />

      <SignatureSection />

      <Footer
        company={company}
        quotation={quotation}
      />
    </Document>
  );
}

function ModernTemplate({
  quotation,
  company,
  customer,
  items,
  logoUrl,
}: {
  quotation: Quotation;
  company: Company | null;
  customer: Customer | null;
  items: QuotationItem[];
  logoUrl: string;
}) {
  return (
    <Document>
      <div className="flex items-start justify-between gap-10">
        <div>
          {logoUrl ? (
            <LogoBox logoUrl={logoUrl} wide />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white">
              {company?.name?.charAt(0).toUpperCase() || "B"}
            </div>
          )}

          <div className="mt-5 text-xl font-semibold text-gray-900">
            {company?.name || "Company Name"}
          </div>

          <ContactText>
            {company?.address || ""}
          </ContactText>
        </div>

        <div className="min-w-[220px] pt-1 text-right">
          <div className="text-sm tracking-[0.3em] text-gray-400">
            QUOTE
          </div>

          <div className="mt-4 text-2xl font-semibold text-gray-900">
            {quotation.quotation_no}
          </div>

          <div className="mt-3 text-sm leading-6 text-gray-500">
            {formatDate(quotation.quotation_date)}
            <br />
            Valid until{" "}
            {quotation.valid_until
              ? formatDate(quotation.valid_until)
              : "-"}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <SmallTitle>Quotation For</SmallTitle>

          <div className="mt-3 text-lg font-semibold text-gray-900">
            {customer?.customer_name || "-"}
          </div>

          <ContactText>
            {customer?.address || ""}
            {customer?.contact_name
              ? `\nAttn: ${customer.contact_name}`
              : ""}
            {customer?.phone
              ? `\n${customer.phone}`
              : ""}
            {customer?.email
              ? `\n${customer.email}`
              : ""}
          </ContactText>
        </div>

        <div className="md:text-right">
          <SmallTitle>From</SmallTitle>

          <ContactText>
            {company?.phone || ""}
            {company?.email
              ? `\n${company.email}`
              : ""}
            {company?.website
              ? `\n${company.website}`
              : ""}
            {company?.tax_id
              ? `\nTax ID: ${company.tax_id}`
              : ""}
          </ContactText>
        </div>
      </div>

      <QuotationTable
        quotation={quotation}
        items={items}
      />

      <BottomSection
        quotation={quotation}
        modern
      />

      <SignatureSection />

      <Footer
        company={company}
        quotation={quotation}
      />
    </Document>
  );
}

function CommercialTemplate({
  quotation,
  company,
  customer,
  items,
  logoUrl,
}: {
  quotation: Quotation;
  company: Company | null;
  customer: Customer | null;
  items: QuotationItem[];
  logoUrl: string;
}) {
  return (
    <Document noPadding>
      <div className="bg-gray-900 px-[14mm] py-[14mm] text-white print:bg-gray-900 print:text-white">
        <div className="flex items-start justify-between gap-10">
          <div className="flex min-w-0 items-start gap-5">
            {logoUrl && (
              <div className="mt-0.5 shrink-0">
                <LogoBox logoUrl={logoUrl} />
              </div>
            )}

            <div className="min-w-0 pt-0.5">
              <div className="text-xl font-semibold leading-tight text-white">
                {company?.name || "Company Name"}
              </div>

              <div className="mt-2 max-w-[300px] whitespace-pre-line text-sm leading-5 text-gray-300">
                {company?.address || ""}
                {company?.phone
                  ? `\n${company.phone}`
                  : ""}
                {company?.email
                  ? `\n${company.email}`
                  : ""}
              </div>
            </div>
          </div>

          <div className="min-w-[220px] shrink-0 pt-1 text-right">
            <div className="text-3xl font-bold tracking-tight text-white">
              QUOTATION
            </div>

            <div className="mt-4 text-sm leading-6 text-gray-300">
              {quotation.quotation_no}
              <br />
              {formatDate(quotation.quotation_date)}
            </div>
          </div>
        </div>
      </div>

      <div className="px-[14mm] py-[13mm]">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-5">
            <SmallTitle>Customer</SmallTitle>

            <div className="mt-3 text-lg font-semibold text-gray-900">
              {customer?.customer_name || "-"}
            </div>

            <ContactText>
              {customer?.address || ""}
              {customer?.contact_name
                ? `\nAttn: ${customer.contact_name}`
                : ""}
              {customer?.phone
                ? `\n${customer.phone}`
                : ""}
              {customer?.email
                ? `\n${customer.email}`
                : ""}
            </ContactText>
          </div>

          <div className="rounded-xl bg-gray-50 p-5">
            <SmallTitle>Quote Details</SmallTitle>

            <div className="mt-4 space-y-3">
              <InfoRow
                label="Quote No."
                value={quotation.quotation_no}
              />

              <InfoRow
                label="Date"
                value={formatDate(
                  quotation.quotation_date
                )}
              />

              <InfoRow
                label="Valid Until"
                value={
                  quotation.valid_until
                    ? formatDate(
                        quotation.valid_until
                      )
                    : "-"
                }
              />

              <InfoRow
                label="Currency"
                value={quotation.currency}
              />
            </div>
          </div>
        </div>

        <QuotationTable
          quotation={quotation}
          items={items}
          boxed
        />

        <BottomSection
          quotation={quotation}
        />

        <SignatureSection />

        <Footer
          company={company}
          quotation={quotation}
        />
      </div>
    </Document>
  );
}

function QuotationTable({
  quotation,
  items,
  showDiscountTax = false,
  darkHeader = false,
  boxed = false,
}: {
  quotation: Quotation;
  items: QuotationItem[];
  showDiscountTax?: boolean;
  darkHeader?: boolean;
  boxed?: boolean;
}) {
  return (
    <div
      className={`mt-9 overflow-hidden ${
        boxed
          ? "rounded-xl border border-gray-200"
          : "border border-gray-300"
      }`}
    >
      <table className="w-full border-collapse">
        <thead
          className={
            darkHeader
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700"
          }
        >
          <tr>
            <Header>Description</Header>
            <Header right>Qty</Header>
            <Header right>Unit Price</Header>

            {showDiscountTax && (
              <>
                <Header right>
                  Discount
                </Header>

                <Header right>
                  Tax
                </Header>
              </>
            )}

            <Header right>Total</Header>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-t border-gray-200 [break-inside:avoid]"
            >
              <Cell>{item.description}</Cell>

              <Cell right>
                {formatQty(item.qty)}
              </Cell>

              <Cell right>
                {money(
                  item.unit_price,
                  quotation.currency
                )}
              </Cell>

              {showDiscountTax && (
                <>
                  <Cell right>
                    {formatPercent(
                      item.discount_percent
                    )}
                  </Cell>

                  <Cell right>
                    {formatPercent(
                      item.tax_percent
                    )}
                  </Cell>
                </>
              )}

              <Cell right strong>
                {money(
                  item.line_total,
                  quotation.currency
                )}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BottomSection({
  quotation,
  modern = false,
}: {
  quotation: Quotation;
  modern?: boolean;
}) {
  return (
    <div className="mt-12 grid gap-10 md:grid-cols-2 [break-inside:avoid]">
      <div>
        {quotation.notes && (
          <div>
            <SmallTitle>Notes</SmallTitle>

            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
              {quotation.notes}
            </p>
          </div>
        )}

        {quotation.terms && (
          <div className="mt-7">
            <SmallTitle>
              Terms & Conditions
            </SmallTitle>

            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
              {quotation.terms}
            </p>
          </div>
        )}
      </div>

      <div
        className={`ml-auto w-full max-w-xs ${
          modern
            ? "rounded-xl bg-gray-900 p-6"
            : ""
        }`}
      >
        <TotalRow
          label="Subtotal"
          value={money(
            quotation.subtotal,
            quotation.currency
          )}
          inverted={modern}
        />

        <TotalRow
          label="Discount"
          value={`-${money(
            quotation.discount_amount,
            quotation.currency
          )}`}
          inverted={modern}
        />

        <TotalRow
          label="Tax"
          value={money(
            quotation.tax_amount,
            quotation.currency
          )}
          inverted={modern}
        />

        <div
          className={`mt-5 border-t pt-5 ${
            modern
              ? "border-white/20"
              : "border-gray-900"
          }`}
        >
          <div className="flex items-center justify-between gap-5">
            <span
              className={`font-semibold ${
                modern
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              Grand Total
            </span>

            <span
              className={`text-xl font-bold ${
                modern
                  ? "text-white"
                  : "text-gray-900"
              }`}
            >
              {money(
                quotation.total_amount,
                quotation.currency
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureSection() {
  return (
    <div className="mt-20 grid gap-10 border-t border-gray-200 pt-12 md:grid-cols-3 [break-inside:avoid]">
      <SignatureBox title="Prepared By" />
      <SignatureBox title="Authorized By" />
      <SignatureBox title="Customer Acceptance" />
    </div>
  );
}

function SignatureBox({
  title,
}: {
  title: string;
}) {
  return (
    <div className="text-center">
      <div className="h-16" />

      <div className="border-t border-gray-400 pt-2 text-sm font-medium text-gray-700">
        {title}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        Signature / Date
      </div>
    </div>
  );
}

function Footer({
  company,
  quotation,
}: {
  company: Company | null;
  quotation: Quotation;
}) {
  return (
    <div className="mt-16 border-t border-gray-200 pt-6 text-center text-xs leading-5 text-gray-400 [break-inside:avoid]">
      <div>
        {company?.name || "Company"}
        {company?.phone
          ? ` • ${company.phone}`
          : ""}
        {company?.email
          ? ` • ${company.email}`
          : ""}
      </div>

      <div className="mt-1">
        Quotation {quotation.quotation_no}
        {" • "}
        Thank you for your business.
      </div>
    </div>
  );
}

function Document({
  children,
  noPadding = false,
}: {
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <main
      className={`mx-auto w-[210mm] min-h-[297mm] overflow-hidden bg-white shadow-sm print:min-h-[297mm] print:w-[210mm] print:shadow-none ${
        noPadding
          ? ""
          : "px-[16mm] py-[14mm]"
      }`}
    >
      {children}
    </main>
  );
}

function LogoBox({
  logoUrl,
  wide = false,
}: {
  logoUrl: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white ${
        wide
          ? "h-16 w-40 p-2"
          : "h-16 w-16 p-1.5"
      }`}
    >
      <img
        src={logoUrl}
        alt="Company logo"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function CompanyBlock({
  company,
  logoUrl,
}: {
  company: Company | null;
  logoUrl: string;
}) {
  return (
    <div className="flex items-start gap-5">
      {logoUrl && (
        <LogoBox logoUrl={logoUrl} />
      )}

      <div className="min-w-0 pt-0.5">
        <div className="text-xl font-semibold text-gray-900">
          {company?.name || "Company Name"}
        </div>

        <ContactText>
          {company?.address || ""}
          {company?.phone
            ? `\n${company.phone}`
            : ""}
          {company?.email
            ? `\n${company.email}`
            : ""}
          {company?.website
            ? `\n${company.website}`
            : ""}
          {company?.tax_id
            ? `\nTax ID: ${company.tax_id}`
            : ""}
        </ContactText>
      </div>
    </div>
  );
}

function CustomerBlock({
  customer,
}: {
  customer: Customer | null;
}) {
  return (
    <div className="mt-9">
      <SmallTitle>Quotation To</SmallTitle>

      <div className="mt-3 text-lg font-semibold text-gray-900">
        {customer?.customer_name || "-"}
      </div>

      <ContactText>
        {customer?.address || ""}
        {customer?.contact_name
          ? `\nAttn: ${customer.contact_name}`
          : ""}
        {customer?.phone
          ? `\n${customer.phone}`
          : ""}
        {customer?.email
          ? `\n${customer.email}`
          : ""}
        {customer?.tax_id
          ? `\nTax ID: ${customer.tax_id}`
          : ""}
      </ContactText>
    </div>
  );
}

function SmallTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </div>
  );
}

function ContactText({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">
      {children}
    </div>
  );
}

function Header({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
  right = false,
  strong = false,
}: {
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 text-sm ${
        right ? "text-right" : "text-left"
      } ${
        strong
          ? "font-semibold text-gray-900"
          : "text-gray-600"
      }`}
    >
      {children}
    </td>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: string;
  inverted?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-5">
      <span
        className={
          inverted
            ? "text-sm text-gray-300"
            : "text-sm text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          inverted
            ? "font-medium text-white"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {message}
      </div>
    </div>
  );
}

function money(
  value: number,
  currency: string
) {
  return `${currencySymbol(
    currency
  )}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(currency: string) {
  if (currency === "MMK") return "K ";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "SGD") return "S$";

  return "฿";
}

function formatDate(value: string) {
  const parts = value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function templateLabel(value: string) {
  if (value === "modern") {
    return "Modern Minimal";
  }

  if (value === "commercial") {
    return "Retail / Commercial";
  }

  return "Classic Corporate";
}