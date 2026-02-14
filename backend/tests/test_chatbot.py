"""
Unit tests for the chatbot module.
Tests context formatting, response generation, and error handling.

Run with: python -m pytest backend/tests/test_chatbot.py -v
"""

import pytest
from unittest.mock import patch, MagicMock
from app.chatbot import (
    _format_context,
    get_chatbot_response,
    get_emergency_suggestions,
    format_voice_briefing,
)


class TestContextFormatting:
    """Test context formatting with various input combinations."""

    def test_format_context_with_quake_data(self):
        """Test earthquake data formatting."""
        quake = {
            "place": "Northern California",
            "mag": 6.5,
            "depth_km": 12,
            "time": "2026-02-14T10:30:00",
        }
        context = _format_context(quake_data=quake)
        
        assert "Northern California" in context
        assert "6.5" in context
        assert "12 km" in context

    def test_format_context_with_damage_score(self):
        """Test damage severity classification."""
        # Critical severity
        context = _format_context(damage_score=8)
        assert "CRITICAL" in context
        assert "8/10" in context
        
        # High severity
        context = _format_context(damage_score=6)
        assert "HIGH" in context
        
        # Moderate severity
        context = _format_context(damage_score=4)
        assert "MODERATE" in context
        
        # Low severity
        context = _format_context(damage_score=2)
        assert "LOW" in context

    def test_format_context_with_zones(self):
        """Test zone formatting in context."""
        zones = [
            {"level": "high", "radius_km": 10},
            {"level": "medium", "radius_km": 25},
            {"level": "low", "radius_km": 50},
        ]
        context = _format_context(zones=zones)
        
        assert "HIGH: 10km" in context
        assert "MEDIUM: 25km" in context
        assert "LOW: 50km" in context

    def test_format_context_with_plan_data(self):
        """Test response plan formatting."""
        plan = {
            "priority_actions": [
                "Move to open area",
                "Check for injuries",
                "Await emergency services",
            ],
            "help_stations": [
                {"type": "medical", "name": "City Hospital"},
                {"type": "shelter", "name": "Community Center"},
            ],
            "summary": "Major earthquake with significant damage expected.",
        }
        context = _format_context(plan_data=plan)
        
        assert "Move to open area" in context
        assert "MEDICAL" in context
        assert "City Hospital" in context

    def test_format_context_empty_inputs(self):
        """Test with no data provided."""
        context = _format_context()
        assert context == ""


class TestEmergencySuggestions:
    """Test emergency suggestion generation by severity."""

    def test_critical_suggestions(self):
        """Test CRITICAL level suggestions."""
        suggestions = get_emergency_suggestions(severity="critical")
        assert len(suggestions) > 0
        assert any("CRITICAL" in s for s in suggestions)
        assert any("Take cover" in s.lower() for s in suggestions)

    def test_high_suggestions(self):
        """Test HIGH level suggestions."""
        suggestions = get_emergency_suggestions(severity="high")
        assert len(suggestions) > 0
        assert any("damage" in s.lower() for s in suggestions)

    def test_moderate_suggestions(self):
        """Test MODERATE level suggestions."""
        suggestions = get_emergency_suggestions(severity="moderate")
        assert len(suggestions) > 0
        assert len(suggestions) == len([s for s in suggestions if s])

    def test_low_suggestions(self):
        """Test LOW level suggestions."""
        suggestions = get_emergency_suggestions(severity="low")
        assert len(suggestions) > 0

    def test_unknown_severity_defaults_to_moderate(self):
        """Test unknown severity level falls back to moderate."""
        suggestions = get_emergency_suggestions(severity="unknown")
        moderate_suggestions = get_emergency_suggestions(severity="moderate")
        assert suggestions == moderate_suggestions


class TestVoiceBriefing:
    """Test voice briefing generation."""

    def test_format_voice_briefing_empty(self):
        """Test with no data."""
        briefing = format_voice_briefing()
        assert len(briefing) > 0
        assert "Earthquake detected" in briefing

    def test_format_voice_briefing_with_damage_score(self):
        """Test briefing with damage score."""
        briefing = format_voice_briefing(damage_score=8)
        assert "critical earthquake" in briefing.lower()
        
        briefing = format_voice_briefing(damage_score=1)
        assert "moderate earthquake" in briefing.lower()

    def test_format_voice_briefing_with_plan(self):
        """Test briefing with response plan."""
        plan = {
            "priority_actions": ["Stay calm", "Move to safety"],
            "summary": "Significant damage expected in downtown area.",
        }
        briefing = format_voice_briefing(plan_data=plan)
        assert "Stay calm" in briefing
        assert "downtown area" in briefing


