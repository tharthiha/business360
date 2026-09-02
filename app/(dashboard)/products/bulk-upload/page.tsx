"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as XLSX from "xlsx";

type RawRow = {
  product_code?: unknown;
  product_name?: unknown;
  sku?: unknown;
  barcode?: unknown;
  cost_price?: unknown;
  selling_price?: unknown;
  opening_stock?: unknown;
  min_stock?: unknown;
  active?: unknown;
};

type PreviewRow = {
  rowNumber: number;
  product_code: string;
  product_name: string;
  sku: string;
  barcode: string;
  cost_price: number;
  selling_price: number;
  opening_stock: number;
  min_stock: number;
  is_active: boolean;
  valid: boolean;
  errors: string[];
  imageCount: number;
};

type SelectedPhoto = {
  file: File;
  preview: string;
  productCode: string;
  imageNumber: number;
};

export default function BulkProductUploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);

  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // =========================================================
  // DOWNLOAD TEMPLATE
  // =========================================================

  function downloadTemplate() {
    const productRows = [
      {
        product_code: "P1001",
        product_name: "Mouse",
        sku: "MOUSE-01",
        barcode: "8851001",
        cost_price: 150,
        selling_price: 250,
        opening_stock: 30,
        min_stock: 5,
        active: "TRUE",
      },
      {
        product_code: "P1002",
        product_name: "Keyboard",
        sku: "KEY-01",
        barcode: "8851002",
        cost_price: 300,
        selling_price: 500,
        opening_stock: 20,
        min_stock: 3,
        active: "TRUE",
      },
    ];

    const photoGuideRows = [
      {
        product_code: "P1001",
        product_name: "Mouse",
        photo_file: "P1001_1.jpg",
        result: "Primary Photo",
      },
      {
        product_code: "P1001",
        product_name: "Mouse",
        photo_file: "P1001_2.jpg",
        result: "Additional Photo",
      },
      {
        product_code: "P1001",
        product_name: "Mouse",
        photo_file: "P1001_3.jpg",
        result: "Additional Photo",
      },
      {
        product_code: "P1002",
        product_name: "Keyboard",
        photo_file: "P1002_1.jpg",
        result: "Primary Photo",
      },
      {
        product_code: "P1002",
        product_name: "Keyboard",
        photo_file: "P1002_2.jpg",
        result: "Additional Photo",
      },
    ];

    const instructionRows = [
      {
        Item: "Product Name",
        Rule: "Required",
        Example: "Mouse",
      },
      {
        Item: "Product Code",
        Rule: "Recommended and required for photo matching",
        Example: "P1001",
      },
      {
        Item: "Photo Match",
        Rule: "Photo filename must start with exact product_code",
        Example: "P1001_1.jpg",
      },
      {
        Item: "Primary Photo",
        Rule: "_1 becomes primary image",
        Example: "P1001_1.jpg",
      },
      {
        Item: "Additional Photos",
        Rule: "Use _2, _3, _4 and so on",
        Example: "P1001_2.jpg",
      },
      {
        Item: "Photo Formats",
        Rule: "JPG, PNG, WEBP",
        Example: "P1001_1.webp",
      },
      {
        Item: "Photo Size",
        Rule: "Maximum 5 MB per image",
        Example: "Under 5 MB",
      },
      {
        Item: "Active",
        Rule: "TRUE or FALSE. Blank defaults to TRUE",
        Example: "TRUE",
      },
    ];

    const workbook = XLSX.utils.book_new();

    const productSheet =
      XLSX.utils.json_to_sheet(productRows);

    const photoGuideSheet =
      XLSX.utils.json_to_sheet(photoGuideRows);

    const instructionSheet =
      XLSX.utils.json_to_sheet(instructionRows);

    productSheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
    ];

    photoGuideSheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 24 },
      { wch: 22 },
    ];

    instructionSheet["!cols"] = [
      { wch: 22 },
      { wch: 60 },
      { wch: 28 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      productSheet,
      "Products"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      photoGuideSheet,
      "Photo Guide"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      instructionSheet,
      "Instructions"
    );

    XLSX.writeFile(
      workbook,
      "Business360_Product_Bulk_Upload_Template.xlsx"
    );
  }

  // =========================================================
  // HELPERS
  // =========================================================

  function cleanString(value: unknown) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function cleanNumber(value: unknown) {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return 0;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : NaN;
  }

  function cleanBoolean(value: unknown) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return true;
    }

    const text = String(value)
      .trim()
      .toLowerCase();

    if (
      ["false", "0", "no", "n", "inactive"].includes(text)
    ) {
      return false;
    }

    return true;
  }

  function parsePhotoFileName(fileName: string) {
    const lastDot = fileName.lastIndexOf(".");

    if (lastDot <= 0) {
      return null;
    }

    const baseName = fileName.substring(0, lastDot);

    const lastUnderscore =
      baseName.lastIndexOf("_");

    if (lastUnderscore <= 0) {
      return null;
    }

    const productCode =
      baseName
        .substring(0, lastUnderscore)
        .trim();

    const imageNumberText =
      baseName
        .substring(lastUnderscore + 1)
        .trim();

    const imageNumber =
      Number(imageNumberText);

    if (
      !productCode ||
      !Number.isInteger(imageNumber) ||
      imageNumber <= 0
    ) {
      return null;
    }

    return {
      productCode,
      imageNumber,
    };
  }

  // =========================================================
  // EXCEL UPLOAD
  // =========================================================

  async function handleExcelFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    setLoadingFile(true);
    setMessage("");
    setSuccessMessage("");
    setRows([]);

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase();

      if (
        extension !== "xlsx" &&
        extension !== "xls"
      ) {
        setMessage(
          "Please upload an Excel .xlsx or .xls file."
        );

        return;
      }

      setFileName(file.name);

      const arrayBuffer =
        await file.arrayBuffer();

      const workbook = XLSX.read(
        arrayBuffer,
        {
          type: "array",
        }
      );

      const sheetName =
        workbook.SheetNames.includes("Products")
          ? "Products"
          : workbook.SheetNames[0];

      if (!sheetName) {
        setMessage(
          "No worksheet found in this Excel file."
        );

        return;
      }

      const sheet =
        workbook.Sheets[sheetName];

      const rawRows =
        XLSX.utils.sheet_to_json<RawRow>(
          sheet,
          {
            defval: "",
          }
        );

      if (rawRows.length === 0) {
        setMessage(
          "No product rows found in this Excel file."
        );

        return;
      }

      const productCodeCount =
        new Map<string, number>();

      const skuCount =
        new Map<string, number>();

      const barcodeCount =
        new Map<string, number>();

      rawRows.forEach((row) => {
        const code =
          cleanString(
            row.product_code
          ).toLowerCase();

        const sku =
          cleanString(
            row.sku
          ).toLowerCase();

        const barcode =
          cleanString(
            row.barcode
          ).toLowerCase();

        if (code) {
          productCodeCount.set(
            code,
            (productCodeCount.get(code) || 0) + 1
          );
        }

        if (sku) {
          skuCount.set(
            sku,
            (skuCount.get(sku) || 0) + 1
          );
        }

        if (barcode) {
          barcodeCount.set(
            barcode,
            (barcodeCount.get(barcode) || 0) + 1
          );
        }
      });

      const previewRows =
        rawRows.map(
          (
            row,
            index
          ): PreviewRow => {
            const errors: string[] = [];

            const product_code =
              cleanString(row.product_code);

            const product_name =
              cleanString(row.product_name);

            const sku =
              cleanString(row.sku);

            const barcode =
              cleanString(row.barcode);

            const cost_price =
              cleanNumber(row.cost_price);

            const selling_price =
              cleanNumber(row.selling_price);

            const opening_stock =
              cleanNumber(row.opening_stock);

            const min_stock =
              cleanNumber(row.min_stock);

            const is_active =
              cleanBoolean(row.active);

            if (!product_name) {
              errors.push(
                "Product Name is required"
              );
            }

            if (Number.isNaN(cost_price)) {
              errors.push(
                "Invalid Cost Price"
              );
            }

            if (
              Number.isNaN(selling_price)
            ) {
              errors.push(
                "Invalid Selling Price"
              );
            }

            if (
              Number.isNaN(opening_stock)
            ) {
              errors.push(
                "Invalid Opening Stock"
              );
            }

            if (Number.isNaN(min_stock)) {
              errors.push(
                "Invalid Minimum Stock"
              );
            }

            if (
              !Number.isNaN(cost_price) &&
              cost_price < 0
            ) {
              errors.push(
                "Cost Price cannot be negative"
              );
            }

            if (
              !Number.isNaN(selling_price) &&
              selling_price < 0
            ) {
              errors.push(
                "Selling Price cannot be negative"
              );
            }

            if (
              !Number.isNaN(opening_stock) &&
              opening_stock < 0
            ) {
              errors.push(
                "Opening Stock cannot be negative"
              );
            }

            if (
              !Number.isNaN(min_stock) &&
              min_stock < 0
            ) {
              errors.push(
                "Minimum Stock cannot be negative"
              );
            }

            if (
              product_code &&
              (productCodeCount.get(
                product_code.toLowerCase()
              ) || 0) > 1
            ) {
              errors.push(
                "Duplicate Product Code in Excel"
              );
            }

            if (
              sku &&
              (skuCount.get(
                sku.toLowerCase()
              ) || 0) > 1
            ) {
              errors.push(
                "Duplicate SKU in Excel"
              );
            }

            if (
              barcode &&
              (barcodeCount.get(
                barcode.toLowerCase()
              ) || 0) > 1
            ) {
              errors.push(
                "Duplicate Barcode in Excel"
              );
            }

            const imageCount =
              photos.filter(
                (photo) =>
                  photo.productCode.toLowerCase() ===
                  product_code.toLowerCase()
              ).length;

            return {
              rowNumber: index + 2,
              product_code,
              product_name,
              sku,
              barcode,

              cost_price:
                Number.isNaN(cost_price)
                  ? 0
                  : cost_price,

              selling_price:
                Number.isNaN(selling_price)
                  ? 0
                  : selling_price,

              opening_stock:
                Number.isNaN(opening_stock)
                  ? 0
                  : opening_stock,

              min_stock:
                Number.isNaN(min_stock)
                  ? 0
                  : min_stock,

              is_active,
              valid: errors.length === 0,
              errors,
              imageCount,
            };
          }
        );

      setRows(previewRows);
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not read this Excel file."
      );
    } finally {
      setLoadingFile(false);
      e.target.value = "";
    }
  }

  // =========================================================
  // PHOTOS
  // =========================================================

  function handlePhotos(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        e.target.files || []
      );

    if (files.length === 0) {
      return;
    }

    setMessage("");
    setSuccessMessage("");

    const accepted: SelectedPhoto[] = [];
    const invalid: string[] = [];

    for (const file of files) {
      const validType =
        [
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(file.type);

      const validSize =
        file.size <=
        5 * 1024 * 1024;

      const parsed =
        parsePhotoFileName(
          file.name
        );

      if (!validType) {
        invalid.push(
          `${file.name}: unsupported file type`
        );
        continue;
      }

      if (!validSize) {
        invalid.push(
          `${file.name}: file is larger than 5 MB`
        );
        continue;
      }

      if (!parsed) {
        invalid.push(
          `${file.name}: use PRODUCTCODE_1.jpg format`
        );
        continue;
      }

      accepted.push({
        file,
        preview:
          URL.createObjectURL(file),
        productCode:
          parsed.productCode,
        imageNumber:
          parsed.imageNumber,
      });
    }

    setPhotos((current) => {
      const combined = [
        ...current,
        ...accepted,
      ];

      return combined.sort(
        (a, b) => {
          const codeCompare =
            a.productCode.localeCompare(
              b.productCode
            );

          if (codeCompare !== 0) {
            return codeCompare;
          }

          return (
            a.imageNumber -
            b.imageNumber
          );
        }
      );
    });

    if (invalid.length > 0) {
      setMessage(
        invalid.join(" | ")
      );
    }

    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const photo =
        current[index];

      if (photo?.preview) {
        URL.revokeObjectURL(
          photo.preview
        );
      }

      return current.filter(
        (_, i) => i !== index
      );
    });
  }

  // =========================================================
  // COUNTS / MATCHING
  // =========================================================

  const rowsWithImageCounts =
    useMemo(() => {
      return rows.map((row) => {
        const imageCount =
          photos.filter(
            (photo) =>
              photo.productCode.toLowerCase() ===
              row.product_code.toLowerCase()
          ).length;

        return {
          ...row,
          imageCount,
        };
      });
    }, [rows, photos]);

  const unmatchedPhotos =
    useMemo(() => {
      const productCodes =
        new Set(
          rows
            .map((row) =>
              row.product_code.toLowerCase()
            )
            .filter(Boolean)
        );

      return photos.filter(
        (photo) =>
          !productCodes.has(
            photo.productCode.toLowerCase()
          )
      );
    }, [rows, photos]);

  // =========================================================
  // IMPORT
  // =========================================================

  async function importProducts() {
    setImporting(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const validRows =
        rowsWithImageCounts.filter(
          (row) => row.valid
        );

      if (validRows.length === 0) {
        setMessage(
          "There are no valid rows to import."
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        setMessage(
          "Please login first."
        );
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        setMessage(
          "Company profile not found."
        );
        return;
      }

      const companyId =
        profile.company_id;

      const {
        data: existingProducts,
        error: existingError,
      } = await supabase
        .from("products")
        .select(
          "product_code, sku, barcode"
        );

      if (existingError) {
        setMessage(
          existingError.message
        );
        return;
      }

      const existingCodes =
        new Set(
          (existingProducts || [])
            .map((p) =>
              cleanString(
                p.product_code
              ).toLowerCase()
            )
            .filter(Boolean)
        );

      const existingSkus =
        new Set(
          (existingProducts || [])
            .map((p) =>
              cleanString(
                p.sku
              ).toLowerCase()
            )
            .filter(Boolean)
        );

      const existingBarcodes =
        new Set(
          (existingProducts || [])
            .map((p) =>
              cleanString(
                p.barcode
              ).toLowerCase()
            )
            .filter(Boolean)
        );

      const updatedRows =
        rowsWithImageCounts.map(
          (row) => {
            if (!row.valid) {
              return row;
            }

            const errors = [
              ...row.errors,
            ];

            if (
              row.product_code &&
              existingCodes.has(
                row.product_code.toLowerCase()
              )
            ) {
              errors.push(
                "Product Code already exists"
              );
            }

            if (
              row.sku &&
              existingSkus.has(
                row.sku.toLowerCase()
              )
            ) {
              errors.push(
                "SKU already exists"
              );
            }

            if (
              row.barcode &&
              existingBarcodes.has(
                row.barcode.toLowerCase()
              )
            ) {
              errors.push(
                "Barcode already exists"
              );
            }

            return {
              ...row,
              errors,
              valid:
                errors.length === 0,
            };
          }
        );

      setRows(updatedRows);

      const finalValidRows =
        updatedRows.filter(
          (row) => row.valid
        );

      if (
        finalValidRows.length === 0
      ) {
        setMessage(
          "No rows can be imported. Please review validation errors."
        );
        return;
      }

      let importedProducts = 0;
      let uploadedPhotos = 0;

      for (const row of finalValidRows) {
        const {
          data: product,
          error: productError,
        } = await supabase
          .from("products")
          .insert({
            company_id:
              companyId,

            product_code:
              row.product_code ||
              null,

            product_name:
              row.product_name,

            sku:
              row.sku ||
              null,

            barcode:
              row.barcode ||
              null,

            cost_price:
              row.cost_price,

            selling_price:
              row.selling_price,

            current_stock:
              row.opening_stock,

            min_stock:
              row.min_stock,

            is_active:
              row.is_active,
          })
          .select("id")
          .single();

        if (
          productError ||
          !product
        ) {
          setMessage(
            `Could not create ${row.product_name}: ${
              productError?.message ||
              "Unknown error"
            }`
          );
          return;
        }

        importedProducts++;

        if (!row.product_code) {
          continue;
        }

        const productPhotos =
          photos
            .filter(
              (photo) =>
                photo.productCode.toLowerCase() ===
                row.product_code.toLowerCase()
            )
            .sort(
              (a, b) =>
                a.imageNumber -
                b.imageNumber
            );

        for (
          let index = 0;
          index < productPhotos.length;
          index++
        ) {
          const photo =
            productPhotos[index];

          const extension =
            photo.file.name
              .split(".")
              .pop()
              ?.toLowerCase() ||
            "jpg";

          const storageName =
            `${Date.now()}-${crypto.randomUUID()}.${extension}`;

          const path =
            `company-${companyId}/` +
            `product-${product.id}/` +
            storageName;

          const {
            error: uploadError,
          } =
            await supabase.storage
              .from(
                "product-images"
              )
              .upload(
                path,
                photo.file,
                {
                  cacheControl:
                    "3600",
                  upsert: false,
                }
              );

          if (uploadError) {
            console.error(
              "Photo upload error:",
              photo.file.name,
              uploadError
            );
            continue;
          }

          const {
            error: imageDbError,
          } = await supabase
            .from(
              "product_images"
            )
            .insert({
              product_id:
                product.id,

              image_path:
                path,

              is_primary:
                photo.imageNumber === 1 ||
                index === 0,

              sort_order:
                photo.imageNumber,
            });

          if (imageDbError) {
            console.error(
              "Image DB error:",
              imageDbError
            );
            continue;
          }

          uploadedPhotos++;
        }
      }

      setSuccessMessage(
        `${importedProducts} product${
          importedProducts === 1
            ? ""
            : "s"
        } imported successfully with ${uploadedPhotos} photo${
          uploadedPhotos === 1
            ? ""
            : "s"
        }.`
      );

      setRows([]);
      setPhotos([]);
      setFileName("");
    } catch (error) {
      console.error(error);

      setMessage(
        "Unexpected error while importing products."
      );
    } finally {
      setImporting(false);
    }
  }

  const totalRows =
    rowsWithImageCounts.length;

  const validRows =
    rowsWithImageCounts.filter(
      (row) => row.valid
    ).length;

  const errorRows =
    totalRows - validRows;

  const matchedPhotoCount =
    photos.length -
    unmatchedPhotos.length;

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Bulk Product Upload
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Import products and multiple product photos in one operation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download Template
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/products"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Products
          </button>
        </div>
      </div>

      {/* HOW IT WORKS */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            How it works
          </h2>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-3">
          <StepCard
            number="1"
            title="Prepare Excel"
            description="Download the template and enter product information."
          />

          <StepCard
            number="2"
            title="Prepare Photos"
            description="Name photos using the product code, for example P1001_1.jpg."
          />

          <StepCard
            number="3"
            title="Upload & Import"
            description="Upload Excel and photos, review matches, then import."
          />
        </div>
      </div>

      {/* PHOTO NAMING GUIDE */}

      <div className="rounded-xl border border-blue-200 bg-blue-50/50 shadow-sm">
        <div className="border-b border-blue-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Photo Naming Guide
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Photo filenames must match the Product Code in your Excel file.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">
                Example 1
              </div>

              <div className="mt-4 space-y-3">
                <GuideRow
                  label="Excel Product Code"
                  value="P1001"
                />

                <GuideRow
                  label="Product Name"
                  value="Mouse"
                />

                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Photo Files
                  </div>

                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <code className="rounded bg-gray-100 px-2 py-1 text-gray-800">
                        P1001_1.jpg
                      </code>

                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        Primary
                      </span>
                    </div>

                    <div>
                      <code className="rounded bg-gray-100 px-2 py-1 text-gray-800">
                        P1001_2.jpg
                      </code>
                    </div>

                    <div>
                      <code className="rounded bg-gray-100 px-2 py-1 text-gray-800">
                        P1001_3.jpg
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">
                Matching Rules
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <Rule>
                  Product code before the final underscore must match Excel exactly.
                </Rule>

                <Rule>
                  <code>P1001_1.jpg</code> becomes the primary image.
                </Rule>

                <Rule>
                  Use <code>_2</code>, <code>_3</code>, <code>_4</code> for additional images.
                </Rule>

                <Rule>
                  Supported formats: JPG, PNG and WEBP.
                </Rule>

                <Rule>
                  Maximum image size: 5 MB per file.
                </Rule>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm text-gray-700">
            <span className="font-semibold">
              Match example:
            </span>{" "}
            Excel code{" "}
            <code className="font-semibold">
              P1001
            </code>{" "}
            → photo{" "}
            <code className="font-semibold">
              P1001_1.jpg
            </code>
          </div>
        </div>
      </div>

      {/* UPLOAD */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Excel */}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">
            1. Product Excel
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Upload the completed Business360 Excel template.
          </p>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center hover:bg-gray-100">
            <div className="text-2xl">
              ↑
            </div>

            <div className="mt-3 text-sm font-medium text-gray-900">
              {loadingFile
                ? "Reading Excel..."
                : "Choose Excel File"}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              .xlsx or .xls
            </div>

            {fileName && (
              <div className="mt-3 max-w-full truncate rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                {fileName}
              </div>
            )}

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={
                handleExcelFile
              }
              disabled={
                loadingFile ||
                importing
              }
              className="hidden"
            />
          </label>
        </div>

        {/* Photos */}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">
            2. Product Photos
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select multiple JPG, PNG or WEBP images.
          </p>

          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center hover:bg-gray-100">
            <div className="text-2xl">
              +
            </div>

            <div className="mt-3 text-sm font-medium text-gray-900">
              Choose Product Photos
            </div>

            <div className="mt-1 text-xs text-gray-500">
              Example: P1001_1.jpg, P1001_2.jpg
            </div>

            <div className="mt-1 text-xs text-gray-400">
              _1 = Primary • Max 5 MB each
            </div>

            {photos.length > 0 && (
              <div className="mt-3 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                {photos.length} photo
                {photos.length === 1
                  ? ""
                  : "s"}{" "}
                selected
              </div>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={
                handlePhotos
              }
              disabled={
                importing
              }
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* MESSAGES */}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* PHOTO PREVIEW */}

      {photos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Selected Photos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {matchedPhotoCount} matched •{" "}
              {unmatchedPhotos.length} unmatched
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {photos.map(
              (
                photo,
                index
              ) => {
                const matched =
                  rows.some(
                    (row) =>
                      row.product_code &&
                      row.product_code.toLowerCase() ===
                        photo.productCode.toLowerCase()
                  );

                return (
                  <div
                    key={`${photo.file.name}-${index}`}
                    className={`overflow-hidden rounded-xl border bg-white ${
                      matched
                        ? "border-gray-200"
                        : "border-red-200"
                    }`}
                  >
                    <div className="relative flex h-28 items-center justify-center bg-gray-50">
                      <img
                        src={
                          photo.preview
                        }
                        alt={
                          photo.file.name
                        }
                        className="max-h-full max-w-full object-contain"
                      />

                      {photo.imageNumber === 1 && (
                        <span className="absolute left-2 top-2 rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-medium text-white">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="p-2">
                      <div className="truncate text-xs font-medium text-gray-900">
                        {photo.file.name}
                      </div>

                      <div
                        className={`mt-1 text-[11px] ${
                          matched
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {matched
                          ? `Matched: ${photo.productCode}`
                          : `No product: ${photo.productCode}`}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removePhoto(
                            index
                          )
                        }
                        className="mt-2 w-full rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* SUMMARY */}

      {rows.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              label="Total Rows"
              value={String(
                totalRows
              )}
            />

            <SummaryCard
              label="Valid"
              value={String(
                validRows
              )}
              tone="success"
            />

            <SummaryCard
              label="Errors"
              value={String(
                errorRows
              )}
              tone={
                errorRows > 0
                  ? "danger"
                  : "default"
              }
            />

            <SummaryCard
              label="Matched Photos"
              value={String(
                matchedPhotoCount
              )}
            />

            <SummaryCard
              label="Unmatched Photos"
              value={String(
                unmatchedPhotos.length
              )}
              tone={
                unmatchedPhotos.length >
                0
                  ? "danger"
                  : "default"
              }
            />
          </div>

          {/* TABLE */}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Import Preview
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Review products and matched photos before importing.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  importProducts
                }
                disabled={
                  importing ||
                  validRows === 0
                }
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing
                  ? "Importing Products & Photos..."
                  : `Import ${validRows} Product${
                      validRows === 1
                        ? ""
                        : "s"
                    }`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Header>
                      Row
                    </Header>

                    <Header>
                      Status
                    </Header>

                    <Header>
                      Code
                    </Header>

                    <Header>
                      Product
                    </Header>

                    <Header>
                      SKU
                    </Header>

                    <Header align="right">
                      Cost
                    </Header>

                    <Header align="right">
                      Price
                    </Header>

                    <Header align="right">
                      Stock
                    </Header>

                    <Header align="center">
                      Photos
                    </Header>

                    <Header>
                      Errors
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {rowsWithImageCounts.map(
                    (row) => (
                      <tr
                        key={
                          row.rowNumber
                        }
                        className={
                          row.valid
                            ? ""
                            : "bg-red-50/40"
                        }
                      >
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {
                            row.rowNumber
                          }
                        </td>

                        <td className="px-4 py-3">
                          {row.valid ? (
                            <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Valid
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                              Error
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.product_code ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {row.product_name ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.sku ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          ฿
                          {row.cost_price.toFixed(
                            2
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          ฿
                          {row.selling_price.toFixed(
                            2
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {
                            row.opening_stock
                          }
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.imageCount >
                          0 ? (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                              {row.imageCount}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              0
                            </span>
                          )}
                        </td>

                        <td className="min-w-[250px] px-4 py-3 text-xs">
                          {row.errors.length >
                          0 ? (
                            <div className="space-y-1 text-red-600">
                              {row.errors.map(
                                (
                                  error,
                                  index
                                ) => (
                                  <div
                                    key={
                                      index
                                    }
                                  >
                                    •{" "}
                                    {
                                      error
                                    }
                                  </div>
                                )
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-900 text-sm font-medium text-white">
        {number}
      </div>

      <div>
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>

        <div className="mt-1 text-sm leading-5 text-gray-500">
          {description}
        </div>
      </div>
    </div>
  );
}

function GuideRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">
        {label}
      </span>

      <code className="rounded bg-gray-100 px-2 py-1 text-sm font-semibold text-gray-900">
        {value}
      </code>
    </div>
  );
}

function Rule({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-green-600">
        ✓
      </span>

      <div>{children}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?:
    | "default"
    | "success"
    | "danger";
}) {
  const valueStyle =
    tone === "success"
      ? "text-green-700"
      : tone === "danger"
      ? "text-red-700"
      : "text-gray-900";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${valueStyle}`}
      >
        {value}
      </div>
    </div>
  );
}

function Header({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?:
    | "left"
    | "right"
    | "center";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        align === "right"
          ? "text-right"
          : align === "center"
          ? "text-center"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}