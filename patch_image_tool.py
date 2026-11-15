import re

with open("/Users/Apple/src/free-claude-code/api/services.py", "r") as f:
    content = f.read()

patch = """            # --- PREVENT IMAGE RLHF CONFUSION ---
            # If a tool_result contains an image but no text, Claude's RLHF triggers a "what do you want me to do with this image" reflex
            # because the tool_result is sent as a user message. We inject a dummy text block to prevent this context amnesia.
            from api.models.anthropic import ContentBlockText
            for msg in request_data.messages:
                if msg.role == "user" and isinstance(msg.content, list):
                    for block in msg.content:
                        if getattr(block, "type", None) == "tool_result" and isinstance(getattr(block, "content", None), list):
                            has_image = any(getattr(c, "type", None) == "image" or (isinstance(c, dict) and c.get("type") == "image") for c in block.content)
                            has_text = any(getattr(c, "type", None) == "text" or (isinstance(c, dict) and c.get("type") == "text") for c in block.content)
                            if has_image and not has_text:
                                block.content.append(ContentBlockText(type="text", text="[System: Image successfully read from tool.]"))
"""

content = content.replace("            _require_non_empty_messages(request_data.messages)", "            _require_non_empty_messages(request_data.messages)\n\n" + patch)

with open("/Users/Apple/src/free-claude-code/api/services.py", "w") as f:
    f.write(content)