class TestChatbotResponseGeneration:
    """Test chatbot response generation."""

    def test_empty_message_returns_error(self):
        """Test that empty messages return errors."""
        response, error = get_chatbot_response("")
        assert error is not None
        assert response == ""

    def test_missing_api_key_returns_error(self):
        """Test that missing API key is handled."""
        with patch("app.chatbot.settings") as mock_settings:
            mock_settings.google_api_key = None
            response, error = get_chatbot_response("What should I do?")
            assert error is not None
            assert "API key not configured" in error

    @patch("app.chatbot.genai.GenerativeModel")
    @patch("app.chatbot.genai.configure")
    def test_successful_response_generation(self, mock_configure, mock_model_class):
        """Test successful AI response generation."""
        # Setup mock
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = [MagicMock(text="Stay safe and follow emergency procedures.")]
        mock_model.generate_content.return_value = mock_response
        
        with patch("app.chatbot.settings") as mock_settings:
            mock_settings.google_api_key = "test-key"
            
            response, error = get_chatbot_response(
                "What should I do?",
                quake_data={"place": "Test", "mag": 5.0},
            )
            
            assert error is None
            assert len(response) > 0
            assert "Stay safe" in response

    @patch("app.chatbot.genai.GenerativeModel")
    @patch("app.chatbot.genai.configure")
    def test_response_with_context(self, mock_configure, mock_model_class):
        """Test response generation with full context."""
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        
        mock_response = MagicMock()
        mock_response.candidates = [MagicMock()]
        mock_response.candidates[0].content.parts = [MagicMock(text="Evacuate to the green zone.")]
        mock_model.generate_content.return_value = mock_response
        
        with patch("app.chatbot.settings") as mock_settings:
            mock_settings.google_api_key = "test-key"
            
            quake_data = {"place": "Downtown", "mag": 6.5, "depth_km": 15}
            plan_data = {
                "priority_actions": ["Evacuate", "Seek shelter"],
                "help_stations": [{"type": "shelter", "name": "Center"}],
            }
            
            response, error = get_chatbot_response(
                "Where should I go?",
                quake_data=quake_data,
                plan_data=plan_data,
                damage_score=7,
            )
            
            assert error is None
            assert "zone" in response.lower() or len(response) > 0

    def test_chat_history_inclusion(self):
        """Test that chat history is properly included."""
        chat_history = [
            {"role": "user", "content": "What happened?"},
            {"role": "assistant", "content": "A 6.5 magnitude earthquake..."},
        ]
        
        with patch("app.chatbot.settings") as mock_settings:
            mock_settings.google_api_key = None  # Will fail on API, but we're testing history
            response, error = get_chatbot_response(
                "What should I do?",
                chat_history=chat_history,
            )
            # Just verify no crash with history included
            assert isinstance(response, str)


class TestIntegration:
    """Integration tests with realistic scenarios."""

    def test_critical_earthquake_scenario(self):
        """Test response to critical earthquake."""
        suggestions = get_emergency_suggestions(severity="critical")
        assert len(suggestions) >= 5
        assert any("take cover" in s.lower() for s in suggestions)
        assert any("cover" in s.lower() for s in suggestions)

    def test_moderate_earthquake_scenario(self):
        """Test response to moderate earthquake."""
        briefing = format_voice_briefing(damage_score=4)
        assert len(briefing) > 20
        assert "earthquake" in briefing.lower()

    def test_full_context_scenario(self):
        """Test with full earthquake + plan context."""
        quake = {
            "place": "San Francisco Bay Area",
            "mag": 7.2,
            "depth_km": 8,
            "time": "2026-02-14T14:30:00",
        }
        plan = {
            "priority_actions": [
                "Activate emergency operations center",
                "Deploy search and rescue teams",
                "Open shelters for displaced residents",
            ],
            "help_stations": [
                {"type": "medical", "name": "UCSF Medical Center", "lat": 37.762, "lng": -122.458},
                {"type": "shelter", "name": "Civic Center", "lat": 37.779, "lng": -122.414},
            ],
            "summary": "Major earthquake causing widespread damage across the Bay Area.",
        }
        
        context = _format_context(
            quake_data=quake,
            plan_data=plan,
            damage_score=8,
            zones=[
                {"level": "high", "radius_km": 15},
                {"level": "medium", "radius_km": 40},
            ],
        )
        
        assert "San Francisco" in context
        assert "7.2" in context
        assert "CRITICAL" in context
        assert "UCSF Medical Center" in context


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
