const HtmlEntities = require('html-entities');
const sanitizeHtml = require('sanitize-html');
const {RecursiveCharacterTextSplitter} = require('@langchain/textsplitters');

const MAX_SEGMENT_LENGTH = 500;

const OCR_SYSTEM_PROMPT = `Effectue une reconnaissance optique de caractères (OCR) sur cette image et extraits-en le texte lisible.
Respecte la mise en page autant que possible. 
Si le texte contient des tableaux ou des colonnes, préserve leur structure. 
Ignore les artefacts visuels inutiles. 
Corrige les erreurs évidentes et restitue un texte propre et fidèle à l'original.
Ta réponse contient uniquement le texte lisible.`;

const getPDFImages = async (pdfPath) => {
  const {pdfToPng} = require('pdf-to-png-converter');
  // The function accepts PDF file path or a Buffer
  const pages = await pdfToPng(pdfPath, {
    disableFontFace: true, // When `false`, fonts will be rendered using a built-in font renderer that constructs the glyphs with primitive path commands. Default value is true.
    useSystemFonts: true, // When `true`, fonts that aren't embedded in the PDF document will fallback to a system font. Default value is false.
    enableXfa: true, // Render Xfa forms if any. Default value is false.
    viewportScale: 0.8, // The desired scale of PNG viewport. Default value is 1.0 which means to display page on the existing canvas with 100% scale.
    //outputFolder: 'output/folder', // Folder to write output PNG files. If not specified, PNG output will be available only as a Buffer content, without saving to a file.
    //outputFileMaskFunc: (pageNumber) => `page_${pageNumber}.png`, // Output filename mask function. Example: (pageNumber) => `page_${pageNumber}.png`
    //pdfFilePassword: password, // Password for encrypted PDF.
    //pagesToProcess: [1, 3, 11], // Subset of pages to convert (first page = 1), other pages will be skipped if specified.
    //strictPagesToProcess: false, // When `true`, will throw an error if specified page number in pagesToProcess is invalid, otherwise will skip invalid page. Default value is false.
    verbosityLevel: 0, // Verbosity level. ERRORS: 0, WARNINGS: 1, INFOS: 5. Default value is 0.
  });
  const images = [];
  for (const page of pages) {
    const {content} = page;
    const base64Image = content.toString('base64');
    images.push(`data:image/png;base64,${base64Image}`);
  }
  return images;
};

const cleanHtmlContent = (html) => {
  const decodedHtml = HtmlEntities.decode(html);
  const textOnly = decodedHtml.replace(/<[^>]+>/g, '');
  const cleanedText = textOnly.replace(/\s+/g, ' ').trim();
  return cleanedText;
};

const simplifyHtml = (html) => {
  return sanitizeHtml(HtmlEntities.decode(html));
};

const splitLongText = (text, maxLength, baseId) => {
  let segments = [];
  let words = text.split(/\s+/); // Découper en mots
  let currentSegment = [];
  let currentLength = 0;
  let partIndex = 1;

  words.forEach((word) => {
    if (currentLength + word.length + 1 > maxLength) {
      segments.push({
        id: `${baseId}_part${partIndex}`,
        content: currentSegment.join(' '),
      });
      currentSegment = [];
      currentLength = 0;
      partIndex++;
    }
    currentSegment.push(word);
    currentLength += word.length + 1;
  });

  if (currentSegment.length > 0) {
    segments.push({
      id: `${baseId}_part${partIndex}`,
      content: currentSegment.join(' '),
    });
  }

  return segments;
};

const html2chunks = async (html, chunkSize = 1000, chunkOverlap = 0) => {
  const textSplitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
    chunkSize,
    chunkOverlap,
    separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage('html'),
  });
  return await textSplitter.splitText(html);
};

