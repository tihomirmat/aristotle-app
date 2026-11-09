import React from "react";
import ReactMarkdown from "react-markdown";

// Predogled ponudbe kot list papirja. Slogi so tu, ker aplikacija nima vtičnika za »prose«.
const C = {
  h1: (p) => <h1 className="font-display text-2xl font-bold mt-0 mb-4" {...p} />,
  h2: (p) => <h2 className="font-display text-lg font-bold mt-6 mb-2" {...p} />,
  h3: (p) => <h3 className="font-display text-base font-semibold mt-5 mb-1.5" {...p} />,
  p: (p) => <p className="text-[15px] leading-relaxed mb-3" {...p} />,
  ul: (p) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[15px]" {...p} />,
  ol: (p) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[15px]" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  hr: () => <hr className="my-5 border-slate-200" />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  a: (p) => <a className="text-primary underline" target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p) => <blockquote className="border-l-4 border-slate-200 pl-4 text-slate-600 mb-3" {...p} />,
};

export default function OfferPreview({ markdown, className = "" }) {
  return (
    <div className={`bg-white text-slate-900 rounded-xl border shadow-sm px-6 py-7 sm:px-10 sm:py-9 ${className}`}>
      {markdown ? <ReactMarkdown components={C}>{markdown}</ReactMarkdown> : <p className="text-sm text-muted-foreground">Ta ponudba nima shranjenega besedila.</p>}
    </div>
  );
}
