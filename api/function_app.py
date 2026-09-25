"""
Azure Functions — Python v2 programming model.

Everything in this file runs on a machine in an Azure datacentre, not in
anyone's browser. That single fact is the whole point of this step, and it
has two consequences worth internalising:

  1. Nothing here is visible to the user. Secrets, keys and logic stay private.
  2. Nothing arriving here can be trusted. Every value in `req` was sent by a
     client you do not control, so it gets validated before it is used.

The v2 model means routes are declared with decorators and the whole API can
live in one file. There is no function.json and no folder per endpoint.
"""

import json
import logging
import platform
import statistics
from datetime import datetime, timezone

import azure.functions as func

# AuthLevel.ANONYMOUS means no function key is required to call these
# endpoints. Static Web Apps sits in front and handles access control itself —
# we wire that up in step 6.
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# An explicit ceiling on work accepted from a stranger. Without a bound, one
# request with a hundred million numbers is a denial-of-service against your
# own free tier.
MAX_VALUES = 10_000


def _json(payload: dict, status: int = 200) -> func.HttpResponse:
    """Every response leaves as JSON with the right content type."""
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status,
        mimetype="application/json",
    )


# ---------------------------------------------------------------------------
# GET /api/status
#
# Exists purely to prove the server is real. Everything it reports is
# knowledge the browser does not have and cannot fabricate.
# ---------------------------------------------------------------------------
@app.route(route="status", methods=["GET"])
def status(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("status endpoint called")

    return _json(
        {
            "runtime": f"Python {platform.python_version()}",
            "platform": platform.system(),
            "server_time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "note": "Computed on a server. Your browser only asked for it.",
        }
    )


# ---------------------------------------------------------------------------
# POST /api/stats
#
# Takes a list of numbers, returns descriptive statistics.
#
# Note how much of this function is validation rather than arithmetic. That
# ratio is normal and correct for anything reachable from the open internet.
# ---------------------------------------------------------------------------
@app.route(route="stats", methods=["POST"])
def stats(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Is it JSON at all?
    try:
        body = req.get_json()
    except ValueError:
        return _json({"error": "Request body must be valid JSON."}, 400)

    if not isinstance(body, dict):
        return _json({"error": "Expected a JSON object with a 'values' key."}, 400)

    values = body.get("values")

    # 2. Is it a list?
    if not isinstance(values, list):
        return _json({"error": "'values' must be an array of numbers."}, 400)

    # 3. Is it a sane size? Check before touching the contents.
    if len(values) < 2:
        return _json({"error": "Need at least 2 values."}, 400)

    if len(values) > MAX_VALUES:
        return _json({"error": f"Too many values (limit {MAX_VALUES})."}, 413)

    # 4. Is every element actually a number? JSON booleans are ints in Python,
    #    so they are excluded explicitly.
    numbers = []
    for i, v in enumerate(values):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return _json({"error": f"Element {i} is not a number."}, 400)
        numbers.append(float(v))

    # Only now, with the input fully checked, do we compute anything.
    result = {
        "n": len(numbers),
        "mean": statistics.fmean(numbers),
        "median": statistics.median(numbers),
        "stdev": statistics.stdev(numbers),
        "variance": statistics.variance(numbers),
        "min": min(numbers),
        "max": max(numbers),
    }

    quartiles = statistics.quantiles(numbers, n=4, method="inclusive")
    result["q1"], result["q3"] = quartiles[0], quartiles[2]

    return _json({k: round(v, 6) if isinstance(v, float) else v for k, v in result.items()})
