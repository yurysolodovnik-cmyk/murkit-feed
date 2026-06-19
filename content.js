import axios from "axios";
import xlsx from "xlsx";
import fs from "fs";

const FEED_URL =
  "https://fiskars-gratis.com.ua/content/export/f21d2ef6d82a517fac09ea84c53cf5c9.xlsx";

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function value(row, patterns) {
  const keys = Object.keys(row);

  for (const pattern of patterns) {
    const foundKey = keys.find((key) =>
      normalize(key).includes(normalize(pattern))
    );

    if (
      foundKey &&
      row[foundKey] !== undefined &&
      row[foundKey] !== null &&
      String(row[foundKey]).trim() !== ""
    ) {
      return row[foundKey];
    }
  }

  return "";
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cdata(text) {
  return `<![CDATA[${String(text ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function toNumber(v) {
  if (v === undefined || v === null || v === "") return 0;
  return Number(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
}

function cleanDescription(html) {
  return String(html || "")
    .replace(/<article[\s\S]*?<\/article>/gi, "")
    .replace(/\sdata-[a-zA-Z0-9_-]+="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitImages(mainPhoto, gallery) {
  const images = [];

  const add = (v) => {
    String(v || "")
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => {
        if (x.startsWith("http") && !images.includes(x)) {
          images.push(x);
        }
      });
  };

  add(mainPhoto);
  add(gallery);

  return images;
}

async function main() {
  console.log("Downloading XLSX feed for content...");

  const response = await axios.get(FEED_URL, {
    responseType: "arraybuffer",
  });

  const workbook = xlsx.read(response.data, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`Rows found: ${rows.length}`);

  if (rows.length > 0) {
    console.log("Columns:", Object.keys(rows[0]).join(" | "));
  }

  const offers = [];

  for (const row of rows) {
    const vendorCode = String(value(row, ["артикул", "vendorcode", "код"])).trim();

    const title = String(
      value(row, [
        "название ua",
        "название",
        "назва ua",
        "назва",
        "name"
      ])
    ).trim();

    const brand = String(value(row, ["бренд", "brand", "vendor"])).trim();

    const barcode = String(
      value(row, ["штрихкод", "barcode", "ean"])
    ).trim();

    const category = String(
      value(row, ["раздел", "розділ", "категория", "category"])
    ).trim();

    const categoryId = String(
      value(row, ["id раздела", "id розділу", "categoryid", "category_id"])
    ).trim();

    const description = cleanDescription(
      value(row, [
        "описание товара ua",
        "описание товара",
        "описание для маркетплейсов",
        "опис",
        "description",
        "короткое описание"
      ])
    );

    const stock = toNumber(
      value(row, ["количество", "кількість", "quantity", "stock"])
    );

    const price = toNumber(
      value(row, ["цена", "ціна", "price"])
    );

    const images = splitImages(
      value(row, ["фото", "image", "picture"]),
      value(row, ["галерея", "gallery", "images"])
    );

    if (!vendorCode || !title || !brand || !category || !description || images.length === 0 || price <= 0) {
      console.log(
        "CONTENT SKIPPED:",
        vendorCode,
        "title=", !!title,
        "brand=", !!brand,
        "category=", !!category,
        "description=", !!description,
        "images=", images.length,
        "price=", price
      );
      continue;
    }

    offers.push(`
    <offer>
      <id>${escapeXml(vendorCode)}</id>
      <code>${escapeXml(vendorCode)}</code>
      <vendor_code>${escapeXml(vendorCode)}</vendor_code>
      <title>${cdata(title)}</title>
      <barcode>${escapeXml(barcode)}</barcode>
      <category>${escapeXml(category)}</category>
      <category_id>${escapeXml(categoryId || category)}</category_id>
      <brand>${escapeXml(brand)}</brand>
      <availability>${stock > 0 ? "true" : "false"}</availability>
      <description>${cdata(description)}</description>
      <image_link>
${images.map((img) => `        <picture>${escapeXml(img)}</picture>`).join("\n")}
      </image_link>
      <tags>
      </tags>
    </offer>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Market>
  <offers>
${offers.join("\n")}
  </offers>
</Market>
`;

  fs.writeFileSync("content.xml", xml, "utf8");

  console.log(`content.xml created. Offers: ${offers.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
