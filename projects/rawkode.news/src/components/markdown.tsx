import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

const inlineComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
  em: ({ children }) => <em className="italic">{children}</em>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  del: ({ children }) => <span className="line-through">{children}</span>,
  code: ({ children }) => (
    <code className="rounded-none bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>
  ),
  a: ({ children, href }) => (
    <a href={href} className="underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
  br: () => <span> </span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>{children}</span>,
};

const blockComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  em: ({ children }) => <em className="italic">{children}</em>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  del: ({ children }) => <span className="line-through">{children}</span>,
  a: ({ children, href }) => (
    <a href={href} className="underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
  code: ({ children, className }) =>
    className?.includes("language-") ? (
      <code className={cn("text-[0.85em]", className)}>{children}</code>
    ) : (
      <code className="rounded-none bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-none border border-border bg-muted px-3 py-2 text-xs last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-border pl-3 italic last:mb-0">{children}</blockquote>
  ),
};

export function MarkdownInline({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <span className={cn("inline", className)}>
      <ReactMarkdown
        skipHtml
        unwrapDisallowed
        disallowedElements={[
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
          "pre",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "hr",
        ]}
        components={inlineComponents}
      >
        {source}
      </ReactMarkdown>
    </span>
  );
}

export function MarkdownBlock({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed text-muted-foreground", className)}>
      <ReactMarkdown skipHtml components={blockComponents}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
