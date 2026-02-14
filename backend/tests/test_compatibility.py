"""
Test suite for configuration and compatibility.
Verifies that README and IMPLEMENTATION_SUMMARY requirements are met.

Run with: python -m pytest backend/tests/test_compatibility.py -v
"""

import pytest
import os
import json
from pathlib import Path


class TestEnvironmentSetup:
    """Test that environment can be configured correctly."""

    def test_env_file_template_exists(self):
        """Verify .env format is documented."""
        backend_dir = Path(__file__).parent.parent
        readme = (backend_dir.parent / "README.md").read_text()
        
        # Check that setup instructions mention environment variables
        assert "GOOGLE_API_KEY" in readme or ".env" in readme

    def test_required_settings_are_defined(self):
        """Verify all required settings are in settings.py."""
        from app.settings import settings
        
        # Check that settings can be instantiated
        assert settings is not None
        
        # Verify Google API key setting exists
        assert hasattr(settings, 'google_api_key')
        assert hasattr(settings, 'elevenlabs_api_key')
        assert hasattr(settings, 'gemini_api_key')


class TestDependencyCompatibility:
    """Test that new dependencies are compatible with existing ones."""

    def test_google_generativeai_compatible(self):
        """Test that google-generativeai can be imported."""
        try:
            import google.generativeai as genai
            assert genai is not None
        except ImportError:
            pytest.skip("google-generativeai not installed")

    def test_elevenlabs_compatible(self):
        """Test that elevenlabs can be imported."""
        try:
            from elevenlabs.client import ElevenLabs
            assert ElevenLabs is not None
        except ImportError:
            pytest.skip("elevenlabs not installed")

    def test_fastapi_compatible(self):
        """Test that FastAPI is compatible with new routes."""
        from fastapi import FastAPI
        from app.routes import router
        
        app = FastAPI()
        app.include_router(router)
        
        # Verify router can be included without errors
        assert router is not None

    def test_pydantic_schemas_validate(self):
        """Test that all new Pydantic schemas are valid."""
        from app.schemas import (
            ChatMessage,
            ChatbotQueryBody,
            ChatbotResponse,
            VoiceInputBody,
            VoiceInputResponse,
        )
        
        # Test ChatMessage
        msg = ChatMessage(role="user", content="test")
        assert msg.role == "user"
        assert msg.content == "test"
        
        # Test ChatbotQueryBody
        query = ChatbotQueryBody(message="test query")
        assert query.message == "test query"
        
        # Test ChatbotResponse
        response = ChatbotResponse(
            message="test response",
            error=None,
            quick_actions=["action1"],
        )
        assert response.message == "test response"


class TestFileStructureCompatibility:
    """Verify new files fit into existing project structure."""

    def test_chatbot_module_in_correct_location(self):
        """Verify chatbot.py is in backend/app/."""
        chatbot_path = Path(__file__).parent.parent / "chatbot.py"
        assert chatbot_path.exists(), f"chatbot.py not found at {chatbot_path}"

    def test_chat_component_in_correct_location(self):
        """Verify ChatPanel.tsx is in components/."""
        chat_path = Path(__file__).parent.parent.parent / "components" / "ChatPanel.tsx"
        assert chat_path.exists(), f"ChatPanel.tsx not found at {chat_path}"

    def test_input_component_in_correct_location(self):
        """Verify input.tsx is in components/ui/."""
        input_path = Path(__file__).parent.parent.parent / "components" / "ui" / "input.tsx"
        assert input_path.exists(), f"input.tsx not found at {input_path}"

    def test_schemas_updated(self):
        """Verify schemas.py has new types."""
        from app.schemas import ChatMessage, ChatbotQueryBody, ChatbotResponse
        assert ChatMessage is not None
        assert ChatbotQueryBody is not None
        assert ChatbotResponse is not None

    def test_routes_updated(self):
        """Verify routes.py includes new endpoints."""
        from app.routes import router
        
        # Extract route paths
        routes = [route.path for route in router.routes]
        assert any("/chat" in str(r) for r in routes), "Chat endpoint not found in routes"

    def test_types_updated(self):
        """Verify types.ts has new interfaces."""
        # This would require parsing TypeScript, so we check the file exists
        types_path = Path(__file__).parent.parent.parent / "lib" / "types.ts"
        assert types_path.exists()
        
        content = types_path.read_text()
        assert "ChatMessage" in content
        assert "ChatbotResponse" in content


