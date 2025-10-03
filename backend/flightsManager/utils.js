function getWeekPeriod(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToSunday = -day;
  const sunday = new Date(d);
  sunday.setDate(sunday.getDate() + diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (date) => date.toISOString().slice(0, 10);

  // Optionnel : log debug
  log.debug(`[utils] Calculated week period from ${dateStr}: ${fmt(sunday)} to ${fmt(saturday)}`);

  return {
    start: fmt(sunday),
    end: fmt(saturday),
    filename: `history-${fmt(sunday)}_to_${fmt(saturday)}.json`,
  };
}

module.exports = { getWeekPeriod };
