const is2kki = gameId === '2kki';
const unknownLocations = [];
const commonMapIds = ['0002', '0010'];
let defaultLocations;

function onLoad2kkiMap(mapId) {
  const prevMapId = commonMapIds.indexOf(mapId) === -1 ? cachedMapId : null;
  const prevLocations = prevMapId ? cachedLocations : null;
  const locationKey = `${(prevMapId || '0000')}_${mapId}`;

  let locations = locationCache[locationKey] || null;

  if (locations && typeof locations === 'string')
    locations = null;

  const useDefaultLocation = defaultLocations.hasOwnProperty(mapId);

  if (useDefaultLocation)
    locations = defaultLocations[mapId];
  else if (unknownLocations.indexOf(locationKey) > -1)
    locations = getMassagedLabel(localizedMessages.location.unknownLocation);

  if (!cachedMapId)
    document.getElementById('location').classList.remove('hidden');
  
  if (locations && locations.length) {
    const cacheLocation = useDefaultLocation && !locationCache.hasOwnProperty(locationKey);
    const locationNames = Array.isArray(locations) ? locations.map(l => l.title) : null;
    set2kkiClientLocation(mapId, prevMapId, locations, prevLocations, cacheLocation);
    cachedPrevMapId = cachedMapId;
    cachedMapId = mapId;
    cachedPrevLocations = cachedLocations;
    cachedLocations = locationNames ? locations : null;
    if (!locationNames) {
      set2kkiExplorerLinks(null);
      set2kkiMaps([]);
    } else {
      set2kkiExplorerLinks(!useDefaultLocation ? locationNames : null);
      if (useDefaultLocation) {
        const cacheMap = useDefaultLocation && !mapCache.hasOwnProperty(locationNames.join(','));
        set2kkiMaps([], locationNames, cacheMap, cacheMap);
      } else if (mapCache.hasOwnProperty(locationNames.join(',')))
        set2kkiMaps(mapCache[locationNames.join(',')], locationNames);
      else
        queryAndSet2kkiMaps(locationNames).catch(err => console.error(err));
    }
  } else {
    queryAndSet2kkiLocation(mapId, prevMapId, prevLocations, set2kkiClientLocation, true)
      .then(locations => {
        const locationNames = locations ? locations.map(l => l.title) : null;
        set2kkiExplorerLinks(locationNames);
        if (locationNames)
          queryAndSet2kkiMaps(locationNames).catch(err => console.error(err));
        else {
          set2kkiMaps([], null, true, true);
          set2kkiExplorerLinks(null);
        }
      }).catch(err => console.error(err));
  }
}

function queryAndSet2kkiLocation(mapId, prevMapId, prevLocations, setLocationFunc, forClient) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
      let url = `https://2kki.app/getMapLocationNames?mapId=${mapId}`;
      if (prevMapId) {
          url += `&prevMapId=${prevMapId}`;
          if (prevLocations && prevLocations.length && !prevLocations[0].default)
            url += `&prevLocationNames=${prevLocations.map(l => l.title).join('&prevLocationNames=')}`;
      }
      req.responseType = 'json';
      req.open("GET", url);
      req.send();

      if (!setLocationFunc)
        setLocationFunc = () => {};

      setLocationFunc(mapId, prevMapId, getMassagedLabel(localizedMessages.location['2kki'].queryingLocation), prevLocations, true);

      req.onload = (_e) => {
        const locationsArray = req.response;
        const locations = [];

        const cacheAndResolve = () => {
          if (forClient) {
            cachedPrevMapId = cachedMapId;
            cachedMapId = mapId;
            cachedPrevLocations = cachedLocations;
            cachedLocations = locations;
          }

          resolve(locations);
        };

        if (Array.isArray(locationsArray) && locationsArray.length) {
          let location = locationsArray[0];
          let usePrevLocations = false;

          if (locationsArray.length > 1 && prevLocations && prevLocations.length) {
            for (let l of locationsArray) {
              if (l.title === prevLocations[0].title) {
                location = l;
                usePrevLocations = true;
                break;
              }
            }
          }

          locations.push(location);

          if (usePrevLocations) {
            queryConnected2kkiLocationNames(location.title, locationsArray.filter(l => l.title !== location.title).map(l => l.title))
              .then(connectedLocationNames => {
                const connectedLocations = locationsArray.filter(l => connectedLocationNames.indexOf(l.title) > -1);
                for (let cl of connectedLocations)
                  locations.push(cl);

                setLocationFunc(mapId, prevMapId, locations, prevLocations, true, true);

                cacheAndResolve();
              }).catch(err => reject(err));
              
            return;
          } else
            setLocationFunc(mapId, prevMapId, locations, prevLocations, true, true);
        } else {
          const errCode = !Array.isArray(req.response) ? req.response.err_code : null;
          
          if (errCode)
            console.error({ error: req.response.error, errCode: errCode });

          if (prevMapId) {
            queryAndSet2kkiLocation(mapId, null, null, setLocationFunc, forClient).then(() => resolve(null)).catch(err => reject(err));
            return;
          }
          setLocationFunc(mapId, prevMapId, null, prevLocations, true, true);
        }
        cacheAndResolve();
      };
  });
}

