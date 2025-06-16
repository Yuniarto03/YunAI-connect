
import React, { useContext, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppContext } from '../contexts/AppContext';
import { AppContextType } from '../types';
import { documentationMarkdownContent } from '../documentationContent';
import Button from './shared/Button';
import { Download, Printer, AlertTriangle } from 'lucide-react';
import { RAW_COLOR_VALUES } from '../constants';
import type { Element } from 'hast';

interface CustomCodeProps {
  node: Element;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const DocumentationPage: React.FC = () => {
  const { theme, isSidebarOpen } = useContext(AppContext) as AppContextType;
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadHtml = () => {
    if (!contentRef.current) return;

    const renderedHtml = contentRef.current.innerHTML;
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Application Documentation</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; color: #333; }
          .markdown-body { max-width: 800px; margin: 0 auto; }
          h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; color: #111; }
          h1 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
          p { margin-bottom: 1em; }
          ul, ol { margin-bottom: 1em; padding-left: 2em; }
          li { margin-bottom: 0.3em; }
          code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background-color: #f0f0f0; padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; }
          pre { background-color: #f0f0f0; padding: 16px; overflow: auto; line-height: 1.45; border-radius: 6px; }
          pre code { padding: 0; margin: 0; font-size: 100%; line-height: inherit; background-color: transparent; border-radius: 0; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 1em; display: block; overflow: auto; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { font-weight: bold; background-color: #f2f2f2; }
          blockquote { padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; margin-left:0; margin-right:0; margin-bottom:1em; }
          img { max-width: 100%; height: auto; }
          hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
          .theme-dark { background-color: #0d1117; color: #c9d1d9; }
          .theme-dark h1, .theme-dark h2, .theme-dark h3, .theme-dark h4, .theme-dark h5, .theme-dark h6 { color: #58a6ff; border-color: #30363d; }
          .theme-dark code { background-color: #161b22; }
          .theme-dark pre { background-color: #161b22; }
          .theme-dark table th, .theme-dark table td { border-color: #30363d; }
          .theme-dark table th { background-color: #161b22; }
          .theme-dark blockquote { color: #8b949e; border-left-color: #30363d; }
          .theme-dark hr { background-color: #30363d; }
          /* Add specific styles to match app's rendered markdown */
          .markdown-body ul, .markdown-body ol { padding-left: 2em; }
          .markdown-body li > p { margin-bottom: 0.2em; } /* Reduce space if p is inside li */
        </style>
      </head>
      <body class="${theme.name.toLowerCase().includes('dark') || theme.name.toLowerCase().includes('void') || theme.name.toLowerCase().includes('matrix') || theme.name.toLowerCase().includes('cyber') ? 'theme-dark' : ''}">
        <div class="markdown-body">
          ${renderedHtml}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'MasYunAI_Documentation.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handlePrintToPdf = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            margin: 0;
            padding: 0;
            line-height: normal; /* Reset line height for print */
          }
          #documentation-content-area, #documentation-content-area * {
            visibility: visible;
          }
          #documentation-content-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px !important; /* Ensure some padding for print */
            margin: 0 !important;
            font-size: 10pt !important; /* Adjust base font size for print */
            color: #000 !important; /* Ensure text is black for print */
          }
          #documentation-content-area h1, 
          #documentation-content-area h2, 
          #documentation-content-area h3, 
          #documentation-content-area h4, 
          #documentation-content-area h5, 
          #documentation-content-area h6 {
            color: #000 !important;
            margin-top: 1.2em;
            margin-bottom: 0.4em;
            page-break-after: avoid;
          }
           #documentation-content-area p, 
           #documentation-content-area li,
           #documentation-content-area td,
           #documentation-content-area th {
            font-size: 10pt !important;
            line-height: 1.4 !important;
          }
          #documentation-content-area pre, #documentation-content-area code {
            font-size: 9pt !important;
            background-color: #f0f0f0 !important;
            color: #000 !important;
            border: 1px solid #ccc !important;
            page-break-inside: avoid;
          }
           #documentation-content-area table {
            page-break-inside: avoid;
          }
          #documentation-content-area a {
            color: #000 !important;
            text-decoration: underline !important; /* Make links visible */
          }
          /* Hide buttons in print view */
          .documentation-actions {
            display: none !important;
          }
        }
        .markdown-render-area h1, .markdown-render-area h2, .markdown-render-area h3, .markdown-render-area h4 {
            font-weight: 600;
            line-height: 1.25;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            color: ${RAW_COLOR_VALUES[theme.accent1]};
        }
        .markdown-render-area h1 { font-size: 2em; border-bottom: 1px solid ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]}; padding-bottom: 0.3em; }
        .markdown-render-area h2 { font-size: 1.6em; border-bottom: 1px solid ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]}; padding-bottom: 0.3em; }
        .markdown-render-area h3 { font-size: 1.3em; }
        .markdown-render-area h4 { font-size: 1.1em; }
        .markdown-render-area p { margin-bottom: 1em; line-height: 1.7; }
        .markdown-render-area ul, .markdown-render-area ol { margin-bottom: 1em; padding-left: 2em; }
        .markdown-render-area li { margin-bottom: 0.4em; }
        .markdown-render-area li > p { margin-bottom: 0.2em; }
        .markdown-render-area code {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
          background-color: ${RAW_COLOR_VALUES[theme.mediumGray]}/30;
          color: ${RAW_COLOR_VALUES[theme.accent4]};
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          border-radius: 6px;
        }
        .markdown-render-area pre {
          background-color: ${RAW_COLOR_VALUES[theme.darkBg]};
          padding: 16px;
          overflow: auto;
          line-height: 1.45;
          border-radius: 6px;
          border: 1px solid ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]};
        }
        .markdown-render-area pre code {
          padding: 0; margin: 0; font-size: 100%; line-height: inherit; background-color: transparent; border-radius: 0; color: ${RAW_COLOR_VALUES[theme.textColor.replace('text-', '')] || '#E0E0E0'};
        }
        .markdown-render-area table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
          display: block;
          overflow: auto;
          border: 1px solid ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]};
        }
        .markdown-render-area th, .markdown-render-area td {
          border: 1px solid ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]};
          padding: 0.5em 0.75em;
        }
        .markdown-render-area th {
          font-weight: bold;
          background-color: ${RAW_COLOR_VALUES[theme.mediumGray]}/50;
        }
        .markdown-render-area blockquote {
          padding: 0 1em;
          color: ${RAW_COLOR_VALUES[theme.textColor.replace('text-', '')]}/80;
          border-left: 0.25em solid ${RAW_COLOR_VALUES[theme.accent1]};
          margin-left: 0; margin-right: 0; margin-bottom: 1em; background-color: ${RAW_COLOR_VALUES[theme.mediumGray]}/10;
        }
        .markdown-render-area img { max-width: 100%; height: auto; border-radius: 6px; margin-top: 0.5em; margin-bottom: 0.5em; }
        .markdown-render-area hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: ${RAW_COLOR_VALUES[theme.borderColor.replace('border-','')]}; border: 0; }
        .markdown-render-area a { color: ${RAW_COLOR_VALUES[theme.accent3]}; text-decoration: none; }
        .markdown-render-area a:hover { text-decoration: underline; }
      `}</style>
      <div className={`p-4 md:p-8 ${theme.textColor} h-full flex flex-col futuristic-scrollbar overflow-y-auto`} id="documentation-page-container">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 documentation-actions">
          <h1 className={`text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2}`}>Application Documentation</h1>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button onClick={handleDownloadHtml} variant="secondary" size="sm" leftIcon={<Download size={16}/>}>
              Download as HTML
            </Button>
            <Button onClick={handlePrintToPdf} variant="primary" size="sm" leftIcon={<Printer size={16}/>}>
              Print to PDF
            </Button>
          </div>
        </div>

        <div className="flex-grow documentation-actions">
          <div className={`${theme.cardBg} p-4 sm:p-6 rounded-xl shadow-xl border ${theme.borderColor}`}>
             <div className="prose prose-sm md:prose-base max-w-none markdown-render-area" ref={contentRef} id="documentation-content-area">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        // You can customize rendering of specific elements here if needed
                        // For example, to style tables or code blocks further with Tailwind if ReactMarkdown doesn't pick up all styles.
                         code: ({ node, inline, className, children, ...rest }: CustomCodeProps) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                                 <pre><code className={className} {...rest}>{children}</code></pre>
                            ) : (
                                <code className={className || ''} {...rest}>{children}</code>
                            );
                        }
                    }}
                >
                    {documentationMarkdownContent}
                </ReactMarkdown>
            </div>
          </div>
        </div>

         {!documentationMarkdownContent.trim() && (
            <div className={`${theme.cardBg} p-10 rounded-xl shadow-xl border ${theme.borderColor} text-center documentation-actions`}>
                <AlertTriangle size={60} className={`mx-auto mb-6 text-${theme.accent4} opacity-50`} />
                <h2 className="text-2xl font-semibold mb-3">Dokumentasi Tidak Tersedia</h2>
                <p className="opacity-70">Konten dokumentasi saat ini kosong atau belum dimuat.</p>
            </div>
         )}
      </div>
    </>
  );
};

export default DocumentationPage;
