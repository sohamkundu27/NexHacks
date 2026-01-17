import http from "http";
import { Builder } from "selenium-webdriver";
import Browserbase from "@browserbasehq/sdk";

import dotenv from "dotenv";
dotenv.config();

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY as string,
});

async function scrapeUrl(url: string) {
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID as string,
  });

  const customHttpAgent = new http.Agent({});
  (customHttpAgent as any).addRequest = (req: any, options: any) => {
    req.setHeader("x-bb-signing-key", session.signingKey);
    (http.Agent.prototype as any).addRequest.call(customHttpAgent, req, options);
  };

  const driver = new Builder()
    .forBrowser("chrome")
    .usingHttpAgent(customHttpAgent)
    .usingServer(
      session.seleniumRemoteUrl
    )
    .build();

  await driver.get(url);

  // Wait for load
  await driver.executeScript(
    "return document.readyState === 'complete';"
  );

  const pageText = await driver.executeScript(
    "return document.body.innerText;"
  );
  console.log("Page Text:\n", pageText);

  await driver.quit();

  return pageText;
}

// Call the function with the Browserbase homepage
scrapeUrl("https://www.browserbase.com").catch((error) => console.error(error.message));