"""Saved schools and their nightly results.

DynamoDB single table (pk/sk):
  School:  pk=SCHOOL#<id>  sk=META                 gsi1pk=SCHOOL  gsi1sk=<id>
  Result:  pk=SCHOOL#<id>  sk=RESULT#<YYYY-MM-DD>  expires_at (TTL)
MemoryStore has the same interface for tests and the local API.
"""

import json
import os

RESULT_TTL_SECONDS = 30 * 24 * 3600


class MemoryStore:
    def __init__(self):
        self.schools, self.results = {}, {}

    def put_school(self, school_id, timetable, key_hash, now):
        self.schools[school_id] = {"timetable": timetable, "key_hash": key_hash, "updated_at": now}

    def get_school(self, school_id):
        return self.schools.get(school_id)

    def school_ids(self):
        return sorted(self.schools)

    def put_result(self, school_id, result, now):
        self.results.setdefault(school_id, {})[result["date"]] = {**result, "created_at": now}

    def latest_result(self, school_id):
        by_date = self.results.get(school_id)
        return by_date[max(by_date)] if by_date else None


class DynamoStore:
    def __init__(self, table_name, client=None):
        if client is None:
            import boto3  # in the Lambda runtime
            client = boto3.client("dynamodb")
        self.table, self.client = table_name, client

    def put_school(self, school_id, timetable, key_hash, now):
        self.client.put_item(TableName=self.table, Item={
            "pk": {"S": f"SCHOOL#{school_id}"}, "sk": {"S": "META"},
            "gsi1pk": {"S": "SCHOOL"}, "gsi1sk": {"S": school_id},
            "data": {"S": json.dumps(timetable, ensure_ascii=False)},
            "key_hash": {"S": key_hash},
            "updated_at": {"N": str(int(now))},
        })

    def get_school(self, school_id):
        item = self.client.get_item(TableName=self.table,
                                    Key={"pk": {"S": f"SCHOOL#{school_id}"}, "sk": {"S": "META"}}).get("Item")
        if not item:
            return None
        return {"timetable": json.loads(item["data"]["S"]), "key_hash": item["key_hash"]["S"],
                "updated_at": int(item["updated_at"]["N"])}

    def school_ids(self):
        ids, kw = [], {}
        while True:
            page = self.client.query(TableName=self.table, IndexName="GSI1",
                                     KeyConditionExpression="gsi1pk = :g",
                                     ExpressionAttributeValues={":g": {"S": "SCHOOL"}}, **kw)
            ids += [i["gsi1sk"]["S"] for i in page["Items"]]
            if "LastEvaluatedKey" not in page:
                return ids
            kw = {"ExclusiveStartKey": page["LastEvaluatedKey"]}

    def put_result(self, school_id, result, now):
        self.client.put_item(TableName=self.table, Item={
            "pk": {"S": f"SCHOOL#{school_id}"}, "sk": {"S": f"RESULT#{result['date']}"},
            "data": {"S": json.dumps(result, ensure_ascii=False)},
            "created_at": {"N": str(int(now))},
            "expires_at": {"N": str(int(now) + RESULT_TTL_SECONDS)},
        })

    def latest_result(self, school_id):
        page = self.client.query(TableName=self.table,
                                 KeyConditionExpression="pk = :p AND begins_with(sk, :s)",
                                 ExpressionAttributeValues={":p": {"S": f"SCHOOL#{school_id}"},
                                                            ":s": {"S": "RESULT#"}},
                                 ScanIndexForward=False, Limit=1)
        if not page["Items"]:
            return None
        item = page["Items"][0]
        return {**json.loads(item["data"]["S"]), "created_at": int(item["created_at"]["N"])}


def store_from_env():
    name = os.environ.get("TABLE_NAME")
    return DynamoStore(name) if name else None
