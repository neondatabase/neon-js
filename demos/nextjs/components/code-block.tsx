import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  code: string;
  filename?: string;
  language?: string;
}

export async function CodeBlock({
  code,
  filename,
  language = 'typescript',
}: CodeBlockProps) {
  const html = await codeToHtml(code.trim(), {
    lang: language,
    themes: {
      light: 'github-light',
      dark: 'one-dark-pro',
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {filename && (
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <span className="ml-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {filename}
          </span>
        </div>
      )}
      <div
        className="overflow-x-auto text-[13px] leading-relaxed [&_pre]:m-0 [&_pre]:bg-white [&_pre]:p-4 dark:[&_pre]:bg-zinc-950"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
