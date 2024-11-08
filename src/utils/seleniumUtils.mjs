import { By } from "selenium-webdriver";

export async function extractImageUrls(element) {
  const imageUrls = [];
  const imageElements = await element.findElements(By.css("a"));

  for (const imgElement of imageElements) {
    const href = await imgElement.getAttribute("href");
    if (href) {
      imageUrls.push(href);
    }
  }

  return imageUrls;
}
