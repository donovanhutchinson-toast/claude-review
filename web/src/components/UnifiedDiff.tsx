import { Fragment } from 'react';
import type { Comment, DiffLine, FileDiff, Hunk, Side } from '../types.ts';
import { useReview } from '../store.ts';
import { tokensForLine } from '../tokens.ts';
import type { FileSource } from '../useFileSource.ts';
import { gapsFor } from '../gaps.ts';
import { GapBlock } from './GapBlock.tsx';
import { CommentCard } from './CommentCard.tsx';
import { CommentComposer } from './CommentComposer.tsx';
import { CommentRow } from './CommentRow.tsx';
import { Gutter } from './Gutter.tsx';
import { LineContent } from './LineContent.tsx';
import {
  composerBelongsHere,
  indexComments,
  isSelected,
  lineNumberFor,
  locationKey,
  type CommentIndex,
} from './diffShared.ts';

function HunkHeader({ hunk }: { hunk: Hunk }) {
  return (
    <div className="diff-row row-hunk mono" data-hunk="">
      <div className="diff-gutter" />
      <div className="diff-gutter" />
      <div className="diff-content">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>
    </div>
  );
}

function rowClass(type: DiffLine['type']): string {
  if (type === 'add') return 'diff-row row-add';
  if (type === 'delete') return 'diff-row row-del';
  return 'diff-row';
}

function Attachments({ file, line, index }: { file: FileDiff; line: DiffLine; index: CommentIndex }) {
  const selection = useReview((s) => s.selection);
  const clearSelection = useReview((s) => s.clearSelection);
  const addComment = useReview((s) => s.addComment);

  const sides: Side[] = line.type === 'delete' ? ['old'] : line.type === 'add' ? ['new'] : ['old', 'new'];

  const comments: Comment[] = [];
  for (const side of sides) {
    const lineNo = lineNumberFor(line, side);
    if (lineNo !== null) comments.push(...(index.get(locationKey(side, lineNo)) ?? []));
  }

  const composerSide = sides.find((side) =>
    composerBelongsHere(selection, file.path, side, lineNumberFor(line, side)),
  );

  if (comments.length === 0 && !composerSide) return null;

  return (
    <CommentRow>
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} />
      ))}

      {composerSide && selection && (
        <CommentComposer
          submitLabel="Add comment"
          onCancel={clearSelection}
          onSubmit={(tag, body) => {
            const { start, end } =
              selection.anchorLine <= selection.headLine
                ? { start: selection.anchorLine, end: selection.headLine }
                : { start: selection.headLine, end: selection.anchorLine };

            void addComment({
              path: file.path,
              side: selection.side,
              startLine: start,
              endLine: end,
              tag,
              body,
            });
          }}
        />
      )}
    </CommentRow>
  );
}

export function UnifiedDiff({ file, source }: { file: FileDiff; source: FileSource }) {
  const draft = useReview((s) => s.draft);
  const selection = useReview((s) => s.selection);
  const index = indexComments(draft?.comments.filter((c) => c.path === file.path) ?? []);

  const wrap = useReview((s) => s.wrap);

  const gaps = gapsFor(file);
  const gapAt = (position: number) => gaps.find((g) => g.index === position);

  const row = (line: DiffLine, key: string) => (
    <div key={key} className={rowClass(line.type)}>
      <Gutter
        path={file.path}
        side="old"
        lineNo={line.oldLineNo}
        selected={isSelected(selection, file.path, 'old', line.oldLineNo)}
      />
      <Gutter
        path={file.path}
        side="new"
        lineNo={line.newLineNo}
        selected={isSelected(selection, file.path, 'new', line.newLineNo)}
      />
      <div className="diff-content">
        <LineContent line={line} tokens={tokensForLine(line, source.tokens)} />
      </div>
    </div>
  );

  const leading = gapAt(0);

  return (
    <div className={wrap ? 'mono' : 'mono nowrap'}>
      {leading && <GapBlock file={file} gap={leading} source={source} renderLine={row} />}

      {file.hunks.map((hunk, hunkIndex) => {
        const following = gapAt(hunkIndex + 1);

        return (
          <Fragment key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
            <HunkHeader hunk={hunk} />

            {hunk.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {row(line, `line-${lineIndex}`)}
                <Attachments file={file} line={line} index={index} />
              </Fragment>
            ))}

            {following && <GapBlock file={file} gap={following} source={source} renderLine={row} />}
          </Fragment>
        );
      })}
    </div>
  );
}
