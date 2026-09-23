//@name:[盘] TG搜²·PikPak
//@version:91
//@webSite:豆儿盘@douerpan&豆儿123@zyfb123&天翼日更@tianyirigeng&天翼臻影@tyysypzypd&百度@bdwpzhpd&夸克百度@Aliyun_4K_Movies&夸克UC@ucquark&夸克电影@Q_dianying&夸克剧集@Q_dianshiju&夸克动漫@Q_dongman
//@env:TG搜API地址##https://tgsou.252035.xyz
//@remark:🍃豆儿出品，不属精品！免代理纯搜索，格式 频道名称@频道id|搜索数量&频道名称@频道id，支持自定义每频道搜索数量，默认3个
//@order: A18

// ignore
// 不支持导入，这里只是本地开发用于代码提示
// 如需添加通用依赖，请联系 https://t.me/uzVideoAppbot
import {
    FilterLabel,
    FilterTitle,
    VideoClass,
    VideoSubclass,
    VideoDetail,
    RepVideoClassList,
    RepVideoSubclassList,
    RepVideoList,
    RepVideoDetail,
    RepVideoPlayUrl,
    UZArgs,
    UZSubclassVideoListArgs,
} from '../../core/core/uzVideo.js'

import {
    UZUtils,
    ProData,
    ReqResponseType,
    ReqAddressType,
    req,
    getEnv,
    setEnv,
    goToVerify,
    openWebToBindEnv,
    toast,
    kIsDesktop,
    kIsAndroid,
    kIsIOS,
    kIsWindows,
    kIsMacOS,
    kIsTV,
    kLocale,
    kAppVersion,
    formatBackData,
} from '../../core/core/uzUtils.js'

import { cheerio, Crypto, Encrypt, JSONbig } from '../../core/core/uz3lib.js'
// ignore

const appConfig = {
    _webSite: '豆儿盘@douerpan&豆儿123@zyfb123&天翼日更@tianyirigeng&天翼臻影@tyysypzypd&百度@bdwpzhpd&夸克百度@Aliyun_4K_Movies&夸克UC@ucquark&夸克电影@Q_dianying&夸克剧集@Q_dianshiju&夸克动漫@Q_dongman',
    /**
     * 网站主页，uz 调用每个函数前都会进行赋值操作
     * 如果不想被改变 请自定义一个变量
     */
    get webSite() {
        return this._webSite
    },
    set webSite(value) {
        this._webSite = value
    },

    // TG搜索API地址，替代原来的 t.me/s/
    tgs: 'https://tgsou.252035.xyz',

    _uzTag: '',
    /**
     * 扩展标识，初次加载时，uz 会自动赋值，请勿修改
     * 用于读取环境变量
     */
    get uzTag() {
        return this._uzTag
    },
    set uzTag(value) {
        this._uzTag = value
    },
}

// --- 全局常量/配置 ---
// 统一的网盘配置 - UZ应用兼容的网盘
const CLOUD_PROVIDERS = {
    tianyi: {
        name: '天翼',
        domains: ['189.cn']
    },
    quark: {
        name: '夸克',
        domains: ['pan.quark.cn']
    },
    uc: {
        name: 'UC',
        domains: ['drive.uc.cn']
    },
    baidu: {
        name: '百度',
        domains: ['pan.baidu.com', 'yun.baidu.com']
    },
    pan123: {
        name: '123',
        domains: ['123pan.com', '123pan.cn', '123684.com', '123912.com', '123865.com']
    },
    yidong: {
        name: '移动',
        domains: ['caiyun.139.com', 'yun.139.com']
    },
    '115': {
        name: '115',
        domains: ['115cdn.com', '115.com', 'anxia.com']
    },
    pikpak: {
        name: 'PikPak',
        // 原版只有 'pikpak.me'（该域名对真实分享链接无效），
        // PikPak 官方分享链接格式是 https://mypikpak.com/s/xxxx，必须补上 mypikpak.com
        domains: ['pikpak.me', 'mypikpak.com', 'mypikpak.net']
    }
};

