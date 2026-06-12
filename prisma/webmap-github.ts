import { createHmac, timingSafeEqual } from 'node:crypto';

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

export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SIGMA-webmap-import',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchWebmapGithubStatus(
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
): Promise<WebmapGithubStatus> {
  const url = `https://api.github.com/repos/${repo}/commits/${branch}`;
  const response = await fetch(url, { headers: githubHeaders() });

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

export async function fetchGithubLayerFiles(
  repo = DEFAULT_REPO,
  branch = DEFAULT_BRANCH,
  directory = 'layers',
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${directory}?ref=${branch}`;
  const response = await fetch(url, { headers: githubHeaders() });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ao listar camadas em ${url}`);
  }

  const payload = (await response.json()) as Array<{ name: string; type: string }>;
  return payload.filter((item) => item.type === 'file' && item.name.endsWith('.js')).map((item) => item.name);
}

export function verifyGithubWebhookSignature(rawBody: string, signatureHeader: string | undefined, secret: string) {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expected = `sha256=${digest}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signatureHeader);
  return left.length === right.length && timingSafeEqual(left, right);
}
