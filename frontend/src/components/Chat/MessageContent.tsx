import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const MessageContent = ({ content, isUser }: { content: any; isUser: boolean }) => {
  // Función para normalizar el contenido a un string
  const formatContent = (rawContent: any): string => {
    // Si ya es un string, perfecto
    if (typeof rawContent === 'string') return rawContent;

    // Si es un array (como el que te devolvió el API)
    if (Array.isArray(rawContent)) {
      return rawContent
        .filter((block: any) => block.type === 'text') // Solo queremos los bloques de texto
        .map((block: any) => block.text)
        .join('\n');
    }

    // Si es un objeto suelto con propiedad text
    if (rawContent && typeof rawContent === 'object' && rawContent.text) {
      return rawContent.text;
    }

    return '';
  };

  const textToRender = formatContent(content);

  return (
    <div className={`prose prose-sm max-w-none break-words ${isUser ? 'prose-invert' : ''}`}>
      {isUser ? (
        <p className="whitespace-pre-wrap">{textToRender}</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{textToRender}</ReactMarkdown>
      )}
    </div>
  );
};