import type { CommentTag, Draft, ReviewPayload, Side } from './types.ts';

const token = new URLSearchParams(window.location.search).get('token') ?? '';

async function send<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      'x-review-token': token,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('This tab is missing its session token. Reopen the URL claude-review printed.');
    }

    const detail = await res
      .json()
      .then((d: { error?: string }) => d.error)
      .catch(() => '');

    throw new Error(detail || `Request to ${path} failed (${res.status}).`);
  }

  return (await res.json()) as T;
}

export function fetchReview(): Promise<ReviewPayload> {
  return send<ReviewPayload>('/api/review');
}

export interface NewCommentInput {
  path: string;
  side: Side | null;
  startLine: number | null;
  endLine: number | null;
  tag: CommentTag;
  body: string;
}

export function createComment(input: NewCommentInput): Promise<Draft> {
  return send<Draft>('/api/comments', 'POST', input);
}

export function updateComment(id: string, patch: { tag?: CommentTag; body?: string }): Promise<Draft> {
  return send<Draft>(`/api/comments/${encodeURIComponent(id)}`, 'PATCH', patch);
}

export function deleteComment(id: string): Promise<Draft> {
  return send<Draft>(`/api/comments/${encodeURIComponent(id)}`, 'DELETE');
}

export function putOverall(overall: string): Promise<Draft> {
  return send<Draft>('/api/overall', 'PUT', { overall });
}

export interface FileContent {
  path: string;
  side: Side;
  content: string | null;
}

export function fetchFile(path: string, side: Side): Promise<FileContent> {
  return send<FileContent>(`/api/file?path=${encodeURIComponent(path)}&side=${side}`);
}

export interface SubmitResult {
  markdownPath: string;
  jsonPath: string;
  latestMarkdownPath: string;
  commentCount: number;
  markdown: string;
}

export function fetchPreview(): Promise<{ markdown: string }> {
  return send<{ markdown: string }>('/api/preview');
}

export function submitReview(): Promise<SubmitResult> {
  return send<SubmitResult>('/api/submit', 'POST', {});
}

export function putViewed(path: string, digest: string | null): Promise<Draft> {
  return send<Draft>('/api/viewed', 'PUT', { path, digest });
}
