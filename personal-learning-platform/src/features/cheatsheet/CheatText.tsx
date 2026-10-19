import { Fragment, useMemo, type ReactNode } from "react";
import katex from "katex";

const TOKEN = /(\*\*[^*]+\*\*|\$[^$\n]+\$)/g;

function math(expression: string, key: string): ReactNode {
  try {
    const html = katex.renderToString(expression, {
      displayMode: false,
      throwOnError: false,
      trust: false,
      strict: "ignore",
      maxExpand: 800,
    });
    return (
      <span
        key={key}
        className="cs-math"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span key={key}>{expression}</span>;
  }
}

function inline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(TOKEN.source, "g");
  let last = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**"))
      nodes.push(
        <strong key={`${prefix}-b${index++}`}>
          {inline(token.slice(2, -2), `${prefix}-b${index}`)}
        </strong>,
      );
    else
      nodes.push(math(token.slice(1, -1), `${prefix}-m${index++}`));
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Safe, print-friendly mixed text: **bold**, $math$, line breaks. */
export function CheatText({ text }: { text: string }) {
  const nodes = useMemo(
    () =>
      text.split("\n").map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {inline(line, `l${lineIndex}`)}
        </Fragment>
      )),
    [text],
  );
  return <>{nodes}</>;
}
