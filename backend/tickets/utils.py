import json
from uuid import UUID


class UUIDEncoder(json.JSONEncoder):
    """JSON encoder that converts UUID to string"""
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


def convert_uuid_to_string(data):
    """Recursively convert UUID objects to strings in a dictionary"""
    if isinstance(data, dict):
        return {key: convert_uuid_to_string(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_uuid_to_string(item) for item in data]
    elif isinstance(data, UUID):
        return str(data)
    else:
        return data