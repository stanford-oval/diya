'use strict';

const addDays = require('date-fns/addDays');
const axios = require('axios');
const compareAsc = require('date-fns/compareAsc');

const parseTime = async rawTime => {
  // TODO: Time zone support
  const endpoint = 'https://almond-nl.stanford.edu/en-US/tokenize';
  try {
    const res = await axios.get(endpoint, { params: { q: rawTime } });
    const { tokens, entities } = res.data;

    if (tokens.length !== 1 || !['TIME_0', 'DATE_0'].includes(tokens[0])) {
      throw Error('Invalid date/time.');
    }

    const token = tokens[0];

    if (token === 'TIME_0') {
      const { hour, minute, second } = entities['TIME_0'];
      const now = new Date();
      const datetime = new Date();
      datetime.setHours(hour);
      datetime.setMinutes(minute);
      datetime.setSeconds(second);

      // if specified time has already passed today, set to tomorrow
      console.log(now);
      if (compareAsc(now, datetime) === 1) {
        return addDays(datetime, 1);
      }

      return datetime;
    }
  } catch (e) {
    throw Error(e);
  }
};

module.exports = { parseTime };
