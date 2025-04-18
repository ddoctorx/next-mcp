const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');

// 抑制Yahoo Finance的问卷调查通知
yahooFinance.suppressNotices(['yahooSurvey']);

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

// 设置Yahoo Finance默认选项
yahooFinance.setGlobalConfig({
  validation: {
    logErrors: false,
    logOptionsErrors: false,
    enabled: false, // 添加这一行，全局禁用验证
    strict: false, // 添加这一行，禁用严格模式
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

// 初始化时刷新一次crumb
refreshCrumbAndCookie().then(() => {
  console.log('初始化crumb完成');
});

// 所有可用的模块列表常量 - 在文件顶部添加
const ALL_AVAILABLE_MODULES = [
  'assetProfile',
  'balanceSheetHistory',
  'balanceSheetHistoryQuarterly',
  'calendarEvents',
  'cashflowStatementHistory',
  'cashflowStatementHistoryQuarterly',
  'defaultKeyStatistics',
  'earnings',
  'earningsHistory',
  'earningsTrend',
  'financialData',
  'fundOwnership',
  'fundPerformance',
  'fundProfile',
  'incomeStatementHistory',
  'incomeStatementHistoryQuarterly',
  'indexTrend',
  'industryTrend',
  'insiderHolders',
  'insiderTransactions',
  'institutionOwnership',
  'majorDirectHolders',
  'majorHoldersBreakdown',
  'netSharePurchaseActivity',
  'price',
  'quoteType',
  'recommendationTrend',
  'secFilings',
  'sectorTrend',
  'summaryDetail',
  'summaryProfile',
  'topHoldings',
  'upgradeDowngradeHistory',
];

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 获取DailyGainers的路由
app.get('/api/daily-gainers', async (req, res) => {
  try {
    // 从查询参数获取选项
    const count = parseInt(req.query.count) || 5;
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';

    // 获取每日涨幅最大的股票
    const queryOptions = {
      count,
      region,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      result = await yahooFinance.dailyGainers(queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.dailyGainers(queryOptions);
      } else if (error.message.includes('validation')) {
        // 处理验证错误 - 尝试直接返回原始结果
        console.warn('验证错误，尝试返回原始结果:', error.result || error);
        result = error.result;
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 返回结果
    res.json(result);
  } catch (error) {
    console.error('获取DailyGainers失败:', error);

    // 尝试从错误中提取结果
    if (error.result) {
      console.log('尝试从错误中提取结果并返回');
      return res.json(error.result);
    }

    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取DailyLosers的路由
// app.get('/api/daily-losers', async (req, res) => {
//   try {
//     // 从查询参数获取选项
//     const count = parseInt(req.query.count) || 5;
//     const region = req.query.region || 'US';
//     const lang = req.query.lang || 'en-US';

//     // 获取每日跌幅最大的股票
//     const queryOptions = {
//       count,
//       region,
//       lang,
//       validation: false, // 明确禁用验证
//       ...yahooFinanceConfig, // 添加防爬虫配置
//     };

//     let result;
//     try {
//       result = await yahooFinance.dailyLosers(queryOptions);
//     } catch (error) {
//       // 如果有错误结果，直接使用它
//       if (error.result) {
//         console.log('检测到验证错误，但有结果数据，使用原始结果');
//         result = error.result;
//       } else if (
//         error.message.includes('401') ||
//         error.message.includes('Unauthorized') ||
//         error.message.includes('Invalid Crumb')
//       ) {
//         console.log('检测到crumb错误，尝试刷新...');
//         await refreshCrumbAndCookie();
//         // 重试请求
//         try {
//           result = await yahooFinance.dailyLosers(queryOptions);
//         } catch (retryError) {
//           // 如果重试后仍有验证错误但有结果数据，使用它
//           if (retryError.result) {
//             console.log('重试后仍有验证错误，但有结果数据，使用原始结果');
//             result = retryError.result;
//           } else {
//             throw retryError;
//           }
//         }
//       } else {
//         throw error; // 其他错误直接抛出
//       }
//     }

//     // 返回结果
//     res.json(result);
//   } catch (error) {
//     console.error('获取DailyLosers失败:', error);

//     // 尝试从错误中提取结果
//     if (error.result) {
//       console.log('尝试从错误中提取结果并返回');
//       return res.json(error.result);
//     }

//     res.status(500).json({
//       error: '获取数据失败',
//       message: error.message,
//     });
//   }
// });

// 获取DailyLosers的路由
app.get('/api/daily-losers', async (req, res) => {
  try {
    // 从查询参数获取选项
    const count = parseInt(req.query.count) || 5;
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';

    // 在尝试请求前先刷新一次crumb
    await refreshCrumbAndCookie();

    // 使用screener方法获取每日跌幅最大的股票
    const queryOptions = {
      scrIds: 'day_losers', // 使用day_losers筛选器
      count,
      region,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        result = await yahooFinance.screener(queryOptions);
        // 如果成功，跳出循环
        break;
      } catch (error) {
        retryCount++;

        // 如果有错误结果，直接使用它
        if (error.result) {
          console.log('检测到验证错误，但有结果数据，使用原始结果');
          result = error.result;
          break;
        } else if (
          error.message.includes('401') ||
          error.message.includes('Unauthorized') ||
          error.message.includes('Invalid Crumb')
        ) {
          console.log(`检测到crumb错误，尝试刷新... (尝试 ${retryCount}/${maxRetries})`);
          const refreshed = await refreshCrumbAndCookie();

          if (!refreshed && retryCount === maxRetries) {
            // 如果最后一次刷新失败，直接返回错误
            throw new Error('无法获取有效的Yahoo Finance授权，多次尝试后失败');
          }

          // 增加延迟，避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          // 继续下一次循环尝试
        } else {
          // 其他错误直接抛出
          throw error;
        }
      }
    }

    // 如果达到最大重试次数仍未成功
    if (retryCount === maxRetries && !result) {
      throw new Error('达到最大重试次数，无法获取数据');
    }

    // 返回结果
    res.json(result);
  } catch (error) {
    console.error('获取DailyLosers失败:', error);

    // 尝试从错误中提取结果
    if (error.result) {
      console.log('尝试从错误中提取结果并返回');
      return res.json(error.result);
    }

    // 如果是授权问题，提供更明确的错误信息
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return res.status(503).json({
        error: 'Yahoo Finance API授权问题',
        message: '无法获取数据授权，可能是Yahoo Finance限制了访问',
        suggestion: '您可以稍后再试，或考虑使用其他金融数据来源',
      });
    }

    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票insights分析的路由
app.get('/api/insights/:symbol', async (req, res) => {
  try {
    // 获取股票代码参数
    const symbol = req.params.symbol;

    if (!symbol) {
      return res.status(400).json({
        error: '缺少股票代码参数',
        message: '请提供有效的股票代码',
      });
    }

    // 从查询参数获取选项
    const reportsCount = parseInt(req.query.reportsCount) || 5;
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';

    // 设置查询选项
    const queryOptions = {
      reportsCount,
      region,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 调用Yahoo Finance insights API
      result = await yahooFinance.insights(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.insights(symbol, queryOptions);
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 返回结果
    res.json(result);
  } catch (error) {
    console.error(`获取${req.params.symbol}的Insights失败:`, error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票搜索结果的路由
app.get('/api/search', async (req, res) => {
  try {
    // 获取搜索查询
    const query = req.query.query;

    if (!query) {
      return res.status(400).json({
        error: '缺少搜索查询参数',
        message: '请提供有效的搜索查询',
      });
    }

    // 从查询参数获取选项
    const quotesCount = parseInt(req.query.quotesCount) || 6;
    const newsCount = parseInt(req.query.newsCount) || 4;
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';
    const enableFuzzyQuery = req.query.enableFuzzyQuery === 'true';

    // 设置查询选项 - 只包含 search API 支持的选项
    const queryOptions = {
      quotesCount,
      newsCount,
      enableFuzzyQuery,
    };

    // 设置请求配置 - 分离 API 认证相关配置
    const requestConfig = {
      fetchOptions: yahooFinanceConfig?.fetchOptions, // 如果有 fetch 选项
      // 只保留 yahooFinanceConfig 中必要的认证配置
      cookies: yahooFinanceConfig?.cookies,
      crumb: yahooFinanceConfig?.crumb,
    };

    let result;
    try {
      // 调用Yahoo Finance search API，使用新的配置方式
      result = await yahooFinance.search(query, queryOptions, requestConfig);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求，使用更新后的配置
        result = await yahooFinance.search(query, queryOptions, {
          fetchOptions: yahooFinanceConfig?.fetchOptions,
          cookies: yahooFinanceConfig?.cookies,
          crumb: yahooFinanceConfig?.crumb,
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 返回结果
    res.json(result);
  } catch (error) {
    console.error(`搜索查询失败:`, error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 提供兼容性的autoc端点，但告知已废弃
app.get('/api/autoc', async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({
      error: '缺少搜索查询参数',
      message: '请提供有效的搜索查询',
    });
  }

  try {
    // 调用搜索端点，自动完成功能已被Yahoo废弃
    const searchResult = await yahooFinance.search(query, {
      quotesCount: 5,
      newsCount: 0,
      ...yahooFinanceConfig,
    });

    // 提供一个兼容autoc格式的响应，但添加废弃警告
    const response = {
      deprecationWarning:
        'Yahoo Finance已废弃autoc API，此响应是通过search API模拟的。建议直接使用/api/search端点。',
      Query: query,
      Result: searchResult.quotes.map(quote => ({
        symbol: quote.symbol,
        name: quote.shortname || quote.longname || quote.name || '',
        exch: quote.exchange || '',
        type: quote.quoteType ? quote.quoteType[0] : 'S',
        exchDisp: quote.fullExchangeName || quote.exchDisp || '',
        typeDisp: quote.typeDisp || 'Equity',
      })),
    };

    res.json(response);
  } catch (error) {
    console.error(`Autoc查询失败:`, error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
      deprecationWarning: 'Yahoo Finance已废弃autoc API。请使用/api/search端点替代。',
    });
  }
});

// 获取历史数据的路由
app.get('/api/historical', async (req, res) => {
  try {
    // 从查询参数获取选项
    const symbol = req.query.symbol;
    const period1 = req.query.period1 || '2020-01-01'; // 默认从2020年开始
    const period2 = req.query.period2 || new Date().toISOString().split('T')[0]; // 默认到今天
    const interval = req.query.interval || '1d'; // 默认日数据
    const events = req.query.events || 'history'; // 默认历史价格数据

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 验证interval参数
    if (!['1d', '1wk', '1mo'].includes(interval)) {
      return res.status(400).json({
        error: '参数错误',
        message: 'interval参数必须是 1d, 1wk 或 1mo 之一',
      });
    }

    // 验证events参数
    if (!['history', 'dividends', 'split'].includes(events)) {
      return res.status(400).json({
        error: '参数错误',
        message: 'events参数必须是 history, dividends 或 split 之一',
      });
    }

    // 构建请求选项
    const queryOptions = {
      period1,
      period2,
      interval,
      events,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取历史数据
      result = await yahooFinance.historical(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.historical(symbol, queryOptions);
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的历史数据`,
      });
    }

    // 返回结果
    res.json({
      symbol,
      period1,
      period2,
      interval,
      events,
      data: result,
    });
  } catch (error) {
    console.error('获取历史数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取图表数据的路由
app.get('/api/chart', async (req, res) => {
  try {
    // 从查询参数获取选项
    const symbol = req.query.symbol;
    const period1 = req.query.period1 || '2020-01-01'; // 默认从2020年开始
    const period2 = req.query.period2 || new Date().toISOString().split('T')[0]; // 默认到今天
    const interval = req.query.interval || '1d'; // 默认日数据
    const includePrePost = req.query.includePrePost === 'true'; // 是否包含盘前盘后数据
    const events = req.query.events || ''; // 事件，如 'div,split'
    const returnFormat = req.query.return || 'array'; // 返回格式，array 或 object

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 验证interval参数
    const validIntervals = [
      '1m',
      '2m',
      '5m',
      '15m',
      '30m',
      '60m',
      '90m',
      '1h',
      '1d',
      '5d',
      '1wk',
      '1mo',
      '3mo',
    ];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: '参数错误',
        message: `interval参数必须是以下之一: ${validIntervals.join(', ')}`,
      });
    }

    // 验证return参数
    if (!['array', 'object'].includes(returnFormat)) {
      return res.status(400).json({
        error: '参数错误',
        message: 'return参数必须是 array 或 object',
      });
    }

    // 构建请求选项
    const queryOptions = {
      period1,
      period2,
      interval,
      includePrePost,
      events,
      return: returnFormat,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取图表数据
      result = await yahooFinance.chart(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.chart(symbol, queryOptions);
      } else {
        // 处理时间间隔限制错误（分钟级数据只能获取最近60天的）
        if (error.message && error.message.includes('must be within the last 60 days')) {
          return res.status(400).json({
            error: '时间范围错误',
            message: '分钟级数据 (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h) 只能获取最近60天的数据',
          });
        }
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result || (returnFormat === 'array' && result.quotes && result.quotes.length === 0)) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的图表数据`,
      });
    }

    // 返回结果
    res.json({
      symbol,
      period1,
      period2,
      interval,
      includePrePost,
      events,
      returnFormat,
      data: result,
    });
  } catch (error) {
    console.error('获取图表数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取期权数据的路由
app.get('/api/options', async (req, res) => {
  try {
    // 从查询参数获取选项
    const symbol = req.query.symbol;
    const date = req.query.date; // 可选的到期日期
    const formatted = req.query.formatted === 'true'; // 是否格式化数据
    const lang = req.query.lang || 'en-US';
    const region = req.query.region || 'US';

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 构建请求选项
    const queryOptions = {
      formatted,
      lang,
      region,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    // 如果提供了日期参数，添加到请求选项中
    if (date) {
      queryOptions.date = date;
    }

    let result;
    try {
      // 获取期权数据
      result = await yahooFinance.options(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.options(symbol, queryOptions);
      } else if (error.message && error.message.includes('Unsupported date type')) {
        // 处理日期格式错误
        return res.status(400).json({
          error: '日期格式错误',
          message: '提供的日期格式无效，请使用YYYY-MM-DD格式或UNIX时间戳',
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理结果为空的情况
    if (!result || !result.options || result.options.length === 0) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的期权数据`,
      });
    }

    // 添加元数据
    const responseData = {
      symbol,
      date: date || 'all',
      formatted,
      data: result,
    };

    // 提取并简化到期日期列表（使结果更易读）
    const expirationDates = result.expirationDates.map(
      date => new Date(date).toISOString().split('T')[0],
    );

    responseData.availableExpirationDates = expirationDates;

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取期权数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票报价数据的路由
app.get('/api/quote', async (req, res) => {
  try {
    // 获取查询参数
    let symbols = req.query.symbols || req.query.symbol;
    const returnFormat = req.query.return || 'default'; // 返回格式
    const fieldsParam = req.query.fields; // 字段列表，逗号分隔

    // 验证必要参数
    if (!symbols) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol 或 symbols)',
      });
    }

    // 处理字段列表
    let fields = undefined;
    if (fieldsParam) {
      fields = fieldsParam.split(',').map(field => field.trim());
    }

    // 处理股票代码列表
    let isArray = false;
    if (typeof symbols === 'string' && symbols.includes(',')) {
      symbols = symbols.split(',').map(s => s.trim());
      isArray = true;
    } else if (Array.isArray(symbols)) {
      isArray = true;
    }

    // 验证return格式参数
    if (!['default', 'array', 'object', 'map'].includes(returnFormat)) {
      return res.status(400).json({
        error: '参数错误',
        message: 'return参数必须是 default, array, object 或 map 之一',
      });
    }

    // 构建请求选项
    const queryOptions = {
      fields,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    // 如果不是默认返回格式，则添加返回格式参数
    if (returnFormat !== 'default') {
      queryOptions.return = returnFormat;
    }

    let result;
    try {
      // 获取报价数据
      result = await yahooFinance.quote(symbols, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.quote(symbols, queryOptions);
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果或未找到的情况
    if (result === undefined || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到指定股票代码的报价数据`,
      });
    }

    // 构建响应
    const responseData = {
      symbols: isArray ? symbols : symbols,
      returnFormat,
      fields: fields || 'all',
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取报价数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票摘要数据的路由
app.get('/api/quote-summary', async (req, res) => {
  try {
    // 获取查询参数
    const symbol = req.query.symbol;
    const modulesParam = req.query.modules;
    const formatted = req.query.formatted === 'true';

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 验证modules参数
    if (!modulesParam) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供需要获取的模块 (modules)',
      });
    }

    // 处理modules参数
    // 可以是逗号分隔的模块列表或特殊值"all"
    let modules;
    if (modulesParam === 'all') {
      modules = 'all';
    } else {
      modules = modulesParam.split(',').map(m => m.trim());

      // 验证模块名称是否有效
      const validModules = [
        'assetProfile',
        'balanceSheetHistory',
        'balanceSheetHistoryQuarterly',
        'calendarEvents',
        'cashflowStatementHistory',
        'cashflowStatementHistoryQuarterly',
        'defaultKeyStatistics',
        'earnings',
        'earningsHistory',
        'earningsTrend',
        'financialData',
        'fundOwnership',
        'fundPerformance',
        'fundProfile',
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'indexTrend',
        'industryTrend',
        'insiderHolders',
        'insiderTransactions',
        'institutionOwnership',
        'majorDirectHolders',
        'majorHoldersBreakdown',
        'netSharePurchaseActivity',
        'price',
        'quoteType',
        'recommendationTrend',
        'secFilings',
        'sectorTrend',
        'summaryDetail',
        'summaryProfile',
        'topHoldings',
        'upgradeDowngradeHistory',
      ];

      const invalidModules = modules.filter(m => !validModules.includes(m));
      if (invalidModules.length > 0) {
        return res.status(400).json({
          error: '参数错误',
          message: `无效的模块名称: ${invalidModules.join(', ')}`,
        });
      }
    }

    // 构建请求选项
    const queryOptions = {
      modules,
      formatted,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取股票摘要数据
      result = await yahooFinance.quoteSummary(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.quoteSummary(symbol, queryOptions);
      } else if (error.message && error.message.includes('No fundamentals data found')) {
        // 处理没有基础数据的情况
        return res.status(404).json({
          error: '未找到数据',
          message: `未找到股票代码 ${symbol} 的基础数据`,
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的摘要数据`,
      });
    }

    // 构建响应
    const responseData = {
      symbol,
      modules: typeof modules === 'string' ? modules : modules.join(','),
      formatted,
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取股票摘要数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取基础财务数据时间序列的路由
app.get('/api/fundamentals-time-series', async (req, res) => {
  try {
    // 获取查询参数
    const symbol = req.query.symbol;
    const period1 = req.query.period1 || '2020-01-01'; // 默认从2020年开始
    const period2 = req.query.period2 || new Date().toISOString().split('T')[0]; // 默认到今天
    const type = req.query.type || 'quarterly'; // 默认季度数据
    const module = req.query.module; // 必须提供的模块名称
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    if (!module) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供模块名称 (module)',
      });
    }

    // 验证type参数
    const validTypes = ['quarterly', 'annual', 'trailing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: '参数错误',
        message: `type参数必须是以下之一: ${validTypes.join(', ')}`,
      });
    }

    // 验证module参数
    const validModules = ['financials', 'balance-sheet', 'cash-flow', 'all'];
    if (!validModules.includes(module)) {
      return res.status(400).json({
        error: '参数错误',
        message: `module参数必须是以下之一: ${validModules.join(', ')}`,
      });
    }

    // 构建请求选项
    const queryOptions = {
      period1,
      period2,
      type,
      module,
      region,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取基础财务数据时间序列
      result = await yahooFinance.fundamentalsTimeSeries(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.fundamentalsTimeSeries(symbol, queryOptions);
      } else if (error.message && error.message.includes('option type invalid')) {
        return res.status(400).json({
          error: '参数错误',
          message: '无效的type参数',
        });
      } else if (error.message && error.message.includes('option module invalid')) {
        return res.status(400).json({
          error: '参数错误',
          message: '无效的module参数',
        });
      } else if (
        error.message &&
        error.message.includes('period1 and period2 cannot share the same value')
      ) {
        return res.status(400).json({
          error: '参数错误',
          message: 'period1和period2不能是相同的日期',
        });
      } else if (error.message && error.message.includes('invalid date provided')) {
        return res.status(400).json({
          error: '参数错误',
          message: '提供的日期格式无效',
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的财务数据时间序列`,
      });
    }

    // 构建响应
    const responseData = {
      symbol,
      period1,
      period2,
      type,
      module,
      count: Array.isArray(result) ? result.length : 0,
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取基础财务数据时间序列失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票推荐的路由
app.get('/api/recommendations-by-symbol', async (req, res) => {
  try {
    // 获取查询参数
    let symbols = req.query.symbols || req.query.symbol;

    // 验证必要参数
    if (!symbols) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol 或 symbols)',
      });
    }

    // 处理股票代码列表
    let isArray = false;
    if (typeof symbols === 'string' && symbols.includes(',')) {
      symbols = symbols.split(',').map(s => s.trim());
      isArray = true;
    } else if (Array.isArray(symbols)) {
      isArray = true;
    }

    // 构建请求选项
    const queryOptions = {
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取股票推荐数据
      result = await yahooFinance.recommendationsBySymbol(symbols, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.recommendationsBySymbol(symbols, queryOptions);
      } else if (error.message && error.message.includes('Unexpected result')) {
        return res.status(404).json({
          error: '未找到数据',
          message: '无法获取推荐数据，可能是提供的股票代码无效',
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到相关推荐股票`,
      });
    }

    // 构建响应
    const responseData = {
      symbols: isArray ? symbols : symbols,
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取股票推荐失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取合并股票报价数据的路由
app.get('/api/quote-combine', async (req, res) => {
  try {
    // 获取查询参数
    const symbol = req.query.symbol;
    const fieldsParam = req.query.fields; // 字段列表，逗号分隔

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 处理字段列表
    let fields = undefined;
    if (fieldsParam) {
      fields = fieldsParam.split(',').map(field => field.trim());
    }

    // 构建请求选项
    const queryOptions = {
      fields,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取合并报价数据
      result = await yahooFinance.quoteCombine(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.quoteCombine(symbol, queryOptions);
      } else if (error.message && error.message.includes('expects a string query parameter')) {
        return res.status(400).json({
          error: '参数错误',
          message: 'quoteCombine 只接受单个股票代码作为参数',
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理未找到的情况
    if (result === undefined) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的报价数据`,
      });
    }

    // 构建响应
    const responseData = {
      symbol,
      fields: fields || 'all',
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取合并报价数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取热门股票的路由
app.get('/api/trending/:region', async (req, res) => {
  try {
    // 获取region路径参数
    const region = req.params.region;

    if (!region) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供地区代码 (region)',
      });
    }

    // 获取查询参数
    const count = parseInt(req.query.count) || 5;
    const lang = req.query.lang || 'en-US';

    // 构建请求选项
    const queryOptions = {
      count,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取热门股票数据
      result = await yahooFinance.trendingSymbols(region, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.trendingSymbols(region, queryOptions);
      } else if (error.message && error.message.includes('Unexpected result')) {
        return res.status(404).json({
          error: '未找到数据',
          message: `未找到地区 ${region} 的热门股票数据`,
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result || !result.quotes || result.quotes.length === 0) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到地区 ${region} 的热门股票数据`,
      });
    }

    // 构建响应
    const responseData = {
      region,
      count: result.quotes.length,
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取热门股票失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取股票筛选器数据的路由
app.get('/api/screener', async (req, res) => {
  try {
    // 获取查询参数
    const scrIds = req.query.scrIds || 'day_gainers'; // 默认筛选器类型为日涨幅最大
    const count = parseInt(req.query.count) || 5; // 默认返回5条记录
    const region = req.query.region || 'US';
    const lang = req.query.lang || 'en-US';

    // 验证筛选器类型
    const validScreeners = [
      'aggressive_small_caps',
      'conservative_foreign_funds',
      'day_gainers',
      'day_losers',
      'growth_technology_stocks',
      'high_yield_bond',
      'most_actives',
      'most_shorted_stocks',
      'portfolio_anchors',
      'small_cap_gainers',
      'solid_large_growth_funds',
      'solid_midcap_growth_funds',
      'top_mutual_funds',
      'undervalued_growth_stocks',
      'undervalued_large_caps',
    ];

    if (!validScreeners.includes(scrIds)) {
      return res.status(400).json({
        error: '参数错误',
        message: `无效的筛选器类型，有效类型为: ${validScreeners.join(', ')}`,
      });
    }

    // 构建请求选项
    const queryOptions = {
      scrIds,
      count,
      region,
      lang,
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let result;
    try {
      // 获取筛选器数据
      result = await yahooFinance.screener(queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        result = await yahooFinance.screener(queryOptions);
      } else if (error.message && error.message.includes('Unexpected result')) {
        return res.status(404).json({
          error: '未找到数据',
          message: `未找到筛选器 ${scrIds} 的数据`,
        });
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!result || !result.quotes || result.quotes.length === 0) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到筛选器 ${scrIds} 的数据`,
      });
    }

    // 构建响应
    const responseData = {
      screenerId: scrIds,
      count: result.quotes.length,
      title: result.title,
      description: result.description,
      data: result,
    };

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取筛选器数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});

// 获取所有可用模块的接口 - 添加在其他路由后面
app.get('/api/available-modules', (req, res) => {
  try {
    // 从查询参数获取分类参数
    const category = req.query.category;

    // 定义模块分类
    const MODULE_CATEGORIES = {
      profile: ['assetProfile', 'summaryProfile', 'fundProfile', 'quoteType'],
      financial: [
        'balanceSheetHistory',
        'balanceSheetHistoryQuarterly',
        'cashflowStatementHistory',
        'cashflowStatementHistoryQuarterly',
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'financialData',
      ],
      statistics: ['defaultKeyStatistics', 'summaryDetail', 'price', 'netSharePurchaseActivity'],
      earnings: ['earnings', 'earningsHistory', 'earningsTrend', 'calendarEvents'],
      ownership: [
        'fundOwnership',
        'fundPerformance',
        'insiderHolders',
        'insiderTransactions',
        'institutionOwnership',
        'majorDirectHolders',
        'majorHoldersBreakdown',
      ],
      trends: ['indexTrend', 'industryTrend', 'sectorTrend', 'recommendationTrend'],
      etf: ['topHoldings', 'fundProfile', 'fundPerformance'],
      other: ['secFilings', 'upgradeDowngradeHistory'],
    };

    // 如果提供了分类参数，则返回该分类下的模块
    if (category && MODULE_CATEGORIES[category]) {
      return res.json({
        category,
        modules: MODULE_CATEGORIES[category],
        total: MODULE_CATEGORIES[category].length,
      });
    }

    // 如果请求所有分类，则返回分类结构
    if (category === 'all-categories') {
      return res.json({
        categories: Object.keys(MODULE_CATEGORIES),
        modulesByCategory: MODULE_CATEGORIES,
      });
    }

    // 默认返回所有模块的完整列表
    res.json({
      total: ALL_AVAILABLE_MODULES.length,
      modules: ALL_AVAILABLE_MODULES,
      categories: Object.keys(MODULE_CATEGORIES),
      note: '使用 ?category=名称 参数获取特定分类的模块，例如 ?category=financial',
    });
  } catch (error) {
    console.error('获取可用模块列表失败:', error);
    res.status(500).json({
      error: '获取模块列表失败',
      message: error.message,
    });
  }
});

// 获取股票所有模块数据的路由
app.get('/api/quote-summary-all', async (req, res) => {
  try {
    // 获取查询参数
    const symbol = req.query.symbol;
    const formatted = req.query.formatted === 'true';

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    console.log(`开始获取 ${symbol} 的所有模块数据...`);

    // 尝试获取数据的函数
    const fetchModuleData = async moduleNames => {
      // 这里使用一个特殊的方法创建自定义选项，确保完全禁用验证
      const customOptions = {
        modules: moduleNames,
        formatted,
        validation: {
          enabled: false, // 明确禁用验证
          logErrors: false,
          strict: false,
        },
        // 添加防爬虫配置
        headers: yahooFinanceConfig.headers,
        maxRetries: yahooFinanceConfig.maxRetries,
        timeout: yahooFinanceConfig.timeout,
      };

      // 使用更强的配置来禁用验证
      yahooFinance.setGlobalConfig({
        validation: {
          enabled: false,
          logErrors: false,
          strict: false,
        },
      });

      try {
        return await yahooFinance.quoteSummary(symbol, customOptions);
      } catch (error) {
        // 如果错误中包含原始结果，尝试使用它
        if (error.result) {
          console.log('获取到带有验证错误的结果，尝试使用原始结果');
          return error.result;
        }
        throw error;
      }
    };

    // 分批获取模块数据，以避免一次性请求过多模块导致验证错误
    const fetchInBatches = async () => {
      // 每批请求的模块数量
      const BATCH_SIZE = 5;

      // 将所有模块分成小批次
      const batches = [];
      for (let i = 0; i < ALL_AVAILABLE_MODULES.length; i += BATCH_SIZE) {
        batches.push(ALL_AVAILABLE_MODULES.slice(i, i + BATCH_SIZE));
      }

      console.log(`将 ${ALL_AVAILABLE_MODULES.length} 个模块分成 ${batches.length} 个批次获取`);

      // 存储所有获取到的数据
      const aggregatedData = {};
      const failedModules = [];

      // 逐批获取数据
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`获取第 ${i + 1}/${batches.length} 批模块数据: ${batch.join(', ')}`);

        try {
          // 请求这一批模块
          const batchResult = await fetchModuleData(batch);

          // 合并结果
          if (batchResult) {
            Object.keys(batchResult).forEach(key => {
              aggregatedData[key] = batchResult[key];
            });
            console.log(
              `成功获取第 ${i + 1} 批数据，包含 ${Object.keys(batchResult).length} 个模块`,
            );
          }
        } catch (error) {
          console.error(`获取第 ${i + 1} 批数据失败:`, error.message);
          // 记录失败的模块
          failedModules.push(...batch);

          // 短暂延迟，避免连续失败请求
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return { aggregatedData, failedModules };
    };

    // 首先尝试使用 'all' 一次性获取所有数据
    let result;
    let failedModules = [];

    console.log(`尝试使用 'all' 标识符一次性获取所有模块...`);
    try {
      result = await fetchModuleData('all');
      console.log(`使用 'all' 标识符成功获取数据，包含 ${Object.keys(result).length} 个模块`);
    } catch (error) {
      console.log(`使用 'all' 标识符失败: ${error.message}`);
      console.log(`切换到分批获取模式...`);

      // 如果 'all' 失败，切换到分批获取模式
      const batchResult = await fetchInBatches();
      result = batchResult.aggregatedData;
      failedModules = batchResult.failedModules;

      console.log(
        `分批获取完成，共获取到 ${Object.keys(result).length} 个模块，${
          failedModules.length
        } 个模块失败`,
      );
    }

    // 处理空结果
    if (!result || Object.keys(result).length === 0) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的摘要数据`,
      });
    }

    // 计算获取的模块数量和模块列表
    const obtainedModules = Object.keys(result).filter(
      key => result[key] !== null && result[key] !== undefined,
    );

    // 构建响应
    const responseData = {
      symbol,
      formatted,
      obtainedModules,
      totalModules: obtainedModules.length,
      data: result,
    };

    // 如果有失败的模块，添加到响应中
    if (failedModules.length > 0) {
      responseData.failedModules = failedModules;
      responseData.failedCount = failedModules.length;
      responseData.note = '某些模块未能获取，这可能是因为数据不可用或API限制';
    }

    // 返回结果
    res.json(responseData);
  } catch (error) {
    console.error('获取股票所有模块数据失败:', error);

    // 提供更详细的错误信息
    const errorMessage = error.response
      ? `服务器返回: ${error.response.status} ${error.response.statusText}`
      : error.message;

    res.status(500).json({
      error: '获取数据失败',
      message: errorMessage,
      suggestion: '请尝试减少请求的模块数量，或单独请求特定模块',
    });
  }
});

// 服务器健康检查端点
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`访问 http://localhost:${PORT}/api/daily-gainers 获取每日涨幅最大的股票`);
  console.log(`访问 http://localhost:${PORT}/api/daily-losers 获取每日跌幅最大的股票`);
  console.log(`访问 http://localhost:${PORT}/api/trending/US 获取美国市场热门股票`);
  console.log(`访问 http://localhost:${PORT}/api/historical?symbol=AAPL 获取Apple股票的历史数据`);
  console.log(`访问 http://localhost:${PORT}/api/chart?symbol=AAPL 获取Apple股票的图表数据`);
  console.log(`访问 http://localhost:${PORT}/api/options?symbol=AAPL 获取Apple股票的期权数据`);
  console.log(`访问 http://localhost:${PORT}/api/quote?symbol=AAPL 获取Apple股票的实时报价数据`);
  console.log(
    `访问 http://localhost:${PORT}/api/quote-combine?symbol=AAPL 获取Apple股票的合并报价数据`,
  );
  console.log(`访问 http://localhost:${PORT}/api/search?query=AAPL 获取AAPL相关的搜索结果`);
  console.log(`访问 http://localhost:${PORT}/api/autoc?query=AAPL 获取AAPL的自动完成结果(已废弃)`);
  console.log(
    `访问 http://localhost:${PORT}/api/recommendations-by-symbol?symbols=AAPL,TSLA 获取AAPL和TSLA的推荐股票`,
  );
  console.log(
    `访问 http://localhost:${PORT}/api/quote-summary?symbol=AAPL&modules=price,summaryDetail 获取Apple股票的详细摘要数据`,
  );
  console.log(
    `访问 http://localhost:${PORT}/api/screener?scrIds=most_actives 获取交易最活跃的股票`,
  );
  console.log(`访问 http://localhost:${PORT}/api/insights/AAPL 获取Apple股票的insights分析`);
  console.log(
    `访问 http://localhost:${PORT}/api/fundamentals-time-series?symbol=AAPL&module=financials 获取Apple的财务时间序列数据`,
  );
  console.log(`访问 http://localhost:${PORT}/api/available-modules 获取所有可用的模块列表`);
  console.log(
    `访问 http://localhost:${PORT}/api/available-modules?category=financial 获取财务类模块`,
  );
  console.log(
    `访问 http://localhost:${PORT}/api/quote-summary-all?symbol=AAPL 获取Apple股票的所有可用模块数据`,
  );
  console.log(`访问 http://localhost:${PORT}/health 检查服务器健康状态`);
});

// 获取股票成交量数据的路由
app.get('/api/volume', async (req, res) => {
  try {
    // 从查询参数获取选项
    const symbol = req.query.symbol;
    const interval = req.query.interval || '1d'; // 默认日数据，支持15m、1h和1d
    const days = parseInt(req.query.days) || 30; // 默认获取30天的数据

    // 计算开始日期
    const period2 = new Date(); // 当前日期作为结束日期
    const period1 = new Date();
    period1.setDate(period1.getDate() - days); // 开始日期为当前日期减去指定天数

    // 验证必要参数
    if (!symbol) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '请提供股票代码 (symbol)',
      });
    }

    // 验证interval参数
    const validIntervals = ['15m', '1h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: '参数错误',
        message: `interval参数必须是以下之一: ${validIntervals.join(', ')}`,
      });
    }

    // 对于分钟数据，限制只能获取最近60天的数据
    if ((interval === '15m' || interval === '1h') && days > 60) {
      return res.status(400).json({
        error: '时间范围错误',
        message: '分钟级数据 (15m, 1h) 只能获取最近60天的数据',
      });
    }

    // 构建请求选项 - 根据yahoo-finance2库的要求格式化
    const queryOptions = {
      period1: period1,
      period2: period2,
      interval: interval,
      includePrePost: true,
      return: 'array', // 使用array格式便于处理
      validation: false, // 明确禁用验证
      ...yahooFinanceConfig, // 添加防爬虫配置
    };

    let chartData;
    try {
      // 获取图表数据
      chartData = await yahooFinance.chart(symbol, queryOptions);
    } catch (error) {
      // 如果出现Invalid Crumb或Unauthorized错误，尝试刷新crumb
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Invalid Crumb')
      ) {
        console.log('检测到crumb错误，尝试刷新...');
        await refreshCrumbAndCookie();
        // 重试请求
        chartData = await yahooFinance.chart(symbol, queryOptions);
      } else {
        throw error; // 其他错误直接抛出
      }
    }

    // 处理空结果
    if (!chartData || !chartData.quotes || chartData.quotes.length === 0) {
      return res.status(404).json({
        error: '未找到数据',
        message: `未找到股票代码 ${symbol} 的成交量数据`,
      });
    }

    // 提取成交量数据
    const volumeData = chartData.quotes.map(quote => ({
      date: quote.date,
      volume: quote.volume,
      // 添加其他可能有用的数据
      timestamp: quote.date.getTime(),
      high: quote.high,
      low: quote.low,
      open: quote.open,
      close: quote.close,
    }));

    // 计算总成交量和平均成交量
    const totalVolume = volumeData.reduce((sum, item) => sum + (item.volume || 0), 0);
    const avgVolume = totalVolume / volumeData.filter(item => item.volume !== null).length;

    // 返回结果
    res.json({
      symbol,
      interval,
      days,
      period1: period1.toISOString().split('T')[0],
      period2: period2.toISOString().split('T')[0],
      volumeData,
      meta: {
        totalVolume,
        avgVolume,
        dataPoints: volumeData.length,
        currency: chartData.meta.currency,
        exchangeName: chartData.meta.exchangeName,
      },
    });
  } catch (error) {
    console.error('获取成交量数据失败:', error);
    res.status(500).json({
      error: '获取数据失败',
      message: error.message,
    });
  }
});
