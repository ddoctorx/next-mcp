/**
 * 翻译工具
 */

// 工具描述
const description = '将文本在多种语言之间翻译';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: '需要翻译的文本内容',
    },
    sourceLanguage: {
      type: 'string',
      description: "源语言，可以是语言名称(如'中文')或语言代码(如'zh')",
      default: '中文',
    },
    targetLanguage: {
      type: 'string',
      description: "目标语言，可以是语言名称(如'英语')或语言代码(如'en')",
      default: '英语',
    },
  },
  required: ['text'],
};

// 支持的语言
const supportedLanguages = {
  中文: 'zh',
  英语: 'en',
  日语: 'ja',
  韩语: 'ko',
  法语: 'fr',
  德语: 'de',
  西班牙语: 'es',
  俄语: 'ru',
};

// 模拟翻译数据库 - 仅用于演示
const translations = {
  你好: {
    en: 'Hello',
    ja: 'こんにちは',
    ko: '안녕하세요',
    fr: 'Bonjour',
    de: 'Hallo',
    es: 'Hola',
    ru: 'Привет',
  },
  谢谢: {
    en: 'Thank you',
    ja: 'ありがとう',
    ko: '감사합니다',
    fr: 'Merci',
    de: 'Danke',
    es: 'Gracias',
    ru: 'Спасибо',
  },
  再见: {
    en: 'Goodbye',
    ja: 'さようなら',
    ko: '안녕히 가세요',
    fr: 'Au revoir',
    de: 'Auf Wiedersehen',
    es: 'Adiós',
    ru: 'До свидания',
  },
  Hello: {
    zh: '你好',
    ja: 'こんにちは',
    ko: '안녕하세요',
    fr: 'Bonjour',
    de: 'Hallo',
    es: 'Hola',
    ru: 'Привет',
  },
  'Thank you': {
    zh: '谢谢',
    ja: 'ありがとう',
    ko: '감사합니다',
    fr: 'Merci',
    de: 'Danke',
    es: 'Gracias',
    ru: 'Спасибо',
  },
};

/**
 * 生成假翻译 - 用于未知文本
 * @param {string} text 源文本
 * @param {string} targetLang 目标语言代码
 * @returns {string} 翻译后的文本
 */
function generateFakeTranslation(text, targetLang) {
  const langPrefixes = {
    zh: '[中文] ',
    en: '[EN] ',
    ja: '[日本語] ',
    ko: '[한국어] ',
    fr: '[FR] ',
    de: '[DE] ',
    es: '[ES] ',
    ru: '[RU] ',
  };

  return `${langPrefixes[targetLang] || ''}${text}`;
}

/**
 * 执行翻译
 * @param {Object} params - 调用参数
 * @param {string} params.text - 待翻译文本
 * @param {string} params.sourceLanguage - 源语言
 * @param {string} params.targetLanguage - 目标语言
 * @returns {Promise<Object>} 翻译结果
 */
async function execute(params = {}) {
  const { text, sourceLanguage = '中文', targetLanguage = '英语' } = params;

  if (!text) {
    // 如果没有提供文本，返回示例翻译
    return {
      originalText: '你好',
      translatedText: 'Hello',
      sourceLanguage: {
        code: 'zh',
        name: '中文',
      },
      targetLanguage: {
        code: 'en',
        name: '英语',
      },
      confidence: 0.99,
      translationTime: '0.35秒',
      isExample: true,
      note: '这是一个示例翻译，请提供text参数以获取实际翻译',
      supportedLanguages: Object.keys(supportedLanguages).map(name => ({
        name,
        code: supportedLanguages[name],
      })),
    };
  }

  // 获取语言代码
  const sourceLangCode = supportedLanguages[sourceLanguage] || sourceLanguage;
  const targetLangCode = supportedLanguages[targetLanguage] || targetLanguage;

  // 验证语言支持
  if (!Object.values(supportedLanguages).includes(sourceLangCode)) {
    throw new Error(`不支持的源语言: ${sourceLanguage}`);
  }

  if (!Object.values(supportedLanguages).includes(targetLangCode)) {
    throw new Error(`不支持的目标语言: ${targetLanguage}`);
  }

  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  let translatedText;

  // 查找是否有预定义翻译
  if (translations[text] && translations[text][targetLangCode]) {
    translatedText = translations[text][targetLangCode];
  } else {
    // 生成模拟翻译
    translatedText = generateFakeTranslation(text, targetLangCode);
  }

  // 返回结果
  return {
    originalText: text,
    translatedText: translatedText,
    sourceLanguage: {
      code: sourceLangCode,
      name:
        Object.keys(supportedLanguages).find(key => supportedLanguages[key] === sourceLangCode) ||
        sourceLangCode,
    },
    targetLanguage: {
      code: targetLangCode,
      name:
        Object.keys(supportedLanguages).find(key => supportedLanguages[key] === targetLangCode) ||
        targetLangCode,
    },
    confidence: 0.92,
    translationTime: `${(Math.random() * 0.5 + 0.3).toFixed(2)}秒`,
  };
}

module.exports = {
  description,
  parameters,
  execute,
};
