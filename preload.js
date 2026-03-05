(() => {
  try {
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('weatherAPI', {
      searchCity: (keyword) => ipcRenderer.invoke('weather:searchCity', keyword),
      getWeather: (cityId) => ipcRenderer.invoke('weather:getWeather', cityId),
      getWeatherByGeo: (lat, lon) => ipcRenderer.invoke('weather:getWeatherByGeo', lat, lon),
      getWeatherByIp: () => ipcRenderer.invoke('weather:getWeatherByIp'),
      getCached: () => ipcRenderer.invoke('weather:getCached'),
      pluginCall: (targetPluginId, fnName, args) => ipcRenderer.invoke('plugin:call', targetPluginId, fnName, args)
    });
  } catch (e) {}
})();
