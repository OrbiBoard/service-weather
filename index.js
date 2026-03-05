const path = require('path');
const fs = require('fs');
const { BrowserWindow, ipcMain, app } = require('electron');

let pluginApi = null;
let settingsWin = null;
let cachedWeather = null;
let lastUpdate = 0;
let updateTimer = null;
let citiesData = null;

const XIAOMI_API = {
  weather: 'https://weatherapi.market.xiaomi.com/wtr-v3/weather/all',
  appKey: 'weather20151024',
  sign: 'zUFJoAR2ZVrDy1vF3D07'
};

const WEATHER_CODE_MAP = {
  '0': { condition: '晴', icon: '☀️' },
  '1': { condition: '多云', icon: '⛅' },
  '2': { condition: '阴', icon: '☁️' },
  '3': { condition: '阵雨', icon: '🌦️' },
  '4': { condition: '雷阵雨', icon: '⛈️' },
  '5': { condition: '雷阵雨伴有冰雹', icon: '⛈️' },
  '6': { condition: '雨夹雪', icon: '🌨️' },
  '7': { condition: '小雨', icon: '🌧️' },
  '8': { condition: '中雨', icon: '🌧️' },
  '9': { condition: '大雨', icon: '🌧️' },
  '10': { condition: '暴雨', icon: '🌧️' },
  '11': { condition: '大暴雨', icon: '🌧️' },
  '12': { condition: '特大暴雨', icon: '🌧️' },
  '13': { condition: '阵雪', icon: '🌨️' },
  '14': { condition: '小雪', icon: '🌨️' },
  '15': { condition: '中雪', icon: '🌨️' },
  '16': { condition: '大雪', icon: '❄️' },
  '17': { condition: '暴雪', icon: '❄️' },
  '18': { condition: '雾', icon: '🌫️' },
  '19': { condition: '冻雨', icon: '🌨️' },
  '20': { condition: '沙尘暴', icon: '🌫️' },
  '21': { condition: '小到中雨', icon: '🌧️' },
  '22': { condition: '中到大雨', icon: '🌧️' },
  '23': { condition: '大到暴雨', icon: '🌧️' },
  '24': { condition: '暴雨到大暴雨', icon: '🌧️' },
  '25': { condition: '大暴雨到特大暴雨', icon: '🌧️' },
  '26': { condition: '小到中雪', icon: '🌨️' },
  '27': { condition: '中到大雪', icon: '🌨️' },
  '28': { condition: '大到暴雪', icon: '❄️' },
  '29': { condition: '浮尘', icon: '🌫️' },
  '30': { condition: '扬沙', icon: '🌫️' },
  '31': { condition: '强沙尘暴', icon: '🌫️' },
  '32': { condition: '霾', icon: '🌫️' },
  '49': { condition: '浓雾', icon: '🌫️' },
  '53': { condition: '霾', icon: '🌫️' },
  '54': { condition: '中度霾', icon: '🌫️' },
  '55': { condition: '重度霾', icon: '🌫️' },
  '56': { condition: '严重霾', icon: '🌫️' }
};

const WIND_DIRECTION_MAP = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

function log(...args) {
  try {
    const enabled = process.env.LP_DEBUG;
    if (enabled) console.log('[Weather]', ...args);
  } catch (e) {}
}

function loadCitiesData() {
  if (citiesData) return citiesData;
  
  try {
    const citiesPath = path.join(__dirname, 'data', 'cities.json');
    if (fs.existsSync(citiesPath)) {
      const content = fs.readFileSync(citiesPath, 'utf-8');
      citiesData = JSON.parse(content);
      log('Loaded cities:', citiesData.length);
    }
  } catch (e) {
    log('Load cities error:', e.message);
    citiesData = [];
  }
  
  return citiesData || [];
}

