/**
 * 股票搜索工具
 */
const yahooFinance = require('yahoo-finance2').default;

// 工具描述
const description = '查找股票代码和基本信息';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: '搜索关键词，可以是公司名称、股票代码或部分匹配',
    },
    limit: {
      type: 'integer',
      description: '返回结果的最大数量',
      minimum: 1,
      maximum: 20,
      default: 5,
    },
    region: {
      type: 'string',
      description: '搜索区域，例如 US、HK、CN 等',
      default: 'US',
    },
  },
  required: ['query'],
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
 * @param {string} params.query - 搜索关键词
 * @param {number} [params.limit=5] - 返回结果的最大数量
 * @param {string} [params.region='US'] - 搜索区域
 * @returns {Promise<Object>} 搜索结果
 */
async function execute(params = {}) {
  const { query, limit = 5, region = 'US' } = params;

  if (!query) {
    // 如果没有提供查询关键词，返回提示信息
    return {
      error: '缺少必要参数',
      message: '请提供搜索关键词(query)',
      examples: ['Apple', 'MSFT', 'Amazon', 'Tesla', 'Google'],
      isExample: true,
    };
  }

  try {
    // 检查参数有效性
    if (limit < 1 || limit > 20) {
      return {
        error: '参数错误',
        message: 'limit参数必须在1-20之间',
        query,
        region,
      };
    }

    // 构建请求选项
    const searchOptions = {
      quotesCount: limit,
      newsCount: 0, // 不需要新闻
      enableFuzzyQuery: true,
      region,
      lang: 'en-US',
      ...yahooFinanceConfig,
    };

    let searchResults;
    let retryCount = 0;
    const maxRetries = 3;

    // 在尝试请求前先刷新一次crumb
    await refreshCrumbAndCookie();

    while (retryCount < maxRetries) {
      try {
        // 调用Yahoo Finance API搜索股票
        searchResults = await yahooFinance.search(query, searchOptions);
        break; // 成功获取数据，跳出循环
      } catch (error) {
        retryCount++;
        console.log(`搜索股票失败(尝试 ${retryCount}/${maxRetries}): ${error.message}`);

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

    if (!searchResults || !searchResults.quotes || searchResults.quotes.length === 0) {
      return {
        query,
        totalResults: 0,
        results: [],
        fetchTime: new Date().toISOString(),
        source: 'Yahoo Finance API',
        message: `未找到与"${query}"匹配的股票`,
      };
    }

    // 对结果进行处理，添加匹配度分数
    const processedResults = searchResults.quotes.map((result, index) => ({
      ...result,
      score: (1 - index * 0.05).toFixed(2), // 简单地根据顺序计算匹配度
    }));

    return {
      query,
      totalResults: processedResults.length,
      results: processedResults,
      fetchTime: new Date().toISOString(),
      source: 'Yahoo Finance API',
    };
  } catch (error) {
    console.error(`搜索股票失败:`, error);

    return {
      error: '搜索失败',
      message: error.message,
      query,
    };
  }
}

module.exports = {
  description,
  parameters,
  execute,
};
