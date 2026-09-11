import { Fragment } from 'react';
import type { Comment, DiffLine, FileDiff, Hunk, Side } from '../types.ts';
import { splitHunks, type SplitPair } from '../diffRows.ts';
import { useReview } from '../store.ts';
import { tokensForLine, type FileTokens } from '../tokens.ts';
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
  locationKey,
  type CommentIndex,
} from './diffShared.ts';

function HunkHeader({ hunk }: { hunk: Hunk }) {
  return (
    <div className="split-row row-hunk mono" data-hunk="">
      <div className="diff-gutter" />
      <div className="diff-content">
        @@ -{hunk.oldStart},{hunk.oldLines} @@
      </div>
      <div className="diff-gutter" />
      <div className="diff-content">
        @@ +{hunk.newStart},{hunk.newLines} @@
      </div>
    </div>
  );
}

function cellClass(line: DiffLine | null, side: Side): string {
  if (!line) return 'split-cell cell-empty';
  if (side === 'old' && line.type === 'delete') return 'split-cell cell-del';
  if (side === 'new' && line.type === 'add') return 'split-cell cell-add';
  return 'split-cell';
}

function HalfRow({
  file,
  line,
  side,
  tokens,
}: {
  file: FileDiff;
  line: DiffLine | null;
  side: Side;
  tokens: FileTokens;
}) {
  const selection = useReview((s) => s.selection);
  const lineNo = line ? (side === 'old' ? line.oldLineNo : line.newLineNo) : null;

  return (
    <>
      <Gutter
        path={file.path}
        side={side}
        lineNo={lineNo}
        selected={isSelected(selection, file.path, side, lineNo)}
      />
      <div className={`${cellClass(line, side)} diff-content`}>
        {line && <LineContent line={line} tokens={tokensForLine(line, tokens)} />}
      </div>
    </>
  );
}

function Attachments({ file, pair, index }: { file: FileDiff; pair: SplitPair; index: CommentIndex }) {
  const selection = useReview((s) => s.selection);
  const clearSelection = useReview((s) => s.clearSelection);
  const addComment = useReview((s) => s.addComment);

  const oldLineNo = pair.left?.oldLineNo ?? null;
  const newLineNo = pair.right?.newLineNo ?? null;

  const comments: Comment[] = [
    ...(oldLineNo === null ? [] : (index.get(locationKey('old', oldLineNo)) ?? [])),
    ...(newLineNo === null ? [] : (index.get(locationKey('new', newLineNo)) ?? [])),
  ];

  const composerHere =
    composerBelongsHere(selection, file.path, 'old', oldLineNo) ||
    composerBelongsHere(selection, file.path, 'new', newLineNo);

  if (comments.length === 0 && !composerHere) return null;

  return (
    <CommentRow>
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} />
      ))}

      {composerHere && selection && (
        <CommentComposer
          submitLabel="Add comment"
          onCancel={clearSelection}
          onSubmit={(tag, body) => {
            const start = Math.min(selection.anchorLine, selection.headLine);
            const end = Math.max(selection.anchorLine, selection.headLine);

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

export function SplitDiff({ file, source }: { file: FileDiff; source: FileSource }) {
  const draft = useReview((s) => s.draft);
  const index = indexComments(draft?.comments.filter((c) => c.path === file.path) ?? []);

  const wrap = useReview((s) => s.wrap);

  const gaps = gapsFor(file);
  const gapAt = (position: number) => gaps.find((g) => g.index === position);

  const contextRow = (line: DiffLine, key: string) => (
    <div key={key} className="split-row">
      <HalfRow file={file} line={line} side="old" tokens={source.tokens} />
      <HalfRow file={file} line={line} side="new" tokens={source.tokens} />
    </div>
  );

  const leading = gapAt(0);

  return (
    <div className={wrap ? 'mono' : 'mono nowrap'}>
      {leading && <GapBlock file={file} gap={leading} source={source} renderLine={contextRow} />}

      {splitHunks(file).map(({ hunk, pairs }, hunkIndex) => {
        const following = gapAt(hunkIndex + 1);

        return (
          <Fragment key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
            <HunkHeader hunk={hunk} />

            {pairs.map((pair, pairIndex) => (
              <Fragment key={pairIndex}>
                <div className="split-row">
                  <HalfRow file={file} line={pair.left} side="old" tokens={source.tokens} />
                  <HalfRow file={file} line={pair.right} side="new" tokens={source.tokens} />
                </div>

                <Attachments file={file} pair={pair} index={index} />
              </Fragment>
            ))}

            {following && (
              <GapBlock file={file} gap={following} source={source} renderLine={contextRow} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
