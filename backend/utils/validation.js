import validator from "validator";
import { mysqlSignedIntMaximum } from "./db.js";

/** True when `value` is an integer in the MySQL signed-int range (> 0). */
function isPositiveInteger(value) {
  return (
    Number.isInteger(value) && value > 0 && value <= mysqlSignedIntMaximum
  );
}

/** Coerces route params (strings) to a positive integer, or null when invalid. */
function toPositiveInteger(value) {
  if (typeof value === "number") {
    return isPositiveInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return isPositiveInteger(parsed) ? parsed : null;
}

/** Parses an RFC-3339 date-time string into a Date, or null when invalid. */
function parseIsoDateTime(value) {
  if (typeof value !== "string" || !validator.isRFC3339(value)) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parses a YYYY-MM-DD (or ISO) calendar date into a Date, or null. */
function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns the keys of `body` that are not in the `allowed` allow-list. */
function findUnexpectedFields(body, allowed) {
  return Object.keys(body ?? {}).filter((field) => !allowed.includes(field));
}

/** Trims a value when it is a non-empty string, otherwise returns null. */
function optionalTrimmedString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export {
  findUnexpectedFields,
  isPositiveInteger,
  optionalTrimmedString,
  parseDate,
  parseIsoDateTime,
  toPositiveInteger,
};
