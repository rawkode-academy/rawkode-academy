interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  author: {
    id: number;
    name: string;
    username: string;
    avatar_url: string;
  };
  labels: string[];
  web_url: string;
  merge_commit_sha: string | null;
}

interface ChangelogEntry {
  id: number;
  title: string;
  description: string;
  type: string;
  date: Date;
  author: {
    name: string;
    username: string;
    avatar_url: string;
  };
  url: string;
  commit_sha: string | null;
}

const GITLAB_API_BASE = 'https://code.rawkode.academy/api/v4';
const PROJECT_ID = 'RawkodeAcademy%2FRawkodeAcademy'; // URL encoded project path

function getChangelogType(labels: string[]): string {
  // Look for Type:: prefixed labels first
  const typeLabels = labels.filter(label => label.startsWith('Type::'));

  if (typeLabels.length > 0) {
    const firstLabel = typeLabels[0];
    if (!firstLabel) return 'chore';
    const typeLabel = firstLabel.replace('Type::', '').toLowerCase();

    // Map your label types to display types
    switch (typeLabel) {
      case 'feature':
        return 'feature';
      case 'enhancement':
        return 'feature'; // Treat enhancements as features
      case 'defect':
        return 'fix'; // Treat defects as fixes
      case 'chore':
        return 'chore';
      default:
        return 'chore';
    }
  }

  // Fallback to old label format for backwards compatibility
  const legacyTypeLabels = labels.filter(label => {
    const lowerLabel = label.toLowerCase();
    return ['feature', 'feat', 'fix', 'chore', 'docs', 'breaking'].includes(lowerLabel);
  });

  if (legacyTypeLabels.length > 0) {
    const firstTypeLabel = legacyTypeLabels[0];
    if (!firstTypeLabel) return 'chore';
    const lowerLabel = firstTypeLabel.toLowerCase();
    return lowerLabel === 'feat' ? 'feature' : lowerLabel;
  }

  return 'chore';
}

async function fetchAllPages<T>(baseUrl: string): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100; // Maximum allowed by GitLab API

  while (true) {
    const url = `${baseUrl}&page=${page}&per_page=${perPage}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status}`);
    }

    const items: T[] = await response.json();

    if (items.length === 0) {
      break; // No more items
    }

    allItems.push(...items);

    // If we got fewer items than requested, we've reached the end
    if (items.length < perPage) {
      break;
    }

    page++;
  }

  return allItems;
}

export async function fetchChangelogEntries(): Promise<ChangelogEntry[]> {
  try {
    const baseUrl = `${GITLAB_API_BASE}/projects/${PROJECT_ID}/merge_requests?labels=Changelog&state=merged&order_by=updated_at&sort=desc`;
    const mergeRequests = await fetchAllPages<GitLabMergeRequest>(baseUrl);

    return mergeRequests.map(mr => ({
      id: mr.iid,
      title: mr.title,
      description: mr.description || '',
      type: getChangelogType(mr.labels),
      date: new Date(mr.merged_at || mr.updated_at),
      author: {
        name: mr.author.name,
        username: mr.author.username,
        avatar_url: mr.author.avatar_url,
      },
      url: mr.web_url,
      commit_sha: mr.merge_commit_sha,
    }));
  } catch (error) {
    console.error('Failed to fetch changelog entries:', error);
    return [];
  }
}

export async function fetchChangelogEntry(id: number): Promise<ChangelogEntry | null> {
  try {
    const response = await fetch(
      `${GITLAB_API_BASE}/projects/${PROJECT_ID}/merge_requests/${id}`
    );

    if (!response.ok) {
      return null;
    }

    const mr: GitLabMergeRequest = await response.json();

    // Check if it has the Changelog label
    if (!mr.labels.includes('Changelog')) {
      return null;
    }

    return {
      id: mr.iid,
      title: mr.title,
      description: mr.description || '',
      type: getChangelogType(mr.labels),
      date: new Date(mr.merged_at || mr.updated_at),
      author: {
        name: mr.author.name,
        username: mr.author.username,
        avatar_url: mr.author.avatar_url,
      },
      url: mr.web_url,
      commit_sha: mr.merge_commit_sha,
    };
  } catch (error) {
    console.error('Failed to fetch changelog entry:', error);
    return null;
  }
}