// 从统一配置自动生成所需数组
const panUrlsExt = Object.values(CLOUD_PROVIDERS).flatMap(provider => provider.domains);

// 域名匹配的「边界」写法：
// 左侧不能紧邻字母/数字/点/横线，右侧同理。
// 目的：补上 mypikpak.com 之后，不会把 mypikpak.com.cn、xxmypikpak.com 这类
// 完全不相干的域名也当成 PikPak（原版用 includes 裸匹配，没有这层保护）。
function domainHitSource(domain) {
    return '(?:^|[^\\w-])' + domain.replace(/\./g, '\\.') + '(?![\\w.-])';
}

// 预编译「是否网盘链接」的正则（与 panUrlsExt 一一对应）
const panUrlHitRegexList = panUrlsExt.map(d => new RegExp(domainHitSource(d), 'i'));

// 预编译网盘提供商正则表达式，提高匹配性能
const providerRegexMap = Object.values(CLOUD_PROVIDERS).map(provider => ({
    name: provider.name,
    // 将多个域名组合成一个正则，用 | 分隔，转义点号
    regex: new RegExp(provider.domains.map(domain =>
        domainHitSource(domain)
    ).join('|'), 'i')
}));

// 预编译剧集信息提取正则表达式
const EPISODE_COMBINED_REGEX = /((?:更新至|全|第)\s*\d+\s*集)|((?:更新至|全|第)\s*[一二三四五六七八九十百千万亿]+\s*集)|((?:更至|更)\s*(?:EP)?\s*\d+)/;

/**
 * 异步获取分类列表的方法。
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoClassList())>}
 */
async function getClassList(args) {
    var backData = new RepVideoClassList()
    try {
        // 纯搜索版本，不提供分类功能
        // 返回空分类列表
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取二级分类列表筛选列表的方法。
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoSubclassList())>}
 */
