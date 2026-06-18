import os
from dotenv import load_dotenv
import anthropic

load_dotenv()
key = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=key)

print(f"Testing Key: {key[:10]}...")

# List of models to try, from best to fallback
models_to_test = [
    "claude-3-sonnet-20240229",       # Try the generic alias
    "claude-3-5-sonnet-20241022",     # The new version
    "claude-3-5-sonnet-20240620",     # The old version
    "claude-3-opus-20240229",         # The powerful legacy version
    "claude-3-sonnet-20240229"         # The fast/cheap version (almost everyone has this)
]

print("\n--- STARTING MODEL CHECK ---")

for model in models_to_test:
    print(f"\nTesting: {model}")
    try:
        client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}]
        )
        print(f"✅ PASSED! Your account can use: {model}")
        # Stop at the first working model
        break 
    except anthropic.NotFoundError:
        print(f"❌ FAILED (404): Access Denied for {model}")
    except anthropic.BadRequestError as e:
        print(f"❌ FAILED (400): {e.body.get('message')}")
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

print("\n--- END CHECK ---")