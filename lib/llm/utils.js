const HtmlEntities = require('html-entities');
const sanitizeHtml = require('sanitize-html');
const {RecursiveCharacterTextSplitter} = require('@langchain/textsplitters');
const MAX_SEGMENT_LENGTH = 500;

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

const buildPromptFromArticles = (articles, question, maxTokens) => {
  let context = '[CONTEXT]\n\n';
  let currentTokenCount = estimateTokenCount(context);

  articles.forEach((article) => {
    const articleContext = `# Article: ${article.title} #\nLien: ${article.link}\n`;

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

const loadPrompt = (fileName) => {
  const fs = require('fs-extra');
  const path = require('path');
  return fs
    .readFileSync(path.join(__dirname, '../prompts/', fileName))
    .toString();
};

module.exports = {
  loadPrompt,
  extractTitlesAndContent,
  html2chunks,
  splitLongText,
  cleanHtmlContent,
  simplifyHtml,
  estimateTokenCount,
  buildPromptFromArticles,
};
