import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SAFE_LINK = /^(https?:\/\/|mailto:)/i

/** Basic Memory enlaza notas con [[Titulo]]: aqui se muestra como texto destacado, sin romper el markdown. */
const highlightWikiLinks = (markdown: string) => markdown.replace(/\[\[([^\]\n]{1,120})\]\]/g, '**$1**')

const components: Components = {
  h1: (props) => <h1 className="mb-4 mt-8 text-2xl font-semibold tracking-tight first:mt-0" {...props} />,
  h2: (props) => <h2 className="mb-3 mt-8 border-b pb-2 text-xl font-semibold tracking-tight" {...props} />,
  h3: (props) => <h3 className="mb-2 mt-6 text-lg font-semibold" {...props} />,
  h4: (props) => <h4 className="mb-2 mt-4 font-semibold" {...props} />,
  p: (props) => <p className="my-3 leading-7" {...props} />,
  ul: (props) => <ul className="my-3 list-disc space-y-1.5 pl-6 marker:text-muted-foreground" {...props} />,
  ol: (props) => <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  blockquote: (props) => <blockquote className="my-4 border-l-2 border-primary/50 pl-4 text-muted-foreground" {...props} />,
  hr: () => <hr className="my-6 border-border" />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  // Solo http(s) y mailto: nunca javascript: ni data:. Se abren fuera, sin pasar el origen.
  a: ({ href, children }) =>
    href && SAFE_LINK.test(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-4 hover:opacity-80">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Las imagenes no se cargan (la politica de seguridad solo admite las propias): se muestra su texto.
  img: ({ alt }) => <span className="text-muted-foreground">[imagen{alt ? `: ${alt}` : ''}]</span>,
  pre: (props) => <pre className="my-4 overflow-x-auto rounded-xl border bg-muted/50 p-4 font-mono text-[13px] leading-6" {...props} />,
  code: ({ className, children, ...props }) =>
    className ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    ),
  table: (props) => (
    <div className="my-4 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b bg-muted/40 px-3 py-2 text-left font-semibold" {...props} />,
  td: (props) => <td className="border-b px-3 py-2 align-top last:border-b-0" {...props} />,
}

/** Markdown seguro: no admite HTML en bruto (se muestra como texto) y filtra los enlaces. */
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-none text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {highlightWikiLinks(markdown)}
      </ReactMarkdown>
    </div>
  )
}