function set2kkiClientLocation(mapId, prevMapId, locations, prevLocations, cacheLocation, saveLocation) {
  document.getElementById('locationText').innerHTML = getLocalized2kkiLocationLinksHtml(locations, '<br>');
  onUpdateChatboxInfo();
  if (cacheLocation) {
    const locationKey = `${(prevMapId || '0000')}_${mapId}`;
    const prevLocationKey = `${mapId}_${(prevMapId || '0000')}`;
    if (locations)
      locationCache[locationKey] = locations;
    else
      unknownLocations.push(locationKey);
    if (prevLocations)
      locationCache[prevLocationKey] = prevLocations;
    if (saveLocation && (locations || prevLocations)) {
      if (locations)
        config.locationCache[locationKey] = locations;
      if (prevLocations)
        config.locationCache[prevLocationKey] = prevLocations;
      updateConfig(config);
    }
  }
}

function getLocalized2kkiLocation(title, titleJP, asHtml) {
  let template = localizedMessages.location['2kki'].template;
  if (asHtml)
    template = template.replace(/(?:})([^{]+)/g, '}<span class="infoLabel">$1</span>');
  return getMassagedLabel(template).replace('{LOCATION}', title).replace('{LOCATION_JP}', titleJP);
}

function getLocalized2kkiLocations(locations) {
  return locations && locations.length
    ? Array.isArray(locations)
      ? locations.map(l => getLocalized2kkiLocation(l.title, l.titleJP)).join('\n')
      : locations
    : getMassagedLabel(localizedMessages.location.unknownLocation);
}

function get2kkiLocationLinkHtml(location) {
  const urlTitle = location.urlTitle || location.title;
  const urlTitleJP = location.urlTitleJP || (location.titleJP && location.titleJP.indexOf("：") > -1 ? location.titleJP.slice(0, location.titleJP.indexOf("：")) : location.titleJP);
  const locationLink = `<a href="https://yume2kki.fandom.com/wiki/${urlTitle}" target="_blank">${location.title}</a>`
  const locationLinkJP = urlTitleJP ? `<a href="https://wikiwiki.jp/yume2kki-t/${urlTitleJP}" target="_blank">${location.titleJP}</a>` : null;
  return locationLinkJP ? getLocalized2kkiLocation(locationLink, locationLinkJP, true) : locationLink;
}

function getLocalized2kkiLocationLinksHtml(locations, separator) {
  return locations && locations.length
    ? Array.isArray(locations)
    ? locations.map(l => get2kkiLocationLinkHtml(l)).join(separator)
      : getInfoLabel(locations)
    : getInfoLabel(getMassagedLabel(localizedMessages.location.unknownLocation));
}

function set2kkiGlobalChatMessageLocation(globalMessageIcon, globalMessageLocation, mapId, prevMapId, prevLocations) {
  const setMessageLocationFunc = (_mapId, _prevMapId, locations, prevLocations, cacheLocation, saveLocation) => {
    globalMessageIcon.title = getLocalized2kkiLocations(locations);
    globalMessageLocation.innerHTML = getLocalized2kkiLocationLinksHtml(locations, getInfoLabel('&nbsp;|&nbsp;'));
    if (cacheLocation) {
      const locationKey = `${prevMapId}_${mapId}`;
      const prevLocationKey = `${mapId}_${prevMapId}`;
      if (locations)
        locationCache[locationKey] = locations;
      else
        unknownLocations.push(locationKey);
      if (prevLocations)
        locationCache[prevLocationKey] = prevLocations;
      if (saveLocation && (locations || prevLocations)) {
        if (locations)
          config.locationCache[locationKey] = locations;
        if (prevLocations)
          config.locationCache[prevLocationKey] = prevLocations;
        updateConfig(config);
      }
    }
  };

  if (defaultLocations.hasOwnProperty(mapId))
    setMessageLocationFunc(mapId, prevMapId, defaultLocations[mapId], prevLocations);
  else {
    if (!prevMapId || commonMapIds.indexOf(mapId) > -1)
      prevMapId = "0000";
    const locationKey = `${prevMapId}_${mapId}`;
    if (unknownLocations.indexOf(locationKey) > -1)
      setMessageLocationFunc(mapId, prevMapId, null, prevLocations);
    else if (locationCache.hasOwnProperty(locationKey) && Array.isArray(locationCache[locationKey]))
      setMessageLocationFunc(mapId, prevMapId, locationCache[locationKey], prevLocations);
    else
      queryAndSet2kkiLocation(mapId, prevMapId !== "0000" ? prevMapId : null, prevLocations, setMessageLocationFunc)
        .catch(err => console.error(err));
  }
}