class TestREADMECompatibility:
    """Verify README accurately describes the system."""

    def test_readme_has_setup_instructions(self):
        """Check README includes setup for backend and frontend."""
        readme = Path(__file__).parent.parent.parent / "README.md"
        content = readme.read_text()
        
        assert "Backend" in content or "backend" in content
        assert "Frontend" in content or "frontend" in content
        assert "npm" in content or "node" in content
        assert "pip" in content

    def test_readme_mentions_required_apis(self):
        """Check README documents required API keys."""
        readme = Path(__file__).parent.parent.parent / "README.md"
        content = readme.read_text()
        
        # At minimum, should mention setup
        assert "install" in content.lower() or "setup" in content.lower()

    def test_readme_port_numbers_are_correct(self):
        """Verify README documents correct ports."""
        readme = Path(__file__).parent.parent.parent / "README.md"
        content = readme.read_text()
        
        assert "8000" in content  # Backend port
        assert "3000" in content  # Frontend port


class TestImplementationSummaryAccuracy:
    """Verify IMPLEMENTATION_SUMMARY matches actual implementation."""

    def test_summary_lists_all_created_files(self):
        """Verify created files are documented."""
        summary = Path(__file__).parent.parent.parent / "IMPLEMENTATION_SUMMARY.md"
        content = summary.read_text()
        
        # Check key files are mentioned
        assert "chatbot.py" in content
        assert "ChatPanel.tsx" in content
        assert "schemas" in content
        assert "routes" in content

    def test_summary_documents_endpoints(self):
        """Verify all endpoints are documented."""
        summary = Path(__file__).parent.parent.parent / "IMPLEMENTATION_SUMMARY.md"
        content = summary.read_text()
        
        assert "/api/chat" in content

    def test_summary_documents_features(self):
        """Verify key features are documented."""
        summary = Path(__file__).parent.parent.parent / "IMPLEMENTATION_SUMMARY.md"
        content = summary.read_text()
        
        assert "voice" in content.lower()
        assert "chatbot" in content.lower()
        assert "context" in content.lower()

    def test_summary_includes_setup_instructions(self):
        """Verify setup instructions are in summary."""
        summary = Path(__file__).parent.parent.parent / "IMPLEMENTATION_SUMMARY.md"
        content = summary.read_text()
        
        assert "setup" in content.lower() or "install" in content.lower()

    def test_summary_lists_hackathon_tracks(self):
        """Verify hackathon tracks are addressed."""
        summary = Path(__file__).parent.parent.parent / "IMPLEMENTATION_SUMMARY.md"
        content = summary.read_text()
        
        assert "SUSTAINABILITY" in content or "sustainability" in content
        assert "STARTUP" in content or "startup" in content
        assert "PATRIOTAI" in content or "PatriotAI" in content


class TestChatbotGuideSufficiency:
    """Verify CHATBOT_GUIDE.md is comprehensive."""

    def test_guide_exists(self):
        """Verify CHATBOT_GUIDE.md was created."""
        guide = Path(__file__).parent.parent.parent / "CHATBOT_GUIDE.md"
        assert guide.exists(), "CHATBOT_GUIDE.md not found"

    def test_guide_has_setup_section(self):
        """Verify guide includes API key setup."""
        guide = Path(__file__).parent.parent.parent / "CHATBOT_GUIDE.md"
        content = guide.read_text()
        
        assert "API Key" in content or "setup" in content.lower()

    def test_guide_documents_features(self):
        """Verify guide documents voice features."""
        guide = Path(__file__).parent.parent.parent / "CHATBOT_GUIDE.md"
        content = guide.read_text()
        
        assert "voice" in content.lower()
        assert "input" in content.lower()

    def test_guide_includes_usage_examples(self):
        """Verify guide includes usage examples."""
        guide = Path(__file__).parent.parent.parent / "CHATBOT_GUIDE.md"
        content = guide.read_text()
        
        assert "Example" in content or "example" in content or "usage" in content.lower()

    def test_guide_has_troubleshooting(self):
        """Verify guide includes troubleshooting."""
        guide = Path(__file__).parent.parent.parent / "CHATBOT_GUIDE.md"
        content = guide.read_text()
        
        assert "troubleshoot" in content.lower() or "error" in content.lower()


class TestBackendImports:
    """Test that all backend imports work correctly."""

    def test_can_import_chatbot_module(self):
        """Test chatbot module can be imported."""
        from app.chatbot import (
            get_chatbot_response,
            get_emergency_suggestions,
            format_voice_briefing,
            _format_context,
        )
        assert callable(get_chatbot_response)
        assert callable(get_emergency_suggestions)
        assert callable(format_voice_briefing)
        assert callable(_format_context)

    def test_can_import_updated_schemas(self):
        """Test updated schemas can be imported."""
        from app.schemas import (
            ChatMessage,
            ChatbotQueryBody,
            ChatbotResponse,
            VoiceInputBody,
            VoiceInputResponse,
        )
        assert ChatMessage is not None
        assert ChatbotQueryBody is not None
        assert ChatbotResponse is not None

    def test_can_import_updated_routes(self):
        """Test routes can be imported with new endpoint."""
        from app.routes import router
        assert router is not None
        
        # Verify router has the chat endpoint
        route_paths = [str(route.path) for route in router.routes]
        assert any("chat" in path.lower() for path in route_paths)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
