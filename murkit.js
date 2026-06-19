import axios from "axios";
import { parseStringPromise } from "xml2js";

const FEED_URL =
  "https://fiskars-gratis.com.ua/content/export/1e03430db27aa5834c2f6633af9e2c18.xml";

async function main() {
  console.log("Завантажую фід...");

  const response = await axios.get(FEED_URL);

  console.log("Фід отримано");

  const xml = response.data;

  const parsed = await parseStringPromise(xml);

  console.log("XML успішно прочитаний");

  console.log(
    JSON.stringify(parsed).substring(0, 1000)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
