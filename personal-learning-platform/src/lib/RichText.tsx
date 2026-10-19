import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import "katex/dist/katex.min.css";
export function RichText({ text }: { text: string }) {
  const html = useMemo(() => {
    const math: string[] = [];
    const protectedText = text.replace(
      /\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g,
      (_all, block, inline) => {
        const index = math.length;
        try {
          math.push(
            katex.renderToString(block ?? inline, {
              displayMode: !!block,
              throwOnError: false,
              trust: false,
              strict: "ignore",
              maxExpand: 1000,
            }),
          );
        } catch {
          math.push(DOMPurify.sanitize(block ?? inline));
        }
        return `MATHPLACEHOLDER${index}END`;
      },
    );
    let h = marked.parse(protectedText, { async: false }) as string;
    h = DOMPurify.sanitize(h, {
      FORBID_TAGS: ["style", "iframe", "form", "input"],
      FORBID_ATTR: ["style"],
    });
    h = h.replace(/MATHPLACEHOLDER(\d+)END/g, (_m, n) => math[Number(n)] ?? "");
    return h;
  }, [text]);
  return (
    <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
