// import dotenv from 'dotenv';
import { fetchArticles, writeResultsToExcel } from "./services/excelService.js";
import { automateLoginAndSearch } from "./services/automation.js";

(async function main() {
  try {
    const articles = await fetchArticles();
    const results = await automateLoginAndSearch(articles);
    await writeResultsToExcel(results);
  } catch (error) {
    console.error("Произошла ошибка main.js:", error);
  }
})();
