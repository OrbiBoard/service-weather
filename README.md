# 服务.天气 (service-weather)

## 简介
天气服务插件，提供天气查询功能，支持城市搜索、经纬度定位、IP定位。其他插件可通过此服务获取天气数据。

## 功能特性
- 内置中国城市数据库（2498个城市）
- 支持城市名称搜索获取城市ID
- 支持经纬度坐标查询天气
- 支持IP自动定位获取天气
- 可设置默认天气位置
- 天气数据自动更新
- 提供设置页面配置
- 支持空气质量数据

## 配置项

| 配置项 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| enabled | boolean | 启用天气服务 | true |
| locationMode | string | 定位方式 (manual/ip) | manual |
| defaultCityId | string | 默认城市ID | '' |
| defaultCityName | string | 默认城市名称 | '' |
| defaultLat | number | 默认纬度 | 0 |
| defaultLon | number | 默认经度 | 0 |
| updateInterval | number | 自动更新间隔(分钟) | 30 |

## API接口

其他插件可通过以下接口调用：

### getWeather(cityId?)
获取天气数据
- 参数: `cityId` (可选) - 城市ID，不传则使用默认位置
- 返回: 天气数据对象

### searchCity(keyword)
搜索城市
- 参数: `keyword` - 城市名称关键词
- 返回: `{ ok: boolean, cities: Array<{cityId, name, province, country}> }`

### getWeatherByGeo(lat, lon)
通过经纬度获取天气
- 参数: `lat` - 纬度, `lon` - 经度
- 返回: 天气数据对象

### getWeatherByIp()
通过IP定位获取天气
- 返回: 天气数据对象

### getCached()
获取缓存的天气数据
- 返回: 最近一次获取的天气数据

### refresh()
刷新天气数据
- 返回: 最新的天气数据

## 调用示例

```javascript
// 获取默认位置天气
const weather = await window.settingsAPI.pluginCall('service-weather', 'getWeather', []);

// 搜索城市
const result = await window.settingsAPI.pluginCall('service-weather', 'searchCity', ['北京']);

// 通过城市ID获取天气
const weather = await window.settingsAPI.pluginCall('service-weather', 'getWeather', ['101010100']);

// 通过经纬度获取天气
const weather = await window.settingsAPI.pluginCall('service-weather', 'getWeatherByGeo', [39.9042, 116.4074]);

// 通过IP定位获取天气
const weather = await window.settingsAPI.pluginCall('service-weather', 'getWeatherByIp', []);
```

## 返回数据结构

```javascript
{
  ok: true,
  location: {
    cityId: '101010100',
    name: '北京',
    province: '北京',
    country: '中国',
    lat: 0,
    lon: 0
  },
  current: {
    temp: 25,
    feelsLike: 26,
    humidity: 65,
    pressure: 1013,
    windSpeed: 3.5,
    windDir: '东北',
    windDeg: 45,
    visibility: 10,
    condition: '晴',
    conditionCode: '0',
    icon: '☀️',
    updateTime: '2024-01-01T12:00:00Z'
  },
  aqi: {
    value: 75,
    level: '良'
  },
  forecast: [
    {
      date: '2024-01-01',
      tempMax: 28,
      tempMin: 18,
      condition: '晴',
      conditionCode: '0',
      icon: '☀️',
      pop: 0
    }
  ]
}
```

## 天气代码对照表（小米天气）

| 代码 | 天气状况 | 图标 |
|------|---------|------|
| 0 | 晴 | ☀️ |
| 1 | 多云 | ⛅ |
| 2 | 阴 | ☁️ |
| 3 | 阵雨 | 🌦️ |
| 4 | 雷阵雨 | ⛈️ |
| 5 | 雷阵雨伴有冰雹 | ⛈️ |
| 6 | 雨夹雪 | 🌨️ |
| 7-9 | 小/中/大雨 | 🌧️ |
| 10-12 | 暴雨/大暴雨/特大暴雨 | 🌧️ |
| 13-17 | 雪 | 🌨️/❄️ |
| 18 | 雾 | 🌫️ |
| 19 | 冻雨 | 🌨️ |
| 20 | 沙尘暴 | 🌫️ |
| 32 | 霾 | 🌫️ |

## 数据来源
- **天气数据**: 小米天气API (weatherapi.market.xiaomi.com)
- **城市数据**: 内置中国城市数据库
- **IP定位**: ipapi.co

## 版本历史
- v1.0.0 - 初始版本
