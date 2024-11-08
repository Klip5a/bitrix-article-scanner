import "dotenv/config.js";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import path from "path";
import fs from "fs";

import { sleep } from "../utils/sleepUtils.mjs";
import { extractImageUrls } from "../utils/seleniumUtils.mjs";
import { downloadImage } from "../utils/httpUtils.mjs";

// Загрузка путей и параметров из .env
const downloadPath = process.env.DOWNLOAD_PATH;
const progressFilePath = "./src/progress.json";

const MAX_RETRIES = 3; // Максимальное количество попыток при сбое
const RETRY_DELAY = 10000; // Задержка между попытками (в миллисекундах)
const SELENIUM_URL = process.env.SELENIUM_URL;
const USERNAME = process.env.USERNAMEADMIN;
const PASSWORD = process.env.PASSWORDADMIN;
const TIMEOUT = 30000; // Время ожидания в миллисекундах для Selenium

// Функция загрузки прогресса выполнения
function loadProgress() {
  if (fs.existsSync(progressFilePath)) {
    const data = fs.readFileSync(progressFilePath, "utf-8");
    return new Set(JSON.parse(data));
  }
  return new Set();
}

// Функция сохранения прогресса выполнения
function saveProgress(processedArticles) {
  fs.writeFileSync(progressFilePath, JSON.stringify(Array.from(processedArticles), null, 2));
}