async function getSubclassList(args) {
    var backData = new RepVideoSubclassList()
    try {
        // 纯搜索版本，不提供二级分类功能
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取分类视频列表
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function getVideoList(args) {
    var backData = new RepVideoList()
    try {
        // 纯搜索版本，不提供分类浏览功能
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取二级分类视频列表 或 筛选视频列表
 * @param {UZSubclassVideoListArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function getSubclassVideoList(args) {
    var backData = new RepVideoList()
    try {
        // 纯搜索版本，不提供筛选功能
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取视频详情
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoDetail())>}
 */
async function getVideoDetail(args) {
    var backData = new RepVideoDetail()
    try {
        backData.data = {
            panUrls: JSON.parse(args.url),
        }
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 获取视频的播放地址
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoPlayUrl())>}
 */
async function getVideoPlayUrl(args) {
    var backData = new RepVideoPlayUrl()
    try {
        // 纯搜索版本，不提供播放功能
    } catch (error) {
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 解析频道配置，支持自定义搜索数量
 * @param {string} webSite - 配置字符串
 * @returns {Array} 频道配置数组
 */
function parseChannelConfig(webSite) {
    const channels = []
    const items = webSite.split('&')

    for (const item of items) {
        if (!item.trim()) continue

        const parts = item.split('@')
        if (parts.length < 2) continue

        const channelName = parts[0].trim()
        const channelIdAndCount = parts[1].trim()

        // 检查是否有自定义数量 (使用 | 分隔符)
        let channelId, count = 3 // 默认数量为3

        if (channelIdAndCount.includes('|')) {
            const idCountParts = channelIdAndCount.split('|')
            channelId = idCountParts[0].trim()
            const customCount = parseInt(idCountParts[1])
            if (!isNaN(customCount) && customCount > 0) {
                count = customCount
            }
        } else {
            channelId = channelIdAndCount
        }

        channels.push({
            name: channelName,
            id: channelId,
            count: count
        })
    }

    return channels
}

/**
 * 搜索视频 - 核心功能
 * @param {UZArgs} args
 * @returns {@Promise<JSON.stringify(new RepVideoList())>}
 */
async function searchVideo(args) {
    var backData = new RepVideoList()
    try {
        // 获取环境变量中的API地址
        var tgsApi = await getEnv(appConfig.uzTag, "TG搜API地址")
        if (tgsApi && tgsApi.length > 0) {
            appConfig.tgs = tgsApi
        }

        // 解析频道配置
        const channels = parseChannelConfig(appConfig.webSite)

        if (channels.length === 0) {
            console.log('没有有效的频道配置')
            return JSON.stringify(backData)
        }

        console.log('频道配置:', channels)

        // 创建频道限制映射
        const channelLimits = {}
        channels.forEach(channel => {
            channelLimits[channel.id] = channel.count
        })

        // 🚀 并发优化：同时搜索所有频道
        const searchPromises = channels.map(async (channel) => {
            try {
                // 构建单个频道的搜索API请求URL
                // 🖼️ 测试启用图片功能
                const searchUrl = `${appConfig.tgs}?pic=true&count=${channel.count}&channelUsername=${encodeURIComponent(channel.id)}&keyword=${encodeURIComponent(args.searchWord)}`

                console.log(`搜索频道 ${channel.name}(${channel.id}) 数量:${channel.count}`)
                console.log('搜索URL:', searchUrl)

                // 调用TG搜索API
                const res = await req(searchUrl)

                if (res.data && res.data.results) {
                    // 解析API返回的数据，传递频道限制
                    const videoList = parseAPIResults(res.data.results, args.searchWord, channelLimits)
                    return {
                        channel: channel.name,
                        videoList: videoList,
                        success: true
                    }
                }

                return {
                    channel: channel.name,
                    videoList: [],
                    success: true
                }

            } catch (channelError) {
                console.error(`频道 ${channel.name} 搜索失败:`, channelError)
                return {
                    channel: channel.name,
                    videoList: [],
                    success: false,
                    error: channelError.message
                }
            }
        })

        // 🚀 并发执行所有搜索请求，设置10秒超时（API请求可能比直接访问慢）
        const results = await Promise.allSettled(
            searchPromises.map(promise =>
                Promise.race([
                    promise,
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('API请求超时')), 10000)
                    )
                ])
            )
        )

        // 处理并发结果
        const allVideoLists = []
        let successCount = 0
        let failCount = 0

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                allVideoLists.push(...result.value.videoList)
                successCount++
                console.log(`频道 ${result.value.channel} 搜索成功，获得 ${result.value.videoList.length} 个结果`)
            } else {
                failCount++
                const channelName = channels[index]?.name || '未知频道'
                if (result.status === 'rejected') {
                    console.error(`频道 ${channelName} 请求失败:`, result.reason?.message || result.reason)
                } else {
                    console.error(`频道 ${channelName} 搜索失败:`, result.value?.error || '未知错误')
                }
            }
        })

        console.log(`搜索完成: 成功 ${successCount} 个频道，失败 ${failCount} 个频道`)

        // 合并所有结果并去重
        backData.data = deduplicateVideoListByLinks(allVideoLists)

        console.log(`总共获取到 ${backData.data.length} 个去重后的结果`)

    } catch (error) {
        console.error('搜索错误:', error)
        backData.error = error.toString()
    }
    return JSON.stringify(backData)
}

/**
 * 解析TG搜索API返回的结果
 * @param {Array} results - API返回的results数组
 * @param {string} searchWord - 搜索关键词
 * @param {Object} channelLimits - 频道限制映射 {channelId: count}
 * @returns {Array} 视频列表
 */
function parseAPIResults(results, searchWord, channelLimits = {}) {
    const videoList = []

    // 创建频道名称映射 - 使用新的解析逻辑
    const channelMap = new Map()
    const channels = parseChannelConfig(appConfig.webSite)
    channels.forEach(channel => {
        channelMap.set(channel.id, channel.name) // 键: id, 值: name
    })

    for (const result of results) {
        if (!result || typeof result !== 'string') continue

        // 🖼️ 解析格式: "频道名$$$链接1@图片1$$标题1##链接2@图片2$$标题2##..."
        // 注意：启用图片后，链接和图片用@分隔
        const parts = result.split('$$$')
        if (parts.length !== 2) continue

        const channelName = parts[0]
        const contentStr = parts[1]

        if (!contentStr) continue

        // 解析内容项: "链接1@图片1$$标题1##链接2@图片2$$标题2##..."
        let items = contentStr.split('##')

        // 根据频道限制截取结果数量
        const channelId = Object.keys(channelLimits).find(id =>
            channelName.includes(id) || id === channelName
        )
        if (channelId && channelLimits[channelId]) {
            items = items.slice(0, channelLimits[channelId])
            console.log(`频道 ${channelName} 限制为 ${channelLimits[channelId]} 个结果，实际处理 ${items.length} 个`)
        }

        for (const item of items) {
            if (!item.trim()) continue

            const itemParts = item.split('$$')
            let linkAndPic = itemParts[0]?.trim() || ''
            let title = itemParts[1]?.trim()

            // 🖼️ 解析链接和图片（格式：链接@图片URL）
            let link = ''
            let picUrl = ''

            if (linkAndPic.includes('@')) {
                const linkPicParts = linkAndPic.split('@')
                link = linkPicParts[0]?.trim() || ''
                picUrl = linkPicParts[1]?.trim() || ''
            } else {
                link = linkAndPic
            }

            // 如果没有标题，使用搜索关键词
            if (!title) {
                title = searchWord
            }

            // 验证是否为有效的网盘链接
            if (!link || !isValidPanUrl(link)) continue

            // 创建视频对象
            const video = new VideoDetail()
            video.vod_id = JSON.stringify([link])
            video.vod_name = cleanTitle(title)

            // 识别网盘提供商
            const providers = identifyProviders([link])

            // 提取剧集信息
            const episodeInfo = extractEpisodeInfo(title)
            if (episodeInfo) {
                video.vod_name = title.replace(episodeInfo, '').trim()
            }

            // 构建备注
            const remarkParts = []
            if (providers.length > 0) {
                remarkParts.push(providers.join('/'))
            }
            if (channelName && channelName !== '未知频道') {
                remarkParts.push(channelName)
            }
            if (episodeInfo) {
                remarkParts.push(episodeInfo)
            }

            video.vod_remarks = remarkParts.length > 0 ? remarkParts.join('|') : '资源'

            // 🖼️ 设置图片URL（如果有的话）
            video.vod_pic = picUrl || ''

            videoList.push(video)
        }
    }

    return videoList
}

/**
 * 验证是否为有效的网盘URL
 * @param {string} url
 * @returns {boolean}
 */
function isValidPanUrl(url) {
    if (!url || typeof url !== 'string') return false

    for (const re of panUrlHitRegexList) {
        if (re.test(url)) {
            return true
        }
    }
    return false
}

/**
 * 识别网盘提供商
 * @param {Array} urls
 * @returns {Array} 提供商名称数组
 */
function identifyProviders(urls) {
    const providers = new Set()

    for (const url of urls) {
        for (const provider of providerRegexMap) {
            if (provider.regex.test(url)) {
                providers.add(provider.name)
                break
            }
        }
    }

    return Array.from(providers)
}

/**
 * 清理标题
 * @param {string} title
 * @returns {string}
 */
function cleanTitle(title) {
    if (!title) return ''

    return title
        .replace(/^(名称[：:])/, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * 提取剧集信息
 * @param {string} title
 * @returns {string|null}
 */
function extractEpisodeInfo(title) {
    if (!title) return null

    const match = title.match(EPISODE_COMBINED_REGEX)
    return match ? match[0] : null
}

/**
 * 去重函数 - 基于链接去重
 * @param {Array} videoList
 * @returns {Array}
 */
function deduplicateVideoListByLinks(videoList) {
    const map = new Map()

    for (const video of videoList) {
        let ids
        try {
            ids = JSON.parse(video.vod_id || '[]')
            if (!Array.isArray(ids)) {
                ids = []
            }
        } catch (e) {
            ids = []
        }

        // 通过排序后的链接创建唯一键
        const key = JSON.stringify(ids.sort())

        // 如果键不存在，添加到map中
        if (!map.has(key)) {
            map.set(key, video)
        }
    }

    return Array.from(map.values())
}
