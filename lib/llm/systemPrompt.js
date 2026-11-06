// @ts-check

/**
 * Format a date using the host's local timezone.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatLocalDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Format a date and time using the host's local timezone.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatLocalDateTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${formatLocalDate(date)} à ${hours}:${minutes}:${seconds}`;
}

/**
 * Get the IANA name of the host's local timezone.
 *
 * @returns {string}
 */
function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Add the current date and time to an agent system prompt.
 *
 * The date is evaluated for every request so long-running processes keep
 * providing an up-to-date value after midnight.
 *
 * @param {string} [prompt]
 * @param {Date} [now]
 * @returns {string}
 */
function withCurrentDateTime(
  prompt = '',
  now = new Date(),
  timeZone = getLocalTimeZone()
) {
  const currentDateTime = formatLocalDateTime(now);
  const dateTimeContext =
    `<current_datetime>${currentDateTime} ` +
    `(${timeZone})</current_datetime>`;
  return prompt ? `${prompt}\n\n${dateTimeContext}` : dateTimeContext;
}

module.exports = {
  formatLocalDate,
  formatLocalDateTime,
  getLocalTimeZone,
  withCurrentDateTime,
};
