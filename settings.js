(() => {
  const el = {
    enableService: document.getElementById('enableService'),
    locationMode: document.getElementById('locationMode'),
    manualLocationSection: document.getElementById('manualLocationSection'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    currentCityDesc: document.getElementById('currentCityDesc'),
    latInput: document.getElementById('latInput'),
    lonInput: document.getElementById('lonInput'),
    setGeoBtn: document.getElementById('setGeoBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    weatherPreview: document.getElementById('weatherPreview'),
    updateInterval: document.getElementById('updateInterval')
  };

  const applyTheme = (mode, color) => {
    const root = document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const adjustBrightness = (hex, percent) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    };
    const accent = color || '#238f4a';
    root.style.setProperty('--accent', accent);
    const hex = accent.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    if (isDark) {
      root.style.setProperty('--bg', '#121621');
      root.style.setProperty('--fg', '#ededed');
      root.style.setProperty('--muted', '#94a3b8');
      root.style.setProperty('--panel', 'rgba(255, 255, 255, 0.04)');
      root.style.setProperty('--item-bg', 'rgba(255, 255, 255, 0.04)');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--bg-modal', '#1b1f2a');
      root.style.setProperty('--fg-title', '#e5e7eb');
      root.style.setProperty('--btn-secondary-bg', 'rgba(255, 255, 255, 0.06)');
      const darkAccent = adjustBrightness(accent, -40);
      root.style.setProperty('--bg-gradient-start', darkAccent);
    } else {
      root.style.setProperty('--bg', '#f3f4f6');
      root.style.setProperty('--fg', '#1f2937');
      root.style.setProperty('--muted', '#6b7280');
      root.style.setProperty('--panel', '#ffffff');
      root.style.setProperty('--item-bg', '#f3f4f6');
      root.style.setProperty('--border', '#e5e7eb');
      root.style.setProperty('--bg-modal', '#ffffff');
      root.style.setProperty('--fg-title', '#111827');
      root.style.setProperty('--btn-secondary-bg', 'rgba(0, 0, 0, 0.05)');
      const lightAccent = adjustBrightness(accent, 60);
      root.style.setProperty('--bg-gradient-start', lightAccent);
    }
  };

  const initTheme = async () => {
    try {
      const cfg = await window.settingsAPI?.configGetAll('system');
      const mode = cfg?.themeMode || 'system';
      const color = cfg?.themeColor || '#238f4a';
      applyTheme(mode, color);
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (mode === 'system') applyTheme('system', color);
      });
      window.settingsAPI?.onConfigChanged((payload) => {
        if (payload?.scope === 'system') {
          if (payload.key === 'themeMode') applyTheme(payload.value, color);
          if (payload.key === 'themeColor') applyTheme(mode, payload.value);
          (async () => {
            const newCfg = await window.settingsAPI?.configGetAll('system');
            applyTheme(newCfg?.themeMode || 'system', newCfg?.themeColor || '#238f4a');
          })();
        }
      });
    } catch (e) {}
  };
  initTheme();

  const loadConfig = async () => {
    try {
      const cfg = await window.settingsAPI?.configPluginGetAll?.('service-weather');
      if (el.enableService) el.enableService.checked = (cfg?.enabled ?? true);
      if (el.locationMode) el.locationMode.value = (cfg?.locationMode ?? 'manual');
      if (el.updateInterval) el.updateInterval.value = (cfg?.updateInterval ?? 30);
      
      updateLocationModeUI();
      
      if (cfg?.defaultCityName) {
        el.currentCityDesc.textContent = cfg.defaultCityName;
      } else if (cfg?.defaultCityId) {
        el.currentCityDesc.textContent = `城市ID: ${cfg.defaultCityId}`;
      } else {
        el.currentCityDesc.textContent = '未设置';
      }
      
      if (cfg?.defaultLat) el.latInput.value = cfg.defaultLat;
      if (cfg?.defaultLon) el.lonInput.value = cfg.defaultLon;
    } catch (e) {}
  };

  const updateLocationModeUI = () => {
    const mode = el.locationMode?.value || 'manual';
    if (el.manualLocationSection) {
      el.manualLocationSection.style.display = mode === 'manual' ? 'block' : 'none';
    }
  };

  const searchCity = async () => {
    const keyword = el.searchInput?.value?.trim();
    if (!keyword) return;
    
    el.searchBtn.disabled = true;
    el.searchBtn.classList.add('loading');
    
    try {
      const response = await window.settingsAPI?.pluginCall?.('service-weather', 'searchCity', [keyword]);
      
      const result = response?.result || response;
      
      if (result?.ok !== false && result?.cities?.length > 0) {
        el.searchResults.innerHTML = '';
        result.cities.forEach(city => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <div class="name">${city.name}</div>
            <div class="info">${city.province ? city.province + ', ' : ''}${city.country || ''} (ID: ${city.cityId})</div>
          `;
          item.addEventListener('click', () => selectCity(city));
          el.searchResults.appendChild(item);
        });
        el.searchResults.style.display = 'block';
      } else {
        el.searchResults.innerHTML = '<div class="search-result-item"><div class="name">未找到城市</div></div>';
        el.searchResults.style.display = 'block';
      }
    } catch (e) {
      el.searchResults.innerHTML = '<div class="search-result-item"><div class="name">搜索失败</div></div>';
      el.searchResults.style.display = 'block';
    } finally {
      el.searchBtn.disabled = false;
      el.searchBtn.classList.remove('loading');
    }
  };

  const selectCity = async (city) => {
    try {
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultCityId', city.cityId);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultCityName', city.name);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultLat', 0);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultLon', 0);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'locationMode', 'manual');
      
      el.currentCityDesc.textContent = city.name;
      el.searchResults.style.display = 'none';
      el.searchInput.value = '';
      
      if (el.locationMode) el.locationMode.value = 'manual';
      updateLocationModeUI();
    } catch (e) {}
  };

  const setGeoLocation = async () => {
    const lat = parseFloat(el.latInput?.value);
    const lon = parseFloat(el.lonInput?.value);
    
    if (isNaN(lat) || isNaN(lon)) {
      return;
    }
    
    try {
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultLat', lat);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultLon', lon);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultCityId', '');
      await window.settingsAPI?.configPluginSet?.('service-weather', 'defaultCityName', `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      await window.settingsAPI?.configPluginSet?.('service-weather', 'locationMode', 'manual');
      
      el.currentCityDesc.textContent = `经纬度: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      
      if (el.locationMode) el.locationMode.value = 'manual';
      updateLocationModeUI();
    } catch (e) {}
  };

  const refreshWeather = async () => {
    el.refreshBtn.disabled = true;
    el.refreshBtn.classList.add('loading');
    
    try {
      const response = await window.settingsAPI?.pluginCall?.('service-weather', 'getWeather', []);
      
      const result = response?.result || response;
      
      if (result?.ok !== false) {
        renderWeatherPreview(result);
      } else {
        el.weatherPreview.innerHTML = `
          <div style="text-align: center; color: var(--muted); padding: 40px;">
            <i class="ri-error-warning-line" style="font-size: 48px;"></i>
            <p>获取天气失败: ${result?.error || '未知错误'}</p>
          </div>
        `;
      }
    } catch (e) {
      el.weatherPreview.innerHTML = `
        <div style="text-align: center; color: var(--muted); padding: 40px;">
          <i class="ri-error-warning-line" style="font-size: 48px;"></i>
          <p>获取天气失败</p>
        </div>
      `;
    } finally {
      el.refreshBtn.disabled = false;
      el.refreshBtn.classList.remove('loading');
    }
  };

  const renderWeatherPreview = (data) => {
    const current = data.current || {};
    const location = data.location || {};
    const aqi = data.aqi || {};
    
    const weatherIcon = getWeatherIcon(current.conditionCode, current.icon);
    
    el.weatherPreview.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px;">${weatherIcon}</div>
        <div>
          <div class="temp">${current.temp ?? '--'}°C</div>
          <div class="condition">${current.condition || '--'}</div>
        </div>
      </div>
      <div style="margin-top: 8px; font-size: 14px; color: var(--muted);">
        <i class="ri-map-pin-line"></i> ${location.name || '未知位置'}
      </div>
      <div class="details">
        <div class="detail-item">
          <div class="label">体感温度</div>
          <div class="value">${current.feelsLike ?? '--'}°C</div>
        </div>
        <div class="detail-item">
          <div class="label">湿度</div>
          <div class="value">${current.humidity ?? '--'}%</div>
        </div>
        <div class="detail-item">
          <div class="label">风速</div>
          <div class="value">${current.windSpeed ?? '--'} m/s</div>
        </div>
        <div class="detail-item">
          <div class="label">风向</div>
          <div class="value">${current.windDir || '--'}</div>
        </div>
        <div class="detail-item">
          <div class="label">气压</div>
          <div class="value">${current.pressure ?? '--'} hPa</div>
        </div>
        <div class="detail-item">
          <div class="label">能见度</div>
          <div class="value">${current.visibility ?? '--'} km</div>
        </div>
      </div>
      ${aqi.value ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <div style="font-weight: 600; margin-bottom: 8px;">空气质量</div>
        <div class="details" style="margin-top: 0;">
          <div class="detail-item">
            <div class="label">AQI</div>
            <div class="value">${aqi.value}</div>
          </div>
          <div class="detail-item">
            <div class="label">等级</div>
            <div class="value">${aqi.level || '--'}</div>
          </div>
          <div class="detail-item">
            <div class="label">PM2.5</div>
            <div class="value">${aqi.pm25 ?? '--'}</div>
          </div>
        </div>
      </div>
      ` : ''}
    `;
  };

  const getWeatherIcon = (code, icon) => {
    if (icon) return `<img src="${icon}" style="width: 48px; height: 48px;" onerror="this.style.display='none'" />`;
    const codeStr = String(code || '0');
    const iconMap = {
      '0': '☀️', '1': '⛅', '2': '☁️', '3': '🌦️', '4': '⛈️', '5': '⛈️',
      '6': '🌨️', '7': '🌧️', '8': '🌧️', '9': '🌧️', '10': '🌧️', '11': '🌧️',
      '12': '🌧️', '13': '🌨️', '14': '🌨️', '15': '🌨️', '16': '❄️', '17': '❄️',
      '18': '�️', '19': '🌨️', '20': '🌫️', '21': '🌧️', '22': '🌧️', '23': '🌧️',
      '24': '🌧️', '25': '🌧️', '26': '🌨️', '27': '🌨️', '28': '❄️', '29': '�️',
      '30': '🌫️', '31': '🌫️', '32': '🌫️', '49': '🌫️', '53': '🌫️', '54': '🌫️',
      '55': '🌫️', '56': '🌫️'
    };
    return iconMap[codeStr] || '🌡️';
  };

  if (el.enableService) {
    el.enableService.addEventListener('change', () => {
      window.settingsAPI?.configPluginSet?.('service-weather', 'enabled', !!el.enableService.checked);
    });
  }

  if (el.locationMode) {
    el.locationMode.addEventListener('change', () => {
      const mode = el.locationMode.value;
      window.settingsAPI?.configPluginSet?.('service-weather', 'locationMode', mode);
      updateLocationModeUI();
    });
  }

  if (el.searchBtn) {
    el.searchBtn.addEventListener('click', searchCity);
  }

  if (el.searchInput) {
    el.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchCity();
    });
  }

  if (el.setGeoBtn) {
    el.setGeoBtn.addEventListener('click', setGeoLocation);
  }

  if (el.refreshBtn) {
    el.refreshBtn.addEventListener('click', refreshWeather);
  }

  if (el.updateInterval) {
    el.updateInterval.addEventListener('change', () => {
      const val = Math.max(0, Math.min(1440, parseInt(el.updateInterval.value) || 0));
      window.settingsAPI?.configPluginSet?.('service-weather', 'updateInterval', val);
    });
  }

  document.querySelectorAll('.win-btn').forEach((b) => {
    b.addEventListener('click', () => window.settingsAPI?.windowControl(b.dataset.act));
  });

  document.querySelectorAll('.sub-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.hidden = true);
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const panel = document.getElementById(`tab-${tabId}`);
      if (panel) panel.hidden = false;
    });
  });

  loadConfig();
})();