function getDefault2kkiLocations() {
  const ret = {
    '0150': [{ title: 'Puzzle Game (Kura Puzzle)', titleJP: 'パズルゲーム', urlTitle: 'Console#PUZZLE_GAME_.28Kura_Puzzle.29', urlTitleJP: 'ミニゲーム/パズルゲーム', default: true }],
    '0620': [{ title: 'Sound Room', titleJP: 'SR分室の曲', urlTitle: 'Soundtrack', urlTitleJP: '収集要素/SR分室の曲・演出の解放条件', default: true }]
  };

  const wavyUpLocation = [{ title: '↑v↑ (Wavy Up)', titleJP: '↑v↑', urlTitle: 'Console#.E2.86.91V.E2.86.91_.28Wavy_Up.29', urlTitleJP: 'ミニゲーム/↑v↑', default: true }];
  for (let i = 121; i <= 130; i++)
    ret[`0${i}`] = wavyUpLocation;

  const platedSnowCountry = [{ title: 'Plated Snow Country', titleJP: 'ゆきぐにっき', urlTitle: 'Console#Plated_Snow_Country', urlTitleJP: 'ミニゲーム/ゆきぐにっき', default: true }];
  for (let i = 249; i <= 250; i++)
    ret[`0${i}`] = platedSnowCountry;

  return ret;
}

function queryConnected2kkiLocationNames(locationName, connLocationNames) {
  return new Promise((resolve, _reject) => {
    const req = new XMLHttpRequest();
      const url = `https://2kki.app/getConnectedLocations?locationName=${locationName}&connLocationNames=${connLocationNames.join('&connLocationNames=')}`;
      req.responseType = 'json';
      req.open("GET", url);
      req.send();

      req.onload = (_e) => {
        let ret = [];
        let errCode = null;

        if (Array.isArray(req.response))
          ret = req.response;
        else
          errCode = req.response.err_code;
          
        if (errCode)
          console.error({ error: req.response.error, errCode: errCode });

        resolve(ret);
      };
  });
}

function queryAndSet2kkiMaps(locationNames) {
  return new Promise((resolve, _reject) => {
    const req = new XMLHttpRequest();
      const url = `https://2kki.app/getLocationMaps?locationNames=${locationNames.join('&locationNames=')}`;
      req.responseType = 'json';
      req.open("GET", url);
      req.send();

      set2kkiMaps([], null, true);

      req.onload = (_e) => {
        let errCode = null;

        if (Array.isArray(req.response))
          set2kkiMaps(req.response, locationNames, true, true);
        else
          errCode = req.response.err_code;
          
        if (errCode)
          console.error({ error: req.response.error, errCode: errCode });

        resolve();
      };
  });
}

function set2kkiMaps(maps, locationNames, cacheMaps, saveMaps) {
  const mapControls = document.getElementById('mapControls');
  mapControls.innerHTML = '';
  if (maps && maps.length) {
    for (let map of maps)
      mapControls.appendChild(get2kkiMapButton(map.url, map.label));
  }
  if (cacheMaps && locationNames) {
    mapCache[locationNames.join(',')] = maps;
    if (saveMaps) {
      config.mapCache[locationNames.join(',')] = maps;
      updateConfig(config);
    }
  }
}

function get2kkiMapButton(url, label) {
  const ret = document.createElement('button');
  ret.classList.add('mapButton');
  ret.classList.add('unselectable');
  ret.classList.add('iconButton');
  ret.title = label;
  ret.onclick = () => {
    const handle = window.open(url, '_blank', 'noreferrer');
    if (handle)
        handle.focus();
  };
  ret.innerHTML = '<svg viewbox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="m0 0l4 2 4-2 4 2v10l-4-2-4 2-4-2v-10m4 2v10m4-12v10"></path></svg>';
  return ret;
}

function set2kkiExplorerLinks(locationNames) {
  const explorerControls = document.getElementById('explorerControls');
  if (!explorerControls)
    return;
  explorerControls.innerHTML = '';
  if (!locationNames)
    return;
  for (let locationName of locationNames)
    explorerControls.appendChild(get2kkiExplorerButton(locationName, locationNames.length > 1))
}

function get2kkiExplorerButton(locationName, isMulti) {
  const ret = document.createElement('button');
  const localizedExplorerLinks = localizedMessages['2kki'].explorerLink;
  ret.title = !isMulti ? localizedExplorerLinks.generic : localizedExplorerLinks.multi.replace('{LOCATION}', locationName);
  ret.classList.add('unselectable');
  ret.classList.add('iconButton');

  const url = `https://2kki.app/?location=${locationName}&lang=${config.lang}`;

  ret.onclick = () => {
    const handle = window.open(url, '_blank');
    if (handle)
        handle.focus();
  };

  ret.innerHTML = '<svg viewbox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="m6.75 0v4.5h4.5v-4.5h-4.5m2.25 4.5v4.5h-1.5v3h3v-3h-1.5m0-3h-7.5v3h-1.5v3h3v-3h-1.5m7.5-3h7.5v3h-1.5v3h3v-3h-1.5m-7.5 3v3.75h-1.125v2.25h2.25v-2.25h-1.125m0-2.25h-7.5v2.25h-1.125v2.25h2.25v-2.25h-1.125m7.5-2.25h7.5v2.25h-1.125v2.25h2.25v-2.25h-1.125"></path></svg>';

  return ret;
}

if (is2kki)
  defaultLocations = getDefault2kkiLocations();