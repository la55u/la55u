import fs from "fs";
import handlebars from "handlebars";

const accessToken = process.env.GH_ACCESS_TOKEN;
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
    // Fetch repositories contributed to
    const repositories = await fetchData(`users/${username}/repos?type=all&per_page=100`);

    let totalStars = 0;
    repositories.forEach((repo) => {
      totalStars += repo.stargazers_count;
    });

    // Calculate total commits count
    let totalCommits = 0;
    for (const repo of repositories) {
      const commitsData = await fetchData(`repos/${username}/${repo.name}/commits`);
      totalCommits += commitsData.length;
    }

    // Fetch issues opened
    const issuesData = await fetchData(`search/issues?q=author:${username}+type:issue`);
    const issuesOpened = issuesData.total_count;

    // Fetch merge requests (pull requests) opened
    const prs = await fetchData(
      `search/issues?q=author:${username}+type:pr&sort=created&order=asc`
    );
    const pullRequestsOpened = prs.total_count;
    const firstPullRequestDate = prs.items[0].created_at;

    // Fetch merge requests merged
    const mergedPRs = await fetchData(
      `search/issues?q=author:${username}+type:pr+is:merged`
    );
    const pullRequestsMerged = mergedPRs.total_count;

    // Fetch comments made on issues
    const commentsOnIssuesData = await fetchData(`search/issues?q=commenter:${username}`);
    const commentsOnIssues = commentsOnIssuesData.total_count;

    // Fetch user data
    const userData = await fetchData(`user`);

    const registeredDate = userData.created_at;
    const publicRepoCount = userData.public_repos;
    const followers = userData.followers;

    return {
      issuesOpened,
      pullRequestsOpened,
      pullRequestsMerged,
      commentsOnIssues,
      publicRepoCount,
      totalStars,
      totalCommits,
      registeredDate: new Date(registeredDate).toISOString().substring(0, 10),
      firstPullRequestDate: new Date(firstPullRequestDate).toISOString().substring(0, 10),
      sponsoredAccounts: 3, // TODO
      statUpdated: new Date().toISOString().substring(0, 10),
      followers,
    };
  } catch (error) {
    console.error("Something went wrong:", error);
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

main();
