"use strict";

import fs from "fs";
import handlebars from "handlebars";

const accessToken = process.env.GITHUB_TOKEN;
const username = "la55u";

/**
 * Fetches a GitHub API URL
 * @param {string} path The URL to fetch
 * @returns {object} Response JSON object
 */
async function fetchData(path) {
  try {
    console.log("Fetching: ", path);
    const response = await fetch(`https://api.github.com/` + path, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Node.js",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      // parse error body
      const err = await response.json();
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Error fetching path \`${path}\``, { cause: error });
  }
}

/**
 * Fetches all the required stats from GitHub
 */
async function fetchAll() {
  try {
    // Fetch public repositories only
    const repositories = await fetchData(`users/${username}/repos?type=public&per_page=100`);

    let totalStars = 0;
    // Only count stars from public repositories
    repositories.forEach((repo) => {
      if (!repo.private) {
        totalStars += repo.stargazers_count;
      }
    });

    // Fetch issues opened
    const issuesData = await fetchData(`search/issues?q=author:${username}+type:issue`);
    const issuesOpened = issuesData.total_count;

    // Fetch merge requests (pull requests) opened
    const firstPrData = await fetchData(
      `search/issues?q=author:${username}+type:pr&sort=created&order=asc&per_page=1`
    );
    const prsOpened = firstPrData.total_count;
    const firstPRDate = firstPrData.items[0].created_at;
    const firstPRUrl = firstPrData.items[0].html_url;

    // Most
    const latestPrData = await fetchData(
      `search/issues?q=author:${username}+type:pr&sort=created&order=desc&per_page=1`
    );
    const latestPRDate = latestPrData.items[0].created_at;
    const latestPRUrl = latestPrData.items[0].html_url;

    // Fetch merge requests merged
    const mergedPRs = await fetchData(
      `search/issues?q=author:${username}+type:pr+is:merged`
    );
    const prsMerged = mergedPRs.total_count;

    // Fetch comments made on issues
    const commentsOnIssuesData = await fetchData(`search/issues?q=commenter:${username}`);
    const commentsOnIssues = commentsOnIssuesData.total_count;

    // Fetch user data
    const userData = await fetchData(`users/${username}`);

    const registeredDate = userData.created_at;
    const publicRepoCount = userData.public_repos;
    const followers = userData.followers;

    return {
      issuesOpened,
      prsOpened,
      prsMerged,
      commentsOnIssues,
      publicRepoCount,
      totalStars,
      registeredDate: new Date(registeredDate).toISOString().substring(0, 10),
      firstPRDate: new Date(firstPRDate).toISOString().substring(0, 10),
      firstPRUrl,
      sponsoredAccounts: 3, // TODO
      statUpdated: new Date().toISOString().substring(0, 10),
      followers,
      latestPRDate: new Date(latestPRDate).toISOString().substring(0, 10),
      latestPRUrl,
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error(error, { cause: error });
  }
}

/**
 * Loads Handlebars Markdown template file
 * @param {string} templateFilePath
 */
async function loadTemplate(templateFilePath) {
  try {
    const templateContent = fs.readFileSync(templateFilePath, "utf8");
    return templateContent;
  } catch (error) {
    console.error("Error loading template:", error);
    throw error;
  }
}

/**
 * Generate README content using the template and data
 * @param {string} templateFilePath
 * @param {string} data
 */
async function generateReadme(templateFilePath, data) {
  try {
    const templateContent = await loadTemplate(templateFilePath);
    const template = handlebars.compile(templateContent);
    const readmeContent = template(data);
    return readmeContent;
  } catch (error) {
    console.error("Error generating README content:", error);
    throw error;
  }
}

async function main() {
  try {
    const data = await fetchAll();
    const readmeContent = await generateReadme("README.md.hbs", data);
    fs.writeFileSync("README.md", readmeContent, "utf8");
    console.log("README file updated successfully.");
  } catch (error) {
    console.error("Error updating README file:", error);
  }
}

await main();
