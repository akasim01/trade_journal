import { format, parseISO } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

export const formatLocalTime = (isoString: string, timezone: string) => {
  // Convert UTC time to user's timezone
  const zonedDate = utcToZonedTime(parseISO(isoString), timezone);
  return format(zonedDate, 'h:mm a');
};

export const formatLocalDate = (isoString: string, timezone: string) => {
  // Convert UTC date to user's timezone
  const zonedDate = utcToZonedTime(parseISO(isoString), timezone);
  return format(zonedDate, 'MM/dd/yyyy');
};

export const localToUTC = (dateTimeString: string, timezone: string) => {
  // Convert local datetime-local value to UTC
  const localDate = parseISO(dateTimeString);
  return zonedTimeToUtc(localDate, timezone).toISOString();
};

export const formatDateFromDB = (dateString: string, _timezone: string) => {
  // Parse the date string directly without timezone conversion
  const date = parseISO(dateString);
  return format(date, 'MM/dd/yyyy');
};