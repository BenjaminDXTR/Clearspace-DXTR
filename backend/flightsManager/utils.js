// backend/utils/utils.js

function getWeekPeriod(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToSunday = -day;
  const sunday = new Date(d);
  sunday.setDate(sunday.getDate() + diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (date) => date.toISOString().slice(0, 10);
  return {
    start: fmt(sunday),
    end: fmt(saturday),
    filename: `history-${fmt(sunday)}_to_${fmt(saturday)}.json`,
  };
}

module.exports = { getWeekPeriod };
