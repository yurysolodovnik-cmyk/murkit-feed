import axios from "axios";
import xlsx from "xlsx";
import fs from "fs";

const FEED_URL =
  "https://fiskars-gratis.com.ua/content/export/eb49a29eda1ed8152f24322544deb94c.xlsx";

function value(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
      return row[name];
    }
  }
  return "";
}

function toNumber(v) {
  if (v === undefined || v === null || v === "") return 0;
  return Number(String(v).replace(",", ".").replace(/[^\d.]/g, "")) || 0;
}

function toBoolAvailability(v, stock) {
  const text = String(v || "").toLowerCase().trim();

  if (text.includes("в наличии")) return true;
  if (text.includes("є в наявності")) return true;
  if (text.includes("так")) return true;
  if (text === "true") return true;
  if (text === "1") return true;

  if (stock > 0) return true;

  return false;
}

async function main() {
  console.log("Downloading XLSX feed...");

  const response = await axios.get(FEED_URL, {
    responseType: "arraybuffer",
  });

  console.log("XLSX downloaded");

  const workbook = xlsx.read(response.data, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`Rows found: ${rows.length}`);

  const offers = rows
    .map((row) => {
      const code = String(value(row, ["Артикул", "vendorCode", "vendor_code", "Код"])).trim();

      const price = toNumber(value(row, ["Цена", "Ціна", "price"]));
      const oldPrice = toNumber(value(row, ["Старая цена", "Стара ціна", "oldprice", "old_price"]));
      const stock = Math.floor(toNumber(value(row, ["Количество", "Кількість", "quantity_in_stock", "stock"])));

      const availabilityRaw = value(row, ["Наличие", "Наявність", "available", "availability"]);
      const availability = toBoolAvailability(availabilityRaw, stock);

      if (!code || price <= 0) {
    console.log(
      "SKIPPED:",
      code,
      "price:",
      price
    );
    return null;
}

      const item = {
        code,
        price,
        availability,
        stock,
        days_to_dispatch: 0,
        warranty_type: "manufacturer",
        warranty_period: 12
      };

      if (oldPrice > price) {
        item.old_price = oldPrice;
      }

      return item;
    })
    .filter(Boolean);

  const result = {
    updatedAt: new Date().toISOString(),
    data: offers,
  };

  fs.writeFileSync(
    "offers-response.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(`offers-response.json created. Offers: ${offers.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
