/**
 * 股票实时报价工具
 */
const yahooFinance = require('yahoo-finance2').default;

// 工具描述
const description = '获取股票的实时报价数据';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    symbol: {
      type: 'string',
      description: '股票代码，例如 AAPL（苹果）、MSFT（微软）、BABA（阿里巴巴）等',
    },
    region: {
      type: 'string',
      description: '区域代码，例如 US、HK 等',
      default: 'US',
    },
  },
  required: ['symbol'],
};

// 配置Yahoo Finance API - 防爬虫请求头
const yahooFinanceConfig = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Connection: 'keep-alive',
    'Cache-Control': 'max-age=0',
    Referer: 'https://finance.yahoo.com/',
    Origin: 'https://finance.yahoo.com',
  },
  validation: false, // 禁用结果验证以避免错误
  maxRetries: 3, // 请求失败时重试次数
  timeout: 10000, // 请求超时时间（毫秒）
};

// 抑制Yahoo Finance的问卷调查通知
yahooFinance.suppressNotices(['yahooSurvey']);

// 设置Yahoo Finance默认选项
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
    enabled: false, // 全局禁用验证
    strict: false, // 禁用严格模式
  },
});

// 尝试刷新Yahoo Finance API的crumb和cookie
const refreshCrumbAndCookie = async () => {
  try {
    console.log('尝试刷新Yahoo Finance API的crumb和cookie...');
    // 通过简单请求触发crumb刷新
    const dummyResult = await yahooFinance.search('AAPL');
    console.log('触发crumb刷新成功');
    return true;
  } catch (error) {
    console.error('刷新Yahoo Finance API的crumb失败:', error);
    return false;
  }
};

/**
 * 执行工具
 * @param {Object} params - 调用参数
 * @param {string} params.symbol - 股票代码
 * @param {string} [params.region='US'] - 区域代码
 * @returns {Promise<Object>} 获取结果
 */
async function execute(params = {}) {
  const { symbol, region = 'US' } = params;

  if (!symbol) {
    // 如果没有提供股票代码，返回提示信息
    return {
      error: '缺少必要参数',
      message: '请提供有效的股票代码(symbol)',
      examples: ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'BABA'],
      isExample: true,
    };
  }

  try {
    // 构建请求选项
    const queryOptions = {
      region,
      lang: 'en-US',
      ...yahooFinanceConfig,
    };

    let quoteData;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // 调用Yahoo Finance API获取股票实时报价
        quoteData = await yahooFinance.quote(symbol, queryOptions);
        break; // 成功获取数据，跳出循环
      } catch (error) {
        retryCount++;
        console.log(`获取股票报价失败(尝试 ${retryCount}/${maxRetries}): ${error.message}`);

        // 如果是认证错误，尝试刷新crumb
        if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized') ||
          error.message.includes('Invalid Crumb')
        ) {
          console.log('检测到crumb错误，尝试刷新...');
          await refreshCrumbAndCookie();
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        } else if (retryCount >= maxRetries) {
          // 达到最大重试次数，抛出错误
          throw error;
        } else {
          // 其他错误，等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    if (!quoteData) {
      throw new Error('无法获取股票报价数据');
    }

    // 构建并返回结果
    return {
      symbol: symbol,
      quote: quoteData,
      fetchTime: new Date().toISOString(),
      source: 'Yahoo Finance API',
    };
  } catch (error) {
    console.error(`获取股票${symbol}的实时报价失败:`, error);

    return {
      error: '获取股票报价失败',
      message: error.message,
      symbol: symbol,
    };
  }
}

module.exports = {
  description,
  parameters,
  execute,
};
