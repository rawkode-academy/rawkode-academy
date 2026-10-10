export type PullRequestIdentity = {
  pullRequestNumber: number
  sha: string
  sha12: string
}

export function pullRequestIdentity(
  env?: Record<string, string | undefined>,
): PullRequestIdentity
