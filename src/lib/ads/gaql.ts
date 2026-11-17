/** GAQL queries. Field names are the REST (camelCase) shapes in results. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CUSTOMER_INFO_QUERY = `
  SELECT customer.id, customer.descriptive_name, customer.currency_code,
         customer.time_zone, customer.manager, customer.test_account, customer.status
  FROM customer`;

/** Direct child accounts of a manager account. */
export const CUSTOMER_CLIENTS_QUERY = `
  SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
         customer_client.time_zone, customer_client.manager, customer_client.test_account,
         customer_client.status, customer_client.level
  FROM customer_client
  WHERE customer_client.level = 1 AND customer_client.status = 'ENABLED'`;

export function campaignDailyMetricsQuery(from: string, to: string): string {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new Error("Dates must be YYYY-MM-DD");
  if (from > to) throw new Error("from must not be after to");
  return `
  SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date,
         metrics.cost_micros, metrics.clicks, metrics.impressions,
         metrics.conversions, metrics.conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '${from}' AND '${to}'`;
}
