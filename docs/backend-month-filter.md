# Backend updates for monthly filtering

The manager dashboard now requests data scoped to a specific month for several widgets. To keep the API aligned with the new client behaviour, ensure the following Express endpoints accept optional `from` and `to` query parameters (ISO `yyyy-MM-dd` strings) and apply them when building queries:

## `GET /employee-earnings`
* Add support for `from` and `to` filters when fetching earnings. Use them to constrain the result set with an inclusive date range.
* Apply the same logic in the pagination helpers and any `COUNT(*)` queries used for total counts so pagination stays in sync with the filtered range.

## `GET /employee-earnings/leaderboard`
* Accept `from`/`to` and constrain the aggregation window to the selected month before grouping and ranking chatters.

## `GET /models/earnings`
* Apply the optional range filter before aggregating totals per model so the leaderboard only reflects the requested period.

## `GET /revenue/earnings`
* Limit the raw revenue rows to the requested range so the profit widgets load only the relevant data.

When validating dates, remember that the UI always sends `YYYY-MM-01` for `from` and the last day of the month for `to`. Treat the values as inclusive bounds. If the parameters are absent, fall back to the current behaviour (usually “all time”).

