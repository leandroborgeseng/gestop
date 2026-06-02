export type WebmapGithubStatus = {
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  committedAt: string;
  htmlUrl: string;
};

const DEFAULT_REPO = process.env.WEBMAP_GITHUB_REPO?.trim() || 'SMMAFRANCA/webmap';
const DEFAULT_BRANCH = process.env.WEBMAP_GITHUB_BRANCH?.trim() || 'main';

export async function fetchWebmapGithubStatus(
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
): Promise<WebmapGithubStatus> {
  const url = `https://api.github.com/repos/${repo}/commits/${branch}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GestOP-webmap-import',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ao consultar ${url}`);
  }

  const payload = (await response.json()) as {
    sha: string;
    html_url: string;
    commit: { message: string; author: { date: string | null } };
  };

  return {
    repo,
    branch,
    commitSha: payload.sha,
    commitMessage: payload.commit.message.split('\n')[0]?.trim() ?? '(sem mensagem)',
    committedAt: payload.commit.author.date ?? new Date().toISOString(),
    htmlUrl: payload.html_url,
  };
}
