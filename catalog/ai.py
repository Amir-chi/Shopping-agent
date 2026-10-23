"""BoxAPI chat client (OpenAI-style). The key comes only from the environment; nothing here is sent client-side."""
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
import urllib.error
import urllib.request

from django.core.cache import cache

logger = logging.getLogger(__name__)
BASE_URL = os.environ.get('AI_BASE_URL', 'https://ai.boxapi.ir/ai/v1').rstrip('/')
MODEL = os.environ.get('AI_MODEL', 'openai/gpt-6-luna')
ROUTER_MODEL = os.environ.get('AI_ROUTER_MODEL', MODEL)


class Unavailable(Exception):
    """AI is not configured or the provider failed; callers fall back to rule-based results."""


def enabled():
    return bool(os.environ.get('AI_API_KEY'))


def _post(model, messages, timeout, max_output_tokens=None, reasoning_effort=None):
    payload = dict(model=model, messages=messages, response_format={'type': 'json_object'})
    if max_output_tokens:
        payload['max_completion_tokens' if model.startswith('openai/') else 'max_tokens'] = max_output_tokens
    if reasoning_effort:
        # Reasoning tokens count against max_completion_tokens; an exhausted cap returns empty content.
        payload['reasoning_effort'] = reasoning_effort
    body = json.dumps(payload).encode()
    request = urllib.request.Request(BASE_URL + '/chat/completions', body, method='POST', headers={
        'Authorization': 'Bearer ' + os.environ['AI_API_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def chat_json(system, user, router=False, timeout=45, cache_seconds=3600, model=None, max_output_tokens=None,
              reasoning_effort=None):
    """One JSON-object completion. Cached by prompt so repeated questions cost nothing."""
    if not enabled():
        raise Unavailable('AI_API_KEY is not set')
    model = model or (ROUTER_MODEL if router and not cache.get('ai:router-blocked') else MODEL)
    key = 'ai:' + hashlib.sha256(json.dumps([model, system, user, max_output_tokens, reasoning_effort],
                                            ensure_ascii=False).encode()).hexdigest()
    if (hit := cache.get(key)) is not None:
        return hit
    messages = [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]
    try:
        data = _post(model, messages, timeout, max_output_tokens, reasoning_effort)
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors='replace')
        if router and model != MODEL and 'model_not_allowed' in detail:
            cache.set('ai:router-blocked', True, 3600)
            return chat_json(system, user, router=False, timeout=timeout, cache_seconds=cache_seconds)
        logger.warning('AI request failed: HTTP %s', error.code)
        raise Unavailable('AI provider error') from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        logger.warning('AI request failed: %s', type(error).__name__)
        raise Unavailable('AI provider unreachable') from error
    try:
        result = json.loads(data['choices'][0]['message']['content'])
    except (KeyError, IndexError, TypeError, ValueError) as error:
        try:
            finish = data['choices'][0]['finish_reason']
        except (KeyError, IndexError, TypeError):
            finish = None
        logger.warning('AI returned no JSON (finish_reason=%s)', finish)  # 'length' = output cap too small
        raise Unavailable('AI returned no JSON') from error
    if not isinstance(result, dict):
        raise Unavailable('AI returned no JSON object')
    cache.set(key, result, cache_seconds)
    return result


def web_search_json(system, user, timeout=90, cache_seconds=6 * 3600):
    """One web-searching answer (Responses API + web_search tool) parsed as a JSON object, with the URLs the search saw."""
    if not enabled():
        raise Unavailable('AI_API_KEY is not set')
    key = 'ai-web:' + hashlib.sha256(json.dumps([MODEL, system, user], ensure_ascii=False).encode()).hexdigest()
    if (hit := cache.get(key)) is not None:
        return hit
    body = json.dumps(dict(model=MODEL, tools=[{'type': 'web_search', 'user_location': {'type': 'approximate', 'country': 'IR', 'city': 'Tehran'}}],
                           include=['web_search_call.action.sources'],
                           input=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}])).encode()
    request = urllib.request.Request(BASE_URL + '/responses', body, method='POST', headers={
        'Authorization': 'Bearer ' + os.environ['AI_API_KEY'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read())
    except urllib.error.HTTPError as error:
        logger.warning('AI web search failed: HTTP %s', error.code)
        raise Unavailable('AI provider error') from error
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        logger.warning('AI web search failed: %s', type(error).__name__)
        raise Unavailable('AI provider unreachable') from error
    seen, text = set(), ''
    for item in data.get('output') or []:
        action = item.get('action') or {}
        seen.update(u for u in [action.get('url')] + [s.get('url') for s in action.get('sources') or []] if u)
        for part in item.get('content') or []:
            text += part.get('text') or ''
            seen.update(a['url'] for a in part.get('annotations') or [] if a.get('url'))
    try:
        result = json.loads(text[text.index('{'):text.rindex('}') + 1])
    except ValueError as error:
        raise Unavailable('AI returned no JSON') from error
    if not isinstance(result, dict):
        raise Unavailable('AI returned no JSON object')
    result = dict(answer=result, seen=sorted(seen), at=datetime.now(timezone.utc).isoformat(timespec='minutes'))
    cache.set(key, result, cache_seconds)
    return result
