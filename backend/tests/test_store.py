import pytest

from functions.common import store as st


class FakeDynamo:
    """Just enough of the DynamoDB client for DynamoStore."""

    def __init__(self, page_size=2):
        self.items, self.page_size = {}, page_size

    def put_item(self, TableName, Item):
        self.items[(Item["pk"]["S"], Item["sk"]["S"])] = Item

    def get_item(self, TableName, Key):
        item = self.items.get((Key["pk"]["S"], Key["sk"]["S"]))
        return {"Item": item} if item else {}

    def query(self, TableName, **kw):
        vals = kw["ExpressionAttributeValues"]
        if kw.get("IndexName") == "GSI1":
            rows = sorted((i for i in self.items.values() if i.get("gsi1pk", {}).get("S") == vals[":g"]["S"]),
                          key=lambda i: i["gsi1sk"]["S"])
        else:
            rows = sorted((i for (pk, sk), i in self.items.items()
                           if pk == vals[":p"]["S"] and sk.startswith(vals[":s"]["S"])),
                          key=lambda i: i["sk"]["S"], reverse=not kw.get("ScanIndexForward", True))
        start = int(kw.get("ExclusiveStartKey", {}).get("n", 0))
        limit = kw.get("Limit", self.page_size)
        page = rows[start:start + limit]
        out = {"Items": page}
        if start + limit < len(rows) and "Limit" not in kw:
            out["LastEvaluatedKey"] = {"n": str(start + limit)}
        return out


@pytest.fixture(params=["memory", "dynamo"])
def store(request):
    return st.MemoryStore() if request.param == "memory" else st.DynamoStore("t", client=FakeDynamo())


TT = {"school": {"name": "A"}, "slots": [], "classes": []}


def test_school_round_trip(store):
    assert store.get_school("x") is None
    store.put_school("x", TT, "hash1", now=100)
    assert store.get_school("x") == {"timetable": TT, "key_hash": "hash1", "updated_at": 100}


def test_put_school_overwrites(store):
    store.put_school("x", TT, "h", now=1)
    store.put_school("x", {**TT, "school": {"name": "B"}}, "h", now=2)
    assert store.get_school("x")["timetable"]["school"]["name"] == "B"


def test_school_ids_lists_all_schools_across_pages(store):
    for i in range(5):
        store.put_school(f"s{i}", TT, "h", now=1)
    store.put_result("s0", {"date": "2026-10-09", "status": "planned"}, now=1)
    assert sorted(store.school_ids()) == [f"s{i}" for i in range(5)]


def test_latest_result_is_newest_date(store):
    assert store.latest_result("x") is None
    store.put_result("x", {"date": "2026-10-08", "status": "planned"}, now=1)
    store.put_result("x", {"date": "2026-10-09", "status": "no_school"}, now=2)
    store.put_result("y", {"date": "2026-10-10", "status": "planned"}, now=3)
    assert store.latest_result("x") == {"date": "2026-10-09", "status": "no_school", "created_at": 2}


def test_result_expires(store):
    store.put_result("x", {"date": "2026-10-09", "status": "planned"}, now=1000)
    if isinstance(store, st.DynamoStore):
        item = store.client.items[("SCHOOL#x", "RESULT#2026-10-09")]
        assert int(item["expires_at"]["N"]) == 1000 + st.RESULT_TTL_SECONDS


def test_store_from_env(monkeypatch):
    monkeypatch.delenv("TABLE_NAME", raising=False)
    assert st.store_from_env() is None
