const COMMIT_ENV_KEYS = [
  'APP_COMMIT_SHA',
  'RAILWAY_GIT_COMMIT_SHA',
  'SOURCE_COMMIT',
  'GIT_COMMIT',
] as const;

const FULL_SHA = /^[0-9a-f]{40}$/;

export type ResolvedCommit = {
  commit: string | null;
  commitShort: string | null;
};

export function parseCommitSha(value: unknown): string | null {
  try {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (!FULL_SHA.test(normalized)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function resolveCommitSha(
  env: NodeJS.Dict<string | undefined> = process.env,
): string | null {
  try {
    for (const key of COMMIT_ENV_KEYS) {
      const parsed = parseCommitSha(env[key]);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function toCommitShort(commit: string | null): string | null {
  if (!commit) {
    return null;
  }
  return commit.slice(0, 7);
}

export function resolveCommitFields(
  env: NodeJS.Dict<string | undefined> = process.env,
): ResolvedCommit {
  try {
    const commit = resolveCommitSha(env);
    return { commit, commitShort: toCommitShort(commit) };
  } catch {
    return { commit: null, commitShort: null };
  }
}

/** SHA resolvido uma vez no boot. Nunca lança; valor inválido ou ausente vira null. */
export const APP_COMMIT: ResolvedCommit = resolveCommitFields();
