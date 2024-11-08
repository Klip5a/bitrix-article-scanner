import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

// Путь к папке, где хранятся файлы для обработки
const folderPath = "./files";

// Путь к папке, где будут сохраняться результаты
const resultFolderPath = path.join(process.cwd(), "result");

// Функция для извлечения артикулов из Excel-файлов
export async function fetchArticles() {
  const articles = [];

  // Получение списка файлов в папке
  const files = fs.readdirSync(folderPath);

  // Фильтрация файлов, чтобы выбрать только файлы с расширением .xlsx
  const excelFiles = files.filter((file) => file.endsWith(".xlsx"));

  // Обработка каждого файла
  for (const file of excelFiles) {
    const filePath = path.join(folderPath, file);
    const workbook = new ExcelJS.Workbook();

    try {
      // Чтение файла Excel
      await workbook.xlsx.readFile(filePath);

      // Получение первой вкладки (лист) в файле
      const sheetName = workbook.worksheets[0].name;
      const ws = workbook.getWorksheet(sheetName);

      const data = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = row.values.slice(1); // Убираем пустую ячейку
        data.push(rowValues);
      });

      // Извлечение данных из первой колонки и сохранение артикулов
      const fileArticles = data
        .slice(1) // Пропуск заголовка
        .map((row) => {
          const value = row[0] || "No value";
          return {
            value: value !== "No value" ? value : undefined,
          };
        })
        .filter((item) => item.value !== undefined);

      articles.push(...fileArticles);
    } catch (error) {
      console.error(`Ошибка при чтении файла ${file}:`, error.message);
      continue;
    }
  }

  return articles;
}

// Функция для записи результатов в новый Excel-файл
export async function writeResultsToExcel(results) {
  const newWorkbook = new ExcelJS.Workbook();
  const newWorksheet = newWorkbook.addWorksheet("Результаты");

  // Определение колонок таблицы
  newWorksheet.columns = [
    { header: "Артикул", key: "article", width: 10 },
    { header: "Название", key: "title", width: 50 },
    { header: "Дубликаты", key: "duplicates", width: 50 },
  ];

  if (results && Array.isArray(results)) {
    results.forEach((result) => {
      const row = newWorksheet.addRow(result);
      const color = result.color;

      let fill = {}; // Определение цвета ячейки в зависимости от состояния артикула
      if (color === "green") {
        fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF00FF00" },
        }; // Зеленый
      } else if (color === "blue") {
        fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "ff91d2ff" },
        }; // Голубой
      } else if (color === "yellow") {
        fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "ffffcc00" },
        }; // Желтый
      } else if (color === "red") {
        fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" },
        }; // Красный
      } else if (color === "pink") {
        fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFC0CB" },
        }; // Розовый
      }

      // Добавление границ к ячейкам строки
      const borderStyle = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      row.eachCell((cell) => {
        cell.fill = fill;
        cell.border = borderStyle;
      });

      // Если есть дубликаты, указываем это
      if (result.duplicates && result.duplicates.length > 0) {
        const cell = row.getCell(3);
        cell.value = result.duplicates ? "Да" : "Нет";
      }
    });

    // Форматирование имени файла с текущей датой и временем
    const now = new Date();
    const formattedDate = now
      .toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(",", "")
      .replace(":", ".");

    const filename = `проверенные артикулы (${formattedDate}).xlsx`;

    // Сохранение нового файла
    await newWorkbook.xlsx.writeFile(path.join(resultFolderPath, filename));
  } else {
    console.error("Результаты не являются массивом или не определены.");
  }
}