// Утилита для очистки названия файла от недопустимых символов
function sanitizeFileName(fileName) {
  return fileName.replace(/[\/\\?%*:|"<>]/g, "_");
}

// Основная функция автоматизации: вход в систему и поиск статей
export async function automateLoginAndSearch(articles) {
  let driver;
  let attempt = 0;
  let processedArticles = loadProgress();

  // Формирование уникальных артикулов для обработки
  const articlesToProcess = new Set(articles.map((article) => article.value));
  const uniqueArticles = [...articlesToProcess].filter(
    (article) => !processedArticles.has(article)
  );

  while (attempt < MAX_RETRIES) {
    try {
      // Инициализация Selenium WebDriver
      driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(new chrome.Options())
        .build();

      await driver.get(SELENIUM_URL);
      const currentUrl = await driver.getCurrentUrl();

      // Проверка, требуется ли авторизация
      if (currentUrl.includes("#authorize")) {
        // Вход в систему
        await driver.wait(until.elementLocated(By.name("USER_LOGIN")), TIMEOUT);
        await driver.wait(until.elementLocated(By.name("USER_PASSWORD")), TIMEOUT);
        await driver.wait(until.elementLocated(By.css("input.login-btn-green")), TIMEOUT);

        await sleep(500);
        await driver.findElement(By.name("USER_LOGIN")).sendKeys(USERNAME);
        await sleep(500);
        await driver.findElement(By.name("USER_PASSWORD")).sendKeys(PASSWORD);
        await driver.findElement(By.css("input.login-btn-green")).click();

        await driver.wait(until.titleContains("Основной каталог товаров"), TIMEOUT);
      }

      const results = [];

      // Цикл по всем уникальным артикулам
      for (let article of uniqueArticles) {
        try {
          // Поиск и выбор артикула
          const searchContainer = await driver.wait(
            until.elementLocated(
              By.id("tbl_iblock_list_da446dd48864ca77909741c1a3162b8a_search_container")
            ),
            TIMEOUT
          );
          await searchContainer.click();

          const searchField = await driver.wait(
            until.elementLocated(By.name("PROPERTY_112")),
            TIMEOUT
          );
          await searchField.clear();
          await searchField.sendKeys(article);

          const searchButton = await driver.wait(
            until.elementLocated(
              By.css(
                "button.ui-btn.ui-btn-primary.ui-btn-icon-search.main-ui-filter-field-button.main-ui-filter-find"
              )
            ),
            TIMEOUT
          );
          await searchButton.click();

          await sleep(3000);

          await driver.wait(until.elementsLocated(By.css("tr.main-grid-row")), TIMEOUT);

          const rows = await driver.findElements(By.css("tr.main-grid-row"));
          let found = false;

          for (let row of rows) {
            const cells = await row.findElements(By.css("td.main-grid-cell"));
            if (cells.length > 5) {
              var articleCellText = await cells[5].getText();
            }

            // Проверка совпадения артикулов
            if (articleCellText == article) {
              const details = {
                title: await cells[2].getText(),
                article: await cells[5].getText(),
                detailedPicture: await extractImageUrls(cells[10]),
                declarationDescription: await cells[11].getText(),
                detailedDescription: await cells[12].getText(),
                images: await extractImageUrls(cells[13]),
                photoGallery: await extractImageUrls(cells[14]),
              };

              let color;
              let duplicates = [];

              // Обработка и поиск дубликатов изображений
              const combinedImages = [...details.images, ...details.photoGallery];
              const seenUrls = new Set();
              combinedImages.forEach((imgUrl) => {
                if (seenUrls.has(imgUrl)) {
                  duplicates.push(imgUrl);
                } else {
                  seenUrls.add(imgUrl);
                }
              });

              // Определение цвета в зависимости от количества изображений
              if (duplicates.length > 0) {
                color = "pink";
              } else if (
                details.detailedPicture.length > 0 &&
                details.images.length > 0 &&
                details.photoGallery.length === 0
              ) {
                color = "green";
              } else if (details.detailedPicture.length > 0 && details.photoGallery.length > 0) {
                color = "blue";
              } else if (
                details.detailedPicture.length === 0 &&
                details.images.length === 0 &&
                details.photoGallery.length === 0
              ) {
                color = "yellow";
              } else {
                color = "red";
              }

              // Скачивание изображений
              if (
                details.detailedPicture.length > 0 &&
                (details.images.length > 0 || details.photoGallery.length > 0)
              ) {
                const folderPath = path.join(
                  downloadPath,
                  `(${details.article}) ${sanitizeFileName(details.title)}`
                );
                if (!fs.existsSync(folderPath)) {
                  fs.mkdirSync(folderPath, { recursive: true });
                }

                const seenUrls = new Set();

                for (let i = 0; i < details.detailedPicture.length; i++) {
                  if (!seenUrls.has(details.detailedPicture[i])) {
                    await downloadImage(details.detailedPicture[i], folderPath, i);
                    seenUrls.add(details.detailedPicture[i]);
                  }
                }
                for (let i = 0; i < details.images.length; i++) {
                  if (!seenUrls.has(details.images[i])) {
                    await downloadImage(
                      details.images[i],
                      folderPath,
                      i + details.detailedPicture.length
                    );
                    seenUrls.add(details.images[i]);
                  }
                }
                for (let i = 0; i < details.photoGallery.length; i++) {
                  if (!seenUrls.has(details.photoGallery[i])) {
                    await downloadImage(
                      details.photoGallery[i],
                      folderPath,
                      i + details.detailedPicture.length
                    );
                    seenUrls.add(details.photoGallery[i]);
                  }
                }
              }

              results.push({ ...details, originalArticle: article, color, duplicates });
              processedArticles.add(article);
              saveProgress(processedArticles);
              found = true;
              break;
            }
          }

          // Если артикул не найден
          if (!found) {
            results.push({ originalArticle: article, color: "red" });
            processedArticles.add(article);
            saveProgress(processedArticles);
          }
        } catch (innerError) {
          console.error(`Ошибка при обработке артикула ${article.value}:`, innerError);
          results.push({ originalArticle: article.value, color: "red", error: innerError.message });
          processedArticles.add(article.value);
          saveProgress(processedArticles);
        }
      }

      return results;
    } catch (error) {
      console.error(`Попытка ${attempt + 1} завершилась неудачей:`, error);
      attempt++;
      if (attempt < MAX_RETRIES) {
        console.log(`Повторная попытка через ${RETRY_DELAY / 1000} секунд...`);
        await sleep(RETRY_DELAY);
      } else {
        throw new Error("Превышено максимальное количество попыток. Завершение.");
      }
    } finally {
      if (driver) {
        await driver.quit();
      }
    }
  }
}