const extractTitlesAndContent = (html) => {
  const cleanHtml = simplifyHtml(html);

  const titleRegex = /<h([1-6])>(.*?)<\/h\1>/g;
  const paragraphRegex = /<p>(.*?)<\/p>/g;

  let result = [];
  let match;
  let lastIndex = 0;
  let segmentId = 1;

  while ((match = titleRegex.exec(cleanHtml)) !== null) {
    const titleText = match[2].trim();
    const titleStartIndex = match.index;

    const contentBeforeTitle = cleanHtml.slice(lastIndex, titleStartIndex);
    if (contentBeforeTitle && contentBeforeTitle.length > 3) {
      result.push(
        ...splitLongText(
          contentBeforeTitle,
          MAX_SEGMENT_LENGTH,
          `segment_${segmentId}`
        )
      );
      segmentId++;
    }

    result.push({
      id: `segment_${segmentId}`,
      content: titleText,
    });

    lastIndex = titleRegex.lastIndex;
    segmentId++;
  }

  while ((match = paragraphRegex.exec(cleanHtml)) !== null) {
    const paragraphText = match[1].trim();
    if (paragraphText.length > 3) {
      if (paragraphText.length > MAX_SEGMENT_LENGTH) {
        result.push(
          ...splitLongText(
            paragraphText,
            MAX_SEGMENT_LENGTH,
            `segment_${segmentId}`
          )
        );
      } else {
        result.push({
          id: `segment_${segmentId}`,
          content: paragraphText,
        });
      }
    }

    segmentId++;
  }

  const remainingContent = cleanHtml.slice(lastIndex).trim();
  if (remainingContent && remainingContent.length > 3) {
    result.push(
      ...splitLongText(
        remainingContent,
        MAX_SEGMENT_LENGTH,
        `segment_${segmentId}`
      )
    );
  }

  return result;
};

const estimateTokenCount = (text) => {
  return Math.ceil(text.split(/\s+/).length * 1.33);
};

function sliceText(text, chunkSize) {
  const chunks = [];
  let currentChunk = '';

  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]; // Découpe en phrases

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= chunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

function groupSentences(text, maxSize) {
  const chunks = [];
  let currentChunk = '';

  // Découpe le texte en phrases en gardant la ponctuation
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length > maxSize) {
      // Si la phrase est trop longue, on découpe par mot
      if (sentence.length > maxSize) {
        const words = sentence.split(' ');
        let tempChunk = '';

        for (const word of words) {
          if ((tempChunk + ' ' + word).trim().length > maxSize) {
            chunks.push(tempChunk.trim());
            tempChunk = word;
          } else {
            tempChunk += (tempChunk ? ' ' : '') + word;
          }
        }

        if (tempChunk) chunks.push(tempChunk.trim());
        currentChunk = ''; // Réinitialiser après un découpage forcé
      } else {
        // Ajouter le chunk en attente et commencer un nouveau
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
    }
  }

  // Ajoute le dernier bloc s'il contient du texte
  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

const buildPromptFromArticles = (articles, question, maxTokens) => {
  let context = '[CONTEXT]\n\n';
  let currentTokenCount = estimateTokenCount(context);

  articles.forEach((article) => {
    const {kind, title, link, locale} = article;
    const articleContext = `# ${kind}: ${title} #\nLien: ${link}\n Langue: ${locale}\n`;

    context += articleContext;

    if (article.segments && article.segments.length > 0) {
      context += '## Segments pertinents: ##\n';
      article.segments
        .sort((a, b) => b.score - a.score) // Trier par pertinence
        .forEach((s, i) => {
          let segmentContext = `  ${i + 1}. ${s.segment} (Pertinence: ${
            s.score
          })\n`;
          currentTokenCount += estimateTokenCount(segmentContext);

          if (currentTokenCount > maxTokens) {
            return;
          }

          context += segmentContext;

          // Ajouter du contexte avant et après le segment
          const beforeContext = article.content.substring(
            Math.max(0, s.start - 50),
            s.start
          );
          const afterContext = article.content.substring(
            s.end,
            Math.min(article.content.length, s.end + 50)
          );

          const additionalContext = `### Contexte avant: ###\n${beforeContext}\n### Contexte après: ###\n${afterContext}\n`;
          currentTokenCount += estimateTokenCount(additionalContext);

          if (currentTokenCount > maxTokens) {
            return;
          }

          context += additionalContext;
        });
    }
  });

  const questionContext = '[QUESTION]\n\n' + question;
  context += questionContext;
  return context.trim();
};

module.exports = {
  extractTitlesAndContent,
  html2chunks,
  splitLongText,
  cleanHtmlContent,
  simplifyHtml,
  estimateTokenCount,
  OCR_SYSTEM_PROMPT,
  getPDFImages,
  sliceText,
  groupSentences,
  buildPromptFromArticles,
};
