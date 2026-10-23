# Learnings

- Model names get retired; a 404 usually means the model is gone.

## How retrace/llm.py works

`llm.py` is the only file in Retrace that talks to a model. Everything else calls its `complete()` function.

### The pieces, top to bottom

- **`CACHE_DIR`** is the folder where saved answers go: `.cache/llm/`. It is git-ignored.
- **`PROVIDERS`** is a dictionary, a lookup table. For each provider name it holds a pair: the web address to send requests to, and the name of the environment variable that holds the API key. Ollama runs on your own machine, so it has no key (`None`).
- **`QuotaExceeded`** is a custom error type. Python code signals problems by *raising* an error. A specific type lets calling code tell "out of quota" apart from other failures.
- **`_redact(text)`** removes API keys from a piece of text before anyone sees it. It replaces your actual key values, anything after `?key=`, and anything after `Bearer ` with `[REDACTED]`. The leading underscore is a Python convention meaning "internal, don't call this from outside the file".
- **`_post(url, headers, body)`** sends one HTTP request to the provider and gets the reply back.
  - A 429 status means "too many requests", so it raises `QuotaExceeded`.
  - Any other failure, such as 404 (model not found) or 401 (bad key), raises an `HTTPError` that includes the provider's own explanation, with keys redacted.
  - On success it returns the reply turned from JSON into a Python dictionary.
  - It is the only line that touches the network, which is why tests replace just this one function with a fake.
- **`cache_key(messages, tools, model)`** turns a request into a short fingerprint (see below).
- **`complete(messages, tools=None, model=DEFAULT_MODEL)`** is the function you actually use. Steps:
  1. Build the cache key. If `.cache/llm/<key>.json` exists, read it and return it with `"cached": True`. No network call, no tokens spent.
  2. Split the model string at the first `/`. So `"groq/openai/gpt-oss-20b"` becomes provider `groq` and name `openai/gpt-oss-20b`. An unknown provider is a `ValueError`.
  3. Look up the provider's address and key. If the key isn't set, raise an error that names the missing variable, never the value.
  4. Build the request body with `temperature: 0`, which asks for the least random answer, plus the tools if any were given.
  5. Time the call and send it through `_post`.
  6. Keep only what Retrace needs: the reply `message`, token `usage` and `latency_ms`.
  7. Save it to the cache. It writes to a `.tmp` file first and then renames it. A rename is all-or-nothing, so a run killed mid-write never leaves a broken cache file.
  8. Return the result with `"cached": False`.

### How the cache key is built

1. Put the three things that define the request into one dictionary: `model`, `messages` and `tools`.
2. Turn it into a JSON string with `sort_keys=True`. This writes dictionary keys in alphabetical order, so `{"a":1,"b":2}` and `{"b":2,"a":1}` give the same string. The *order of messages* still matters, as it should, because a conversation in a different order is a different conversation.
3. Run the string through SHA-256. That gives a 64-character fingerprint: the same input always gives the same fingerprint, and any change, even one character, gives a completely different one.
4. Use the fingerprint as the file name: `.cache/llm/<fingerprint>.json`.

Changing the model, any message or any tool definition means a cache miss. `temperature` isn't part of the key because it is always 0.

### What happens when the quota runs out

1. The provider answers with HTTP status 429.
2. `_post` raises `QuotaExceeded` (with keys redacted from the message). Nothing is written to the cache, because nothing good came back.
3. `complete` doesn't catch the error, so it travels up to whatever code was running the agent. Unless that code catches it, the program stops.
4. Next time (for example tomorrow, when the quota resets) you run the same thing again. Every call that already succeeded has the same input as before, so it is answered from the cache instantly and for free. The run reaches the point where it stopped, and only from there does it make new, live calls.

Caveats:
- 429 can also mean a short per-minute rate limit, not just the daily quota. `llm.py` treats both the same way and stops; it does not wait and retry.
- Resuming only works if every input is the same as last time. Model calls are cached here, but tool results are not yet (that comes with replay, R3). A tool that returns something different on the second run, such as the current time, changes the next message, so the cache misses from that point on.
