const createError = require('http-errors');
const Ajax = require('../Ajax');
const WeatherApi = require('../WeatherApi');
const { sleep } = require('../../helpers');

const { googleApiKey } = require('../../config');

/* --- Functions --- */
const getGoogleUrlWithKey = url => {
  return `${url}&key=${googleApiKey}`;
};

const getGoogleStatusCode = ({ status }) => {
  switch (status) {
    case 'OK':
      return 200;
    case 'ZERO_RESULTS':
      return 204;
    case 'OVER_QUERY_LIMIT':
      return 429;
    default:
      return 500;
  }
};

const unifyDifferentApiPlaceData = place => {
  return place.candidates ? place.candidates[0] : place.result;
};

/* --- Main --- */
class GoogleApi {
  static async get(url, timesRepeated = 0, delay = 200) {
    try {
      const urlWithKey = getGoogleUrlWithKey(url);
      const data = await Ajax.get(urlWithKey);
      data.statusCode = getGoogleStatusCode(data);
      if (data.statusCode >= 400 && timesRepeated < 3) {
        await sleep(delay);
        return GoogleApi.get(url, timesRepeated + 1, delay * 2);
      }
      console.log(data);
      return data;
    } catch (err) {
      throw createError(err);
    }
  }

  static async processAutocomplete(url) {
    try {
      const autocompleteRes = await GoogleApi.get(url);
      const { statusCode } = autocompleteRes;
      if (statusCode >= 400) {
        return autocompleteRes;
      }

      const predictionList = await autocompleteRes.predictions.map(
        ({ description, place_id: placeId }) => ({
          description,
          placeId
        })
      );

      return { statusCode, predictionList };
    } catch (err) {
      throw createError(err);
    }
  }

  static async getProcessedWeather(url) {
    try {
      const placeData = await GoogleApi.get(url);
      const { statusCode } = placeData;

      if (statusCode !== 200) {
        return placeData;
      }

      const curPlaceData = unifyDifferentApiPlaceData(placeData);

      const { geometry, name } = curPlaceData;
      const { lat, lng: lon } = geometry.location;

      const { cod, list } = await WeatherApi.get(lat, lon);
      // TODO: Error 406 - Weather api limit
      return { statusCode: +cod || cod || 406, weatherData: list, placeName: name };
    } catch (err) {
      throw createError(err);
    }
  }
}

module.exports = GoogleApi;
