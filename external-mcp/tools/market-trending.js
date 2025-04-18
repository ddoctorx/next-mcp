/**
 * 市场热门股票工具
 */
const yahooFinance = require('yahoo-finance2').default;

// 工具描述
const description = '获取市场热门股票和涨跌榜数据';

// 参数定义
const parameters = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      description:
        '要获取的榜单类别: gainers(涨幅榜), losers(跌幅榜), actives(活跃榜), trending(热门股票)',
      enum: ['gainers', 'losers', 'actives', 'trending'],
      default: 'trending',
    },
    region: {
      type: 'string',
      description: '区域代码，例如 US、HK、CN 等',
      default: 'US',
    },
    count: {
      type: 'integer',
      description: '返回的股票数量',
      minimum: 1,
      maximum: 50,
      default: 10,
    },
  },
  required: [],
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
 * 根据榜单类别获取对应的API方法和参数
 */
function getCategoryConfig(category, region, count) {
  const baseOptions = {
    count,
    region,
    lang: 'en-US',
    ...yahooFinanceConfig,
  };

  switch (category) {
    case 'gainers':
      return {
        method: 'dailyGainers',
        options: baseOptions,
      };
    case 'losers':
      return {
        method: 'dailyLosers',
        options: baseOptions,
      };
    case 'actives':
      return {
        method: 'screener',
        options: {
          ...baseOptions,
          scrIds: 'most_actives',
        },
      };
    case 'trending':
      return {
        method: 'trendingSymbols',
        options: baseOptions,
      };
    default:
      return {
        method: 'trendingSymbols',
        options: baseOptions,
      };
  }
}

/**
 * 执行工具
 * @param {Object} params - 调用参数
 * @param {string} [params.category='trending'] - 榜单类别
 * @param {string} [params.region='US'] - 区域代码
 * @param {number} [params.count=10] - 返回数量
 * @returns {Promise<Object>} 获取结果
 */
async function execute(params = {}) {
  const { category = 'trending', region = 'US', count = 10 } = params;

  try {
    // 检查参数有效性
    if (count < 1 || count > 50) {
      return {
        error: '参数错误',
        message: 'count参数必须在1-50之间',
        category,
        region,
      };
    }

    // 获取API配置
    const { method, options } = getCategoryConfig(category, region, count);

    let result;
    let retryCount = 0;
    const maxRetries = 3;

    // 在尝试请求前先刷新一次crumb
    await refreshCrumbAndCookie();

    while (retryCount < maxRetries) {
      try {
        // 调用Yahoo Finance API获取数据
        if (method === 'dailyGainers') {
          result = await yahooFinance.dailyGainers(options);
        } else if (method === 'dailyLosers') {
          result = await yahooFinance.dailyLosers(options);
        } else if (method === 'screener') {
          result = await yahooFinance.screener(options);
        } else if (method === 'trendingSymbols') {
          result = await yahooFinance.trendingSymbols(region, options);
        }

        // 如果成功获取数据，跳出循环
        if (result) break;
      } catch (error) {
        retryCount++;
        console.log(`获取榜单数据失败(尝试 ${retryCount}/${maxRetries}): ${error.message}`);

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

    if (!result) {
      throw new Error(`无法获取${category}榜单数据`);
    }

    // 提取股票列表
    let stockList = [];
    if (result.quotes && Array.isArray(result.quotes)) {
      stockList = result.quotes;
    } else if (result.result && result.result.quotes) {
      stockList = result.result.quotes;
    }

    // 限制返回数量
    stockList = stockList.slice(0, count);

    // 添加榜单位置信息
    stockList = stockList.map((stock, index) => ({
      ...stock,
      rank: index + 1,
    }));

    return {
      category,
      region,
      count: stockList.length,
      stocks: stockList,
      fetchTime: new Date().toISOString(),
      source: 'Yahoo Finance API',
    };
  } catch (error) {
    console.error(`获取${category}榜单失败:`, error);

    return {
      error: '获取市场数据失败',
      message: error.message,
      category,
      region,
    };
  }
}

module.exports = {
  description,
  parameters,
  execute,
};
