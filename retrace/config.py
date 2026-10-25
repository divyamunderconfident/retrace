"""Model names in one place. Providers retire models often; a 404 from llm.py usually means one is gone."""

# Groq: https://console.groq.com/docs/models (or GET https://api.groq.com/openai/v1/models with your key)
GROQ_MODEL = "groq/openai/gpt-oss-20b"

# Gemini: https://ai.google.dev/gemini-api/docs/models
# (or GET https://generativelanguage.googleapis.com/v1beta/openai/models with your key)
GEMINI_MODEL = "gemini/gemini-3.5-flash-lite"

# Ollama: run `ollama list` for models pulled locally; browse https://ollama.com/library. None chosen yet.

DEFAULT_MODEL = GROQ_MODEL

# USD per 1M tokens, by provider. Free tiers and local models cost nothing; set real prices on a paid tier.
PRICE_PER_MILLION_TOKENS = {"groq": 0.0, "gemini": 0.0, "ollama": 0.0}
