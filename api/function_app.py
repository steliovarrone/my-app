"""
Azure Functions — Python v2 programming model.

New in step 4: the API can remember. Results are written to Cosmos DB and
read back by anyone, which is the first time one visitor's action becomes
visible to another.

Two rules this file follows, both worth carrying into anything you build later:

  1. Credentials come from the environment, never from source. There is no
     connection string in this file and there never will be.
  2. Only what is needed gets stored. The raw numbers a visitor submits are
     used and discarded; only the summary is persisted. Storing less is the
     cheapest privacy measure there is, and the only one that can't leak.
"""

import json
import logging
import os
import platform
import statistics
import uuid
from datetime import datetime, timezone

import azure.functions as func
from azure.cosmos import CosmosClient, exceptions

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

MAX_VALUES = 10_000
HISTORY_LIMIT = 20

DATABASE_NAME = "appdata"
CONTAINER_NAME = "runs"

# The client is expensive to construct, so it's built once and reused. A warm
# function keeps this between requests; a cold one pays for it again. This is
# why module-level state matters more in serverless than it looks.
_container = None


def _get_container():
    """Build the Cosmos client on first use, then reuse it."""
    global _container

    if _container is not None:
        return _container

    url = os.environ.get("COSMOS_URI")
    key = os.environ.get("COSMOS_KEY")

    if not url or not key:
        # A missing setting is a deployment problem, not a user problem.
        # Say so clearly rather than letting it surface as a 500.
        raise RuntimeError("COSMOS_URI and COSMOS_KEY are not configured.")

    client = CosmosClient(url, credential=key)
    _container = client.get_database_client(DATABASE_NAME).get_container_client(
        CONTAINER_NAME
    )
    return _container


def _json(payload, status: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status,
        mimetype="application/json",
    )


def _today() -> str:
    """The partition key. See the note in the README for why it's the date."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# GET /api/status
# ---------------------------------------------------------------------------
@app.route(route="status", methods=["GET"])
def status(req: func.HttpRequest) -> func.HttpResponse:
    configured = bool(os.environ.get("COSMOS_URI") and os.environ.get("COSMOS_KEY"))

    return _json(
        {
            "runtime": f"Python {platform.python_version()}",
            "platform": platform.system(),
            "server_time_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "database": "connected" if configured else "not configured",
        }
    )


# ---------------------------------------------------------------------------
# POST /api/stats
# ---------------------------------------------------------------------------
@app.route(route="stats", methods=["POST"])
def stats(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return _json({"error": "Request body must be valid JSON."}, 400)

    if not isinstance(body, dict):
        return _json({"error": "Expected a JSON object with a 'values' key."}, 400)

    values = body.get("values")

    if not isinstance(values, list):
        return _json({"error": "'values' must be an array of numbers."}, 400)

    if len(values) < 2:
        return _json({"error": "Need at least 2 values."}, 400)

    if len(values) > MAX_VALUES:
        return _json({"error": f"Too many values (limit {MAX_VALUES})."}, 413)

    numbers = []
    for i, v in enumerate(values):
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return _json({"error": f"Element {i} is not a number."}, 400)
        numbers.append(float(v))

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
    result = {k: round(v, 6) if isinstance(v, float) else v for k, v in result.items()}

    # --- persist a summary -------------------------------------------------
    # Note what is NOT in this record: `numbers`. The visitor's actual data
    # never lands on disk. If this container leaked tomorrow, it would reveal
    # that someone computed a mean, not what they computed it from.
    saved = False
    try:
        _get_container().create_item(
            body={
                "id": str(uuid.uuid4()),
                "day": _today(),
                "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "n": result["n"],
                "mean": result["mean"],
                "stdev": result["stdev"],
            }
        )
        saved = True
    except (exceptions.CosmosHttpResponseError, RuntimeError) as err:
        # A failed write must not fail the calculation. The user asked for
        # statistics, not for a database. Log it and carry on degraded.
        logging.error("could not write to cosmos: %s", err)

    return _json({**result, "saved": saved})


# ---------------------------------------------------------------------------
# GET /api/history
#
# Returns the most recent runs from today. "Today" is not a UI decision — it
# is forced by the partition key, and that is the lesson of this endpoint.
# ---------------------------------------------------------------------------
@app.route(route="history", methods=["GET"])
def history(req: func.HttpRequest) -> func.HttpResponse:
    try:
        container = _get_container()
    except RuntimeError as err:
        return _json({"error": str(err)}, 503)

    query = (
        "SELECT TOP @limit c.id, c.ts, c.n, c.mean, c.stdev "
        "FROM c WHERE c.day = @day ORDER BY c.ts DESC"
    )

    try:
        items = list(
            container.query_items(
                query=query,
                parameters=[
                    {"name": "@limit", "value": HISTORY_LIMIT},
                    {"name": "@day", "value": _today()},
                ],
                # Naming the partition key keeps this a single-partition read.
                # Remove this line and Cosmos fans the query out across every
                # partition — same answer, many times the cost.
                partition_key=_today(),
            )
        )
    except exceptions.CosmosHttpResponseError as err:
        logging.error("cosmos query failed: %s", err)
        return _json({"error": "Could not read history."}, 502)

    return _json({"day": _today(), "count": len(items), "runs": items})