async function fetchJson(url, params = {}) {
  try {
    const queryStr = Object.keys(params)
      .filter(k => params[k] !== undefined && params[k] !== null)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const fullUrl = queryStr ? `${url}?${queryStr}` : url;
    
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (e) {
    log('fetchJson:error', url, e.message);
    throw e;
  }
}

async function searchCity(keyword) {
  try {
    if (!keyword || typeof keyword !== 'string') {
      return { ok: false, error: 'invalid_keyword', cities: [] };
    }
    
    const cities = loadCitiesData();
    const kw = keyword.trim().toLowerCase();
    
    const results = cities.filter(c => 
      c.name.toLowerCase().includes(kw) || 
      c.province.toLowerCase().includes(kw) ||
      c.cityId.includes(kw)
    ).slice(0, 20);
    
    return { ok: true, cities: results };
  } catch (e) {
    return { ok: false, error: e.message, cities: [] };
  }
}

async function getWeatherByCityId(cityId) {
  try {
    if (!cityId) {
      return { ok: false, error: 'invalid_city_id' };
    }
    
    const cities = loadCitiesData();
    const city = cities.find(c => c.cityId === String(cityId));
    
    const cityName = city ? city.name : '';
    
    return await getWeatherByGeo(0, 0, cityName, cityId);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getWeatherByGeo(lat, lon, cityName = '', cityId = '') {
  try {
    if (lat === undefined || lon === undefined) {
      return { ok: false, error: 'invalid_coordinates' };
    }
    
    const params = {
      latitude: Number(lat),
      longitude: Number(lon),
      locale: 'zh_cn',
      isGlobal: 'false',
      appKey: XIAOMI_API.appKey,
      sign: XIAOMI_API.sign
    };
    
    if (cityId) {
      params.locationKey = 'weathercn:' + String(cityId);
    }
    
    const data = await fetchJson(XIAOMI_API.weather, params);
    
    return parseWeatherData(data, lat, lon, cityName, cityId);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getWeatherByIp() {
  try {
    const ipInfo = await fetchJson('https://ipapi.co/json/');
    
    if (ipInfo && ipInfo.latitude && ipInfo.longitude) {
      const cityName = ipInfo.city || '';
      return await getWeatherByGeo(ipInfo.latitude, ipInfo.longitude, cityName);
    }
    
    return { ok: false, error: 'ip_location_failed' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function parseWeatherData(data, lat, lon, cityName = '', cityId = '') {
  try {
    if (!data || data.errCode) {
      return { ok: false, error: data?.errDesc || 'no_data' };
    }
    
    const current = data.current || {};
    const forecastDaily = data.forecastDaily || {};
    const aqi = data.aqi || {};
    
    const weatherCode = String(current.weather || '0');
    const weatherInfo = WEATHER_CODE_MAP[weatherCode] || { condition: '未知', icon: '🌡️' };
    
    const windDeg = parseFloat(current.wind?.direction?.value) || 0;
    const windDirIndex = Math.round(windDeg / 45) % 8;
    const windDir = WIND_DIRECTION_MAP[windDirIndex];
    
    const result = {
      ok: true,
      location: {
        cityId: cityId,
        name: cityName,
        province: '',
        country: '中国',
        lat: lat,
        lon: lon,
        timezone: data.timezone || 'Asia/Shanghai'
      },
      current: {
        temp: parseInt(current.temperature?.value) || 0,
        feelsLike: parseInt(current.feelsLike?.value) || 0,
        humidity: parseInt(current.humidity?.value) || 0,
        pressure: parseInt(current.pressure?.value) || 0,
        windSpeed: parseFloat(current.wind?.speed?.value) || 0,
        windDir: windDir,
        windDeg: windDeg,
        visibility: current.visibility?.value || '',
        uv: parseInt(current.uvIndex) || 0,
        condition: weatherInfo.condition,
        conditionCode: weatherCode,
        icon: weatherInfo.icon,
        updateTime: current.pubTime || new Date().toISOString()
      },
      aqi: {
        value: aqi.value?.[0] || 0,
        level: getAqiLevel(aqi.value?.[0] || 0),
        pm25: 0,
        pm10: 0
      },
      forecast: [],
      hourly: [],
      raw: data
    };
    
    if (forecastDaily.temperature && forecastDaily.temperature.value) {
      const temps = forecastDaily.temperature.value;
      const weatherCodes = forecastDaily.skyCon?.value || [];
      const dates = forecastDaily.sunRiseSet?.value || [];
      
      for (let i = 0; i < Math.min(7, temps.length / 2); i++) {
        const dayWeather = WEATHER_CODE_MAP[String(weatherCodes[i * 2]?.value || weatherCodes[i]?.value || '0')] || { condition: '未知', icon: '🌡️' };
        result.forecast.push({
          date: dates[i]?.from ? dates[i].from.substring(0, 10) : '',
          tempMax: parseInt(temps[i * 2]?.max || temps[i * 2]?.value || 0),
          tempMin: parseInt(temps[i * 2 + 1]?.min || temps[i * 2 + 1]?.value || 0),
          condition: dayWeather.condition,
          conditionCode: weatherCodes[i]?.value || '0',
          icon: dayWeather.icon,
          pop: parseInt(forecastDaily.precipitationProbability?.value?.[i] || 0)
        });
      }
    }
    
    cachedWeather = result;
    lastUpdate = Date.now();
    
    return result;
  } catch (e) {
    log('parseWeatherData:error', e.message);
    return { ok: false, error: e.message };
  }
}

function getAqiLevel(value) {
  if (value <= 50) return '优';
  if (value <= 100) return '良';
  if (value <= 150) return '轻度污染';
  if (value <= 200) return '中度污染';
  if (value <= 300) return '重度污染';
  return '严重污染';
}

async function getDefaultWeather() {
  try {
    const locationMode = pluginApi?.store?.get('locationMode') || 'manual';
    
    if (locationMode === 'ip') {
      return await getWeatherByIp();
    }
    
    const cityId = pluginApi?.store?.get('defaultCityId');
    const lat = pluginApi?.store?.get('defaultLat');
    const lon = pluginApi?.store?.get('defaultLon');
    const cityName = pluginApi?.store?.get('defaultCityName') || '';
    
    if (cityId) {
      return await getWeatherByCityId(cityId);
    }
    
    if (lat && lon) {
      return await getWeatherByGeo(lat, lon, cityName);
    }
    
    return { ok: false, error: 'no_default_location' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function startAutoUpdate() {
  stopAutoUpdate();
  
  const interval = pluginApi?.store?.get('updateInterval') || 30;
  if (interval <= 0) return;
  
  updateTimer = setInterval(async () => {
    try {
      await getDefaultWeather();
      log('auto_update:ok');
    } catch (e) {
      log('auto_update:error', e.message);
    }
  }, interval * 60 * 1000);
}

function stopAutoUpdate() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return settingsWin;
  }
  
  settingsWin = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    show: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'src', 'preload', 'settings.js')
    }
  });
  
  settingsWin.loadFile(path.join(__dirname, 'index.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
  
  return settingsWin;
}

function registerIpcHandlers() {
  try {
    ipcMain.removeHandler('weather:searchCity');
    ipcMain.handle('weather:searchCity', async (_evt, keyword) => {
      return await searchCity(keyword);
    });
    
    ipcMain.removeHandler('weather:getWeather');
    ipcMain.handle('weather:getWeather', async (_evt, cityId) => {
      if (cityId) {
        return await getWeatherByCityId(cityId);
      }
      return await getDefaultWeather();
    });
    
    ipcMain.removeHandler('weather:getWeatherByGeo');
    ipcMain.handle('weather:getWeatherByGeo', async (_evt, lat, lon) => {
      return await getWeatherByGeo(lat, lon);
    });
    
    ipcMain.removeHandler('weather:getWeatherByIp');
    ipcMain.handle('weather:getWeatherByIp', async () => {
      return await getWeatherByIp();
    });
    
    ipcMain.removeHandler('weather:getCached');
    ipcMain.handle('weather:getCached', () => {
      return cachedWeather;
    });
  } catch (e) {
    log('ipc_register:error', e.message);
  }
}

function cleanup() {
  log('cleanup:start');
  stopAutoUpdate();
  
  if (settingsWin && !settingsWin.isDestroyed()) {
    try {
      settingsWin.webContents?.destroy();
      settingsWin.destroy();
    } catch (e) {}
    settingsWin = null;
  }
  
  try {
    ipcMain.removeHandler('weather:searchCity');
    ipcMain.removeHandler('weather:getWeather');
    ipcMain.removeHandler('weather:getWeatherByGeo');
    ipcMain.removeHandler('weather:getWeatherByIp');
    ipcMain.removeHandler('weather:getCached');
  } catch (e) {}
  
  cachedWeather = null;
  log('cleanup:done');
  return true;
}

module.exports = {
  name: '天气服务插件',
  version: '1.0.0',
  description: '天气服务插件：提供天气查询功能',
  
  init: (api) => {
    pluginApi = api;
    log('init');
    loadCitiesData();
    
    if (!app.isReady()) {
      app.once('ready', () => registerIpcHandlers());
    } else {
      registerIpcHandlers();
    }
    
    startAutoUpdate();
    
    return Promise.resolve();
  },
  
  functions: {
    openSettings: () => {
      openSettingsWindow();
      return true;
    },
    
    searchCity: async (keyword) => {
      return await searchCity(keyword);
    },
    
    getWeather: async (cityId) => {
      if (cityId) {
        return await getWeatherByCityId(cityId);
      }
      return await getDefaultWeather();
    },
    
    getWeatherByCityId: async (cityId) => {
      return await getWeatherByCityId(cityId);
    },
    
    getWeatherByGeo: async (lat, lon) => {
      return await getWeatherByGeo(lat, lon);
    },
    
    getWeatherByIp: async () => {
      return await getWeatherByIp();
    },
    
    getCached: () => {
      return cachedWeather;
    },
    
    refresh: async () => {
      return await getDefaultWeather();
    },
    
    setDefaultLocation: async (cityId, cityName, lat, lon) => {
      try {
        if (cityId) {
          pluginApi?.store?.set('defaultCityId', String(cityId));
        }
        if (cityName) {
          pluginApi?.store?.set('defaultCityName', String(cityName));
        }
        if (lat !== undefined) {
          pluginApi?.store?.set('defaultLat', Number(lat));
        }
        if (lon !== undefined) {
          pluginApi?.store?.set('defaultLon', Number(lon));
        }
        return true;
      } catch (e) {
        return false;
      }
    },
    
    setLocationMode: (mode) => {
      pluginApi?.store?.set('locationMode', mode);
      if (mode === 'ip') {
        pluginApi?.store?.set('defaultCityId', '');
        pluginApi?.store?.set('defaultCityName', '');
      }
      return true;
    },
    
    disabled: () => cleanup(),
    uninstall: () => cleanup()
  },
  
  automationEvents: [
    {
      id: 'weather.get',
      name: 'getWeather',
      desc: '获取天气数据',
      params: [
        { name: 'cityId', type: 'string', hint: '城市ID，为空则使用默认位置' }
      ]
    },
    {
      id: 'weather.search',
      name: 'searchCity',
      desc: '搜索城市',
      params: [
        { name: 'keyword', type: 'string', hint: '城市名称关键词' }
      ]
    },
    {
      id: 'weather.getByGeo',
      name: 'getWeatherByGeo',
      desc: '通过经纬度获取天气',
      params: [
        { name: 'lat', type: 'number', hint: '纬度' },
        { name: 'lon', type: 'number', hint: '经度' }
      ]
    },
    {
      id: 'weather.getByIp',
      name: 'getWeatherByIp',
      desc: '通过IP定位获取天气',
      params: []
    }
  ]
};
