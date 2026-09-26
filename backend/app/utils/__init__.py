"""Standardized API response helpers and pagination utility."""

from flask import jsonify, request


def success_response(data=None, meta=None, status=200, message=None):
    body = {'success': True}
    if message:
        body['message'] = message
    if data is not None:
        body['data'] = data
    if meta is not None:
        body['meta'] = meta
    return jsonify(body), status


def error_response(code, message, status=400, details=None):
    body = {
        'success': False,
        'error': {
            'code': code,
            'message': message,
        },
    }
    if details:
        body['error']['details'] = details
    return jsonify(body), status


def paginate_query(query, schema_fn=None):
    """Apply pagination to a SQLAlchemy query and return (items, meta).

    Uses ``page`` and ``per_page`` query parameters.
    ``schema_fn`` is called on each item to serialize it; defaults to ``.to_dict()``.
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 100)

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 25

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    if schema_fn is None:
        schema_fn = lambda item: item.to_dict()

    items = [schema_fn(item) for item in pagination.items]
    meta = {
        'page': pagination.page,
        'per_page': pagination.per_page,
        'total': pagination.total,
        'total_items': pagination.total,
        'pages': pagination.pages,
        'total_pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    }
    return items, meta
